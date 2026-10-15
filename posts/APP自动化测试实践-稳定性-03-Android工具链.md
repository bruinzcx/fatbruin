---
title: APP自动化测试实践 稳定性·03：Android 工具链——adb 怎么采集数据，Fastbot 怎么驱动 App
date: 2026.10.04
group: Testing
slug: app-testing-stability-03-android-toolchain
summary: Android 侧用 adb 采集数据、Fastbot 驱动 App，两端如何产出同一套报告。
---

> 本文是系列《AI背景下的APP端自动化测试实践》稳定性测试部分的第三篇。
>
> 上一篇讲了 iOS 侧的工具链，这一篇讲 Android。两端要做的事情一样：驱动 Fastbot、采集性能数据、捕获崩溃，但实现方式差别很大。理解这些差别，就能看明白框架为什么在两端做了不同的设计选择，又是怎么让两边最终产出同一套报告的。

---

## 一、adb：Android 的"万能遥控器"

iOS 侧用 Apple 官方的 `xcrun devicectl` 和设备通信，Android 侧对应的是 **adb**（Android Debug Bridge）。两者角色相同，来历和使用体验却不太一样：

| | xcrun devicectl（iOS） | adb（Android） |
|---|---|---|
| 出处 | Apple 官方，随 Xcode 附带 | Google 官方，随 Android SDK 附带 |
| 协议 | CoreDevice，私有 | ADB 协议，开放 |
| 安装 | 随 Xcode 自动安装 | `brew install android-platform-tools` |
| 前提 | 设备信任这台电脑 | 设备开启"USB 调试" |

相比 iOS 那边"官方工具也只开放了有限能力"的处境，adb 要自由得多。它的命令体系成熟、文档完善，几乎能做任何事：

```bash
adb devices                                       # 列出已连接设备
adb install -r -g app-release.apk                 # 覆盖安装，并自动授予运行时权限
adb shell am start -n com.umu.app/.MainActivity   # 启动 App
adb logcat                                        # 实时查看系统日志
adb shell dumpsys meminfo com.umu.app             # 查看进程内存
adb pull /sdcard/report.txt ./                    # 从设备拉取文件
```

其中最关键的是 `adb shell`。它让我们在 Mac 的终端里直接执行设备上的 Linux 命令，就像 SSH 登录进了手机。框架里绝大多数的数据采集，走的都是这个入口。

---

## 二、Fastbot 在 Android 上怎么跑：不用安装的 jar

在 iOS 上，Fastbot 以 XCTest Runner 的形式存在，借用系统测试框架的壳来操作 App。Android 上的思路完全不同，它用的是 **`app_process`**。

`app_process` 是 Android 系统自带的一个底层进程启动器，可以直接在 Android 运行时里加载并执行 Java 代码，**不需要打包成 APK，也不需要安装**。系统自带的 `monkey` 命令就是这样跑起来的，Fastbot 沿用了同样的方式：先把自己的 jar 包和原生库推送到设备上，再用 `app_process` 启动。

```bash
# 1. 推送 Fastbot 的 jar 和原生库
adb push monkeyq.jar framework.jar fastbot-thirdpart.jar /sdcard/
adb push libfastbot_native.so /data/local/tmp/arm64-v8a/

# 2. 用 app_process 启动 Fastbot
adb shell CLASSPATH=/sdcard/monkeyq.jar:/sdcard/framework.jar:/sdcard/fastbot-thirdpart.jar \
  exec app_process /system/bin com.android.commands.monkey.Monkey \
  -p com.umu.app \
  --agent reuseq \
  --running-minutes 300 \
  --throttle 300
```

这里有个小坑：原生库必须放在带 CPU 架构子目录的路径下（如 `/data/local/tmp/arm64-v8a/`），否则 Fastbot 启动时会报找不到库。

Fastbot 通过系统的 UI 自动化接口读取当前界面的控件树。这个接口对所有 App 开放，不区分 Debug 和 Release，也不需要改 App 的任何代码。所以和 iOS 一样，我们在 Android 上测的也是 Release 包本身。

两端的运行方式可以这样对照：

| | iOS | Android |
|---|---|---|
| 启动方式 | `xcodebuild test-without-building` | `adb shell app_process` 直接执行 jar |
| Fastbot 的形态 | XCTest Runner，一个独立的测试 App | 一组 jar 包，无需安装 |
| 读取界面 | 系统无障碍树，加上 App 内注入的 stub | 系统 UI 自动化接口 |
| 对被测 App 的改动 | 注入 stub（不改源码） | 无 |

有意思的是，iOS 因为自定义控件"看不见"，不得不往 App 里注入 stub；Android 的控件树本身就足够完整，至今没有遇到需要插桩的情况。

### 黑名单：别让猴子点了"退出登录"

随机操作最怕误触破坏性的入口：一旦点了"退出登录"，后面几个小时都只能在登录页打转。Fastbot 支持 Activity 黑名单，主控脚本会把配置好的黑名单文件推送到设备，并通过启动参数告诉 Fastbot 哪些页面不要进入。

---

## 三、内存采集：dumpsys meminfo

iOS 上有 `xctrace` 这样现成的录制工具，Android 上没有对应的封装，需要自己定时调用系统命令。内存用的是 `dumpsys meminfo`：

```bash
adb shell dumpsys meminfo com.umu.app
```

输出截取如下：

```
** MEMINFO in pid 12345 [com.umu.app] **
                   Pss  Private  Private  SwapPss      Rss
                 Total    Dirty    Clean    Dirty    Total
                ------   ------   ------   ------   ------
  Native Heap    82316    82276        0      120    84204
  Dalvik Heap    46012    45876        0        0    48216
  ...
     TOTAL PSS:  198472            TOTAL RSS:  312844
```

采集器每 5 秒执行一次，从输出里取出 `TOTAL PSS`，换算成 MB 写入 `perf_raw.jsonl`。不同 Android 版本的输出格式略有差异，解析时对新旧两种写法都做了兼容。

### 为什么 Android 用 PSS

Android 上同样有 RSS 这个口径，但我们选的是 **PSS**（Proportional Set Size，按比例分摊的内存）。原因在于 Android 大量使用共享内存：很多系统库被多个 App 同时加载，RSS 会把共享的部分完整地算进每一个进程，显得虚高；PSS 则按共享的进程数把这部分平摊。

```
假设某个系统库占 10MB，被 5 个 App 共享：

  RSS 算法：每个 App 各算 10MB  → 加起来 50MB（重复计算）
  PSS 算法：每个 App 各算 2MB   → 加起来 10MB（真实占用）
```

需要注意的是，iOS 侧用的是 Physical Footprint，Android 侧用的是 PSS，两者口径不同，**不能直接拿绝对值做跨平台比较**。但在各自平台内部看趋势、判断是否泄漏、对照阈值告警，都是可靠的。

---

## 四、CPU 采集：直接读 /proc

Android 是 Linux 内核，进程的 CPU 时间就记录在 `/proc` 文件系统里，直接读就行：

```bash
# 系统总 CPU 时间
adb shell cat /proc/stat

# 目标进程的 CPU 时间
adb shell cat /proc/<pid>/stat
```

这两个文件记录的都是累计值，单位是 jiffies（内核时钟的滴答数）。采集器隔一小段时间读两次，用差值计算这段时间里目标进程占了多少 CPU：

```
CPU% = (进程 CPU 时间的增量 / 系统总 CPU 时间的增量) × 100
```

这和 `top` 命令显示的口径一致。之所以不直接解析 `top` 的输出，是因为不同厂商、不同系统版本的 `top` 格式五花八门，而 `/proc` 是内核接口，格式稳定，也不依赖任何额外工具。

### FPS 没有采集

Android 可以用 `dumpsys gfxinfo` 获取帧渲染数据，但频繁调用本身就有明显的性能开销，会干扰被测 App；而且在 Monkey 这种高频随机操作的场景下，帧率数据的参考意义也有限。所以 Android 侧目前只采内存和 CPU，不采 FPS。

---

## 五、崩溃捕获：从 logcat 里实时筛

iOS 的崩溃会落成 `.ips` 文件，框架要定时去设备上轮询拉取。Android 的崩溃则会实时出现在 **logcat** 里，框架可以边跑边监听。

logcat 是 Android 的系统日志流，系统、App、内核各层的日志都实时汇入这条流，类似 macOS 的"控制台"，但更底层，信息量也大得多。崩溃收集器开跑前会先清空日志缓存，然后以 `adb logcat -v threadtime *:W` 持续读取警告及以上级别的日志，从中识别四类事件。

### Java 层崩溃

```
E/AndroidRuntime: FATAL EXCEPTION: main
    Process: com.umu.app, PID: 12345
    java.lang.NullPointerException: Attempt to invoke virtual method...
        at com.umu.module.HomeFragment.onResume(HomeFragment.java:87)
```

看到 `FATAL EXCEPTION`，就把它和紧随其后的栈帧作为一个完整的块收集起来，提取异常类型和调用栈。

### 原生层崩溃

原生代码（C/C++ 编写的部分）崩溃时，系统会生成一份 tombstone（墓碑）报告，并在 logcat 里输出摘要，开头是一行醒目的 `*** *** ***` 分隔符，里面会写明是哪个进程崩溃了：

```
F DEBUG   : *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***
F DEBUG   : pid: 12345, tid: 12345, name: com.umu.app  >>> com.umu.app <<<
F DEBUG   : signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)
```

这里有一个重要的去噪设计：收集器会检查块里有没有 `>>> 被测包名 <<<` 这一行，没有就丢弃。因为 Fastbot 自己也运行在设备上，它偶尔崩溃时同样会产生 tombstone，如果不做这一步过滤，Fastbot 的问题就会被误报成 App 的崩溃。

### Flutter 层崩溃

Flutter 的 Dart 层异常走的是 `flutter` 这个日志标签：

```
E/flutter: [ERROR:flutter/runtime/dart_vm_initializer.cc]
  Unhandled Exception: Null check operator used on a null value
  #0  HomeBloc.loadData (package:umu_app/home/bloc.dart:42:5)
```

和 iOS 不同，Android 上 Dart 的栈帧直接就是可读的函数名和行号，不需要额外符号化。收集器识别到这类日志时，会标记为 Flutter 崩溃。

### ANR

```
E/ActivityManager: ANR in com.umu.app
    PID: 12345
    Reason: Input dispatching timed out
```

ANR（应用无响应）单独计数，**不计入崩溃数**：出现 ANR 时报告判为 WARN，但不会因此判 FAIL，以保持崩溃判定的干净。

### Fastbot 自己的记录

除了 logcat，Fastbot 也会把它捕获到的崩溃摘要和 ANR 时的线程堆栈写到设备的 `/sdcard/crash-dump.log` 和 `/sdcard/oom-traces.log` 里。测试结束后，框架把这两个文件拉回本地，作为补充信息附在报告里。它们和 logcat 的内容有重叠，但在某些原生崩溃场景下，Fastbot 记录的上下文比 logcat 更完整。

---

## 六、页面覆盖率：不插桩也能统计

iOS 侧靠注入的 stub 拦截页面出现事件来统计到过哪些页面。Android 侧不插桩，但 Fastbot 每次跳转到新的 Activity 时，都会在自己的日志里留下一行记录：

```
Allowing start of Intent { cmp=cn.tc.umu/cn.tc.umu.ui.home.HomeActivity }
```

测试结束后，覆盖率脚本解析 Fastbot 的日志，提取所有这样的行，按包名精确过滤掉系统 App 和 LeakCanary 这类工具页面，得到本次访问过的 Activity 列表。

为什么不直接从 logcat 里取页面跳转记录？因为从 Android 11 开始，相关日志的标签从 `ActivityManager` 迁移到了 `ActivityTaskManager`，按标签过滤变得不稳定。Fastbot 的日志是它自己输出的，格式稳定，包名也来自它的内部逻辑，更可信。

覆盖率的分母则来自对安装包的静态扫描，做法和 iOS 同源：用 `aapt2` 解析安装包的清单文件，列出所有属于本 App 的 Activity；再从 Flutter 的编译产物里提取所有 `umu://` 开头的路由。每次运行时自动扫描当前安装包，保证分母和被测版本一致。

有一点需要说明：Android 的 Release 包里没有 Flutter 路由的访问日志，所以**目前 Android 只能统计原生页面的覆盖率**，Flutter 页面虽然有分母，却还没有办法知道到过哪些。

---

## 七、把各部分串起来

一次 Android 测试的整体流程如下：

```
run.py（主控）
  ├── 唤醒屏幕并解除锁屏（确保 Fastbot 操作的是 App 而不是锁屏界面）
  ├── 安装 APK（指定的文件不存在时，使用设备上已有的版本）
  ├── 扫描安装包，生成覆盖率分母
  │
  ├── 启动 Fastbot（adb shell app_process ...）
  │     └── 设备上 App 被持续操作，输出 fastbot.log
  │
  ├── 启动 perf_collector.py
  │     ├── 每 5 秒 dumpsys meminfo → PSS
  │     └── 每 5 秒 /proc/stat 差分 → CPU%
  │           → perf_raw.jsonl
  │
  └── 启动 crash_watcher.py
        └── adb logcat 实时流
              ├── FATAL EXCEPTION            → Java 崩溃
              ├── tombstone + 包名校验       → 原生崩溃
              ├── flutter 标签异常           → Flutter 崩溃
              └── ANR in <包名>              → ANR（单独计数）
                    → crashes.jsonl

测试结束
  ├── 拉取 crash-dump.log / oom-traces.log
  ├── 解析 fastbot.log → coverage.json
  └── reporter.py → report.json + report.html，FAIL 时推送告警
```

---

## 八、iOS 与 Android 工具链全对比

| 能力 | iOS | Android |
|------|-----|---------|
| 设备通信 | `xcrun devicectl`（CoreDevice） | adb |
| Fastbot 运行方式 | XCTest Runner，xcodebuild 启动 | jar 包，`app_process` 直接执行 |
| 读取界面 | 无障碍树 + 注入的 stub | 系统 UI 自动化接口 |
| 内存 | `xctrace` 录制，Physical Footprint | `dumpsys meminfo` 每 5 秒，PSS |
| CPU | `xctrace` 录制 | `/proc` 差分，每 5 秒 |
| FPS | 未采集 | 未采集 |
| 崩溃来源 | 设备上的 `.ips` 文件，每 30 秒轮询 | logcat 实时流，四类事件 |
| Flutter 崩溃识别 | 栈帧特征（`DART_MIRROR`、`dart::`） | `flutter` 日志标签 |
| 工具自身的误报过滤 | 排除系统模拟报告，stub 崩溃单独计数 | tombstone 必须带被测包名，过滤 Fastbot 自身崩溃 |
| ANR | 无此概念 | 单独计数，判 WARN 不判 FAIL |
| 页面访问记录 | stub 拦截页面出现事件，含 Flutter 路由 | fastbot.log 中的 Activity 跳转，暂无 Flutter |
| 覆盖率分母 | 注入时静态分析 IPA | 运行时用 aapt2 和 strings 扫描 APK |

两端的采集机制几乎没有一处相同，但框架让它们的产物保持一致：`perf_raw.jsonl`、`crashes.jsonl`、`coverage.json` 的字段格式两端统一，报告模块拿到数据时完全不需要区分平台。这正是把报告逻辑放在两端共享层的价值所在。

---

## 下一篇预告

下一篇进入报告模块。它是整个框架的"大脑"：接收两端采集的原始数据，计算各项指标，对照阈值给出 PASS、WARN 或 FAIL，生成可读的报告，并在失败时推送告警。下一篇会把"数据怎么变成结论"这件事讲清楚。
