---
title: APP自动化测试实践 稳定性·02：iOS 工具链——从 tidevice 到 CoreDevice 的工具演进
date: 2026.10.03
group: Testing
slug: app-testing-stability-02-ios-toolchain
summary: 不越狱驱动 iOS 真机、采集性能与崩溃：从 tidevice 失效到全面切换 CoreDevice。
---

> 本文是系列《AI背景下的APP端自动化测试实践》稳定性测试部分的第二篇。
>
> 上一篇讲清了稳定性测试要测什么。这一篇进入 iOS 平台的具体工具：怎么在不越狱的前提下驱动真机上的 App、采集性能数据、收集崩溃日志。我们最初的方案基于开源工具 tidevice，接入新系统时整条链路失效，最终全面切换到了 Apple 官方的 CoreDevice 工具链。这篇会把两套方案都讲到：前者帮助理解底层原理，后者是踩坑之后真正跑起来的样子。

---

## 一、先从熟悉的东西说起：Xcode 是怎么跑 App 的？

每天在 Xcode 里按下运行键，背后其实发生了一连串事情：

```
Xcode
  ├── 1. 编译代码，生成 .app 包
  ├── 2. 通过 USB 连接设备（Apple 私有协议 lockdownd）
  ├── 3. 把 .app 推送到设备并安装
  ├── 4. 启动 debugserver，建立调试通道
  └── 5. 启动 App，开始 lldb 调试会话
```

Mac 和 iPhone 之间说的是一套 Apple 私有协议。它没有公开文档，但也没有加密，只是没人写说明书而已。

**tidevice 做的事情，就是用 Python 把这套协议重新实现了一遍。** 所以它并没有"破解"什么，也不需要越狱，只是学会了说和 Xcode 一样的"语言"，让设备以为是 Xcode 在操作它。装上 tidevice 之后，Xcode 能做的大部分事情都能在终端里完成：列出设备、安装 App、启动 App、拉取崩溃日志、实时采集性能数据。

---

## 二、最初的方案，以及它为什么失效

最初的设计很简洁，三件事都交给 tidevice：

```
run.py（主控）
  ├── tidevice xctest   → 启动 Fastbot，在设备上操作 App
  ├── tidevice perfmon  → 实时采集 CPU / 内存 / FPS
  └── tidevice crash    → 轮询并下载崩溃日志
```

在 iOS 26 的设备上一跑，前两项直接报错 `DeveloperImage not found`。

原因在于 `xctest` 和 `perfmon` 都依赖设备上的 instruments 服务，而这个服务需要先挂载开发者磁盘镜像（Developer Disk Image，简称 DDI）。iOS 17 起，Apple 把 DDI 改成了"个性化"机制：镜像需要针对每台设备单独签发，tidevice 无法生成，相关功能就全部失效了。只有拉取崩溃日志这类走文件传输协议（AFC）、不依赖 DDI 的命令还能用。

这件事的教训很直接：**基于逆向私有协议的第三方工具，随时可能被系统升级打断。** 稳定性测试要每晚无人值守地跑，经不起这种不确定性。于是我们决定全面切换到 Apple 官方的工具链，tidevice 完全退场。

---

## 三、新工具链：三个官方命令各管一摊

Xcode 15 之后，Apple 把设备通信统一到了 CoreDevice 框架上，并提供了配套的命令行工具，原生支持 iOS 17 以后的系统，不再需要手动处理 DDI。新方案的架构和原来一样，只是把每个环节的工具换掉了：

| 环节 | 原方案 | 现方案 |
|---|---|---|
| 驱动 Fastbot | `tidevice xctest` | `xcodebuild test-without-building` |
| 性能采集 | `tidevice perfmon`（实时流） | `xcrun xctrace record`（录制后导出） |
| 崩溃收集 | `tidevice crash` | `xcrun devicectl device copy from` |
| 设备查询、安装、启动 | `tidevice list / install / launch` | `xcrun devicectl` |

这里有一个容易踩的坑：设备有两种标识。我们的设备注册表里记录的是 UDID，`devicectl` 的大部分命令也接受 UDID，但涉及文件和进程的接口要求的是 CoreDevice 自己的 identifier。所以主控脚本启动时，会先把 UDID 转换成 identifier 备用。

整体的运行结构如下，三个子进程并发执行、互不干扰：

```
run.py（主控）
  ├── xcodebuild test-without-building   → Fastbot 在设备上操作 App
  ├── perf_collector.py                  → xctrace 分段录制 → perf_raw.jsonl
  └── crash_watcher.py                   → 每 30 秒轮询 → crashes.jsonl
```

除了调度这三个进程，主控脚本还负责几件杂事：通过 `devicectl` 反查被测 App 的进程名，供性能采集按名字挂载；用 macOS 的 `caffeinate` 阻止 Mac 在长时间测试中休眠；以及在 Fastbot 意外退出时限频重启它。

下面逐个展开。

---

## 四、驱动 Fastbot：借用 XCTest 的壳

### XCTest Runner 是什么

用 Xcode 写 UI 测试时，测试代码并不跑在 App 进程里，而是跑在一个叫 XCTest Runner 的独立宿主进程中。Runner 通过系统提供的接口去读取被测 App 的界面、发送触摸事件。

Fastbot iOS 巧妙地利用了这个机制：它把"智能遍历 App"的逻辑整个打包成一个 XCTest Runner（FastbotRunner）。对系统来说，这只是一次普通的 UI 测试；实际上，测试代码在持续不断地操作 App。

```
xcodebuild 启动 FastbotRunner
      │
      └── 读取被测 App 的界面结构
              │
              └── 按策略选择控件，点击 / 滑动 / 返回
```

Runner 和被测 App 是两个独立进程，Runner 通过系统接口与 App 交互，所以**不需要修改 App 的代码，也不要求 App 是 Debug 包**。只要 App 装在设备上能启动，Fastbot 就能操作它。这正是"直接测 Release 包"这个原则在技术上能成立的基础。

### 怎么启动

FastbotRunner 只需要用 `build-for-testing` 编译一次，之后每次运行都用 `test-without-building` 跳过编译，直接执行：

```bash
xcodebuild test-without-building \
  -xctestrun FastbotRunner.xctestrun \
  -destination 'platform=iOS,id=<UDID>' \
  -only-testing:FastbotRunner/FastbotRunner/testFastbot
```

被测 App 的包名、运行时长、操作间隔等参数，以及要转交给被测 App 的启动环境变量，都写在编译产物 `.xctestrun` 文件里。主控脚本每次运行前会复制一份并改写其中的参数，再交给 `xcodebuild` 执行。这样不同的运行任务（比如不同账号、不同实验分组）可以各用各的参数，互不污染。

---

## 五、性能采集：从实时流到"录制再导出"

### xctrace 怎么用

`xcrun xctrace` 是 Instruments 的命令行版本。我们用它的 Activity Monitor 模板挂载到被测 App 上录制，录完再把系统监控表导出成 XML 解析：

```bash
# 录制：按进程名挂载，与测试同时进行
xcrun xctrace record \
  --device <UDID> \
  --template 'Activity Monitor' \
  --time-limit 600s \
  --attach 'UMU-CN' \
  --output perf.trace

# 导出：取出系统监控表
xcrun xctrace export \
  --input perf.trace \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="sysmon-process"]' \
  --output sysmon.xml
```

和 tidevice 的实时数据流不同，xctrace 只能**录完才能导出**。最初的实现是从头录到尾，结果一旦中途出问题，几个小时的数据全部丢失。现在改成了分段录制：每 10 分钟切一段，每段导出后立即追加写入 `perf_raw.jsonl`，单段失败不影响其他段。

长时间运行还会碰到另一个问题：App 被 Fastbot 操作崩溃后会重启，进程 ID 随之改变，挂载就断了。所以采集器始终**按进程名而不是进程 ID 挂载**，挂载失败时按指数退避重试；连续失败多次，就清理残留的 xctrace 进程、重置通道再试，永不彻底放弃。录不到数据的时间段，会作为"盲区"记录在 `perf_meta.json` 里，报告据此标注采集覆盖度，而不是假装数据完整。

### 采到了什么

每一行记录长这样：

```jsonl
{"timestamp": 1717300001.19, "memory_mb": 121.06, "rss_mb": 242.86, "cpu_pct": 21.1, "process": "UMU-CN (23834)", "platform": "ios"}
```

| 字段 | 单位 | 含义 |
|------|------|------|
| `timestamp` | Unix 时间戳（秒） | 本段录制开始时刻加上段内的相对时间 |
| `memory_mb` | MB | Physical Footprint，进程实际占用的物理内存 |
| `rss_mb` | MB | Resident Size，常驻内存 |
| `cpu_pct` | % | 进程的 CPU 占用率 |

### 为什么用 Physical Footprint 衡量内存

iOS 的进程内存有好几种口径。虚拟内存太大，包含了大量还没真正分配的地址空间，反映不了真实压力。常驻内存（RSS）表示驻留在物理内存里的页，但 iOS 有内存压缩机制：系统紧张时会把不活跃的内存页压缩存放，RSS 并不能准确反映进程"真正占了多少"。

Physical Footprint 是 Xcode 内存仪表和 Instruments 默认展示的口径，也是系统判断是否要因内存过高而杀掉 App 时主要参考的指标。所以报告里的内存曲线、峰值和泄漏判断都基于它，RSS 只作为辅助参考保留。

### FPS 暂时没有采集

tidevice 的 perfmon 能直接给出 FPS，但 Activity Monitor 模板只覆盖 CPU 和内存。所以目前 iOS 侧的报告**没有 FPS 指标**，卡顿检测是后续要补的一块。

将来补上时有一个坑需要提前注意：FPS 通常来自屏幕刷新回调，而 App 静止时（没有动画、没有滚动）系统不刷新屏幕，FPS 会被记成 0 或接近 0。这是正常的省电行为，不是卡顿。如果把这些点直接计入平均值，结论会变成"App 非常卡"，所以必须先过滤掉静止时段。

---

## 六、崩溃收集：轮询设备上的 .ips 文件

### 怎么拉取

崩溃收集器每 30 秒用 `devicectl` 列一次设备上的系统崩溃日志目录，与启动时记录的基线做对比，发现属于被测 App 的新文件，就用 `devicectl device copy from --domain-type systemCrashLogs` 拉回本地解析。测试结束时还会做一次最终拉取，确保最后一个轮询窗口里的崩溃不会漏掉。

### .ips 文件的格式

iOS 15 之后，崩溃日志统一使用 `.ips` 格式。它看起来像 JSON，但有一个坑：**它其实是两段独立的 JSON**。第一行是概要信息，换行之后才是崩溃主体：

```
{"bug_type":"309","timestamp":"2026-06-03 11:00:47","os_version":"iPhone OS 26.4.2",...}
{
  "exception": {...},
  "threads": [...]
}
```

直接整体解析会报 "Extra data" 错误，必须先按第一个换行切开，再解析第二段。崩溃主体的关键字段如下：

```json
{
  "exception": {
    "type": "EXC_BAD_ACCESS (SIGSEGV)",
    "codes": "KERN_INVALID_ADDRESS at 0x0000000000000010",
    "signal": "SIGSEGV"
  },
  "threads": [
    {
      "id": 0,
      "crashed": true,
      "frames": [
        { "imageOffset": 12345, "symbol": "??", "imageIndex": 3 }
      ]
    }
  ],
  "usedImages": [
    { "name": "UMU", "arch": "arm64", "base": "0x1000e4000", "uuid": "XXXX-..." }
  ]
}
```

注意 `symbol` 是 `"??"`：Release 包剥离了符号，地址无法直接对应到函数名。

### 识别 Flutter 崩溃

对 Flutter 混合 App，还要分辨崩溃发生在哪一层。原生栈帧和 Flutter 引擎的 C++ 栈帧可以直接符号化；Dart 层的栈帧则带有 `DART_MIRROR`、`dart::` 这类特征，或者干脆只剩一个裸地址。收集器检测到这些特征时，会把该条崩溃标记为 Flutter 崩溃，提示排查时要用 Flutter 的工具链去还原。

### 哪些"崩溃"不该算

长期运行之后我们发现，并不是设备上每一份崩溃报告都代表 App 真的崩了，有两类需要单独处理。

第一类是系统生成的模拟报告。文件名以 `ExcUserFault` 开头，报告头带有 `is_simulated` 标记，是系统内部记录故障时生成的一份轻量快照，App 进程并没有被杀，整条调用栈也都在系统框架里。这类报告直接排除。

第二类是测试工具自己引起的崩溃。后面会讲到，我们在 App 里注入了一个小组件来增强界面感知，它在读取界面时偶尔会触发系统层面的崩溃。如果崩溃线程的栈里出现这个组件的帧，收集器会把它标记为"stub 崩溃"。报告不把它计入 App 的崩溃数，只判为 WARN，避免测试工具的问题被误报成 App 的问题。

---

## 七、符号化：把地址还原成函数名

拿到 `.ips` 之后，原生层的地址可以用 Xcode 自带的 `atos` 还原：

```bash
atos \
  -arch arm64 \
  -o UMU.app.dSYM/Contents/Resources/DWARF/UMU \
  -l 0x1000e4000 \
  <崩溃地址>
```

其中 `-l` 是加载基址，取自 `.ips` 里 `usedImages` 的 `base` 字段；崩溃地址等于基址加上栈帧的 `imageOffset`。还原后，原本看不懂的十六进制地址就变成了类似 `-[HomeViewController loadUserData] (HomeViewController.m:142)` 这样的函数名和行号。

Dart 层则要用 Flutter 的工具：

```bash
flutter symbolize \
  --debug-info=<构建时生成的符号文件> \
  --input=crash.ips
```

这两条路有一个共同前提：**必须有和被测包完全对应的符号文件。** 没有它，地址就只是地址，什么都还原不了。所以每次出测试包时归档 dSYM，是一个必须遵守的规矩。

---

## 八、stub：让 Fastbot 看见自定义控件

### 为什么需要它

上面讲的方案里，Fastbot 通过系统的无障碍树来"看"界面，这样最省事，App 一行代码都不用改。但很快我们就撞上了它的天花板：UMU 用的是自定义 Tab Bar，在无障碍树里完全不可见。Fastbot 看不到 Tab，就切换不了，十个小时都困在第一个 Tab 的页面里。

解决办法是 Fastbot iOS 自带的 stub 模式：在 App 进程里放一个小组件，它在 App 内部启动一个轻量 HTTP 服务（默认端口 9797），提供 `POST /view` 接口，直接遍历整棵 UIView 树返回给 Fastbot：

```json
{
  "desc": [
    {
      "view": {
        "type": "UITabBarButton",
        "rect": {"left": 2, "top": 850, "width": 139, "height": 48},
        "clickable": true,
        "visible": true,
        "controller": "UGTabBarController"
      },
      "children": [...]
    }
  ]
}
```

因为是在 App 内部直接遍历视图，不依赖控件有没有实现无障碍接口，自定义控件也能完整呈现。Fastbot 通过启动参数得知 stub 的端口，优先从 stub 获取界面，失败时才退回无障碍树。

### 不改源码，直接注入 Release 包

最初的 stub 需要把源码加进 App 工程一起编译，这要求每次都改工程、重新打包。后来我们写了一个注入脚本，直接在打好的包上动手：

```
解包 IPA
  ├── 向 App 主二进制添加一条加载指令（LC_LOAD_DYLIB），指向 stub 动态库
  ├── 把 stub 动态库复制到 Frameworks/ 目录
  ├── 用分发证书对所有组件重新签名
  └── 重新打包 IPA
```

这样既不用改 App 源码，被测的也仍然是 Release 配置的包。注入的同时，脚本还会顺手对安装包做一次静态分析：用 `otool` 读取主二进制里的 Objective-C 类列表，提取所有业务页面（ViewController）的类名；用 `strings` 从 Flutter 产物里提取所有 `umu://` 开头的路由。两者合起来就是"App 里一共有多少个页面"，作为页面覆盖率的分母。这里原本用的是 `nm`，但它在符号被剥离后会失效，所以换成了直接读类列表。

### 启动参数怎么传进 App

stub 只有在 App 的启动环境变量里读到 `stubPort` 时才会启动服务。这个变量要从主控脚本一路传到 App 进程里：

```
run.py 生成 launchenv（如 stubPort=9797）
      ↓ 改写进本次运行的 .xctestrun
FastbotRunner 启动被测 App 时，把 launchenv 作为环境变量转交
      ↓
App 进程读取 stubPort，启动 HTTP 服务
```

这也解释了一个常见现象：手动点图标打开的 App，stub 是不工作的，因为没人给它传这个变量。

### 页面覆盖跟踪

stub 还承担了另一项工作：记录测试过程中到过哪些页面。它拦截了页面的 `viewDidAppear:` 方法，每当一个业务页面首次出现，就往设备上的一个日志文件里追加一行：

```
{"vc":"UGHomeViewController","ts":"11:23:05"}
{"vc":"Flutter::umu://chatbot/template","ts":"11:24:17"}
```

对 Flutter 页面，原生层看到的只是一个通用的容器页面，名字对产品同学毫无意义。所以检测到 Flutter 容器时，stub 会额外读取它承载的路由地址，记成 `Flutter::<路由>` 的形式，报告里就能和具体的产品页面一一对应。测试结束后，主控脚本把日志文件拉回本地，和前面静态分析得到的分母对比，就得到了页面覆盖率。

### 踩过的坑

stub 运行在被测 App 的进程里，又和闭源的 Fastbot 打交道，踩过的坑不少：

| 现象 | 原因 |
|------|------|
| App 刚启动时反复被重启 | App 启动加 stub 绑定端口需要约 2 秒，Fastbot 立即轮询，连续失败累积到阈值就触发重启，App 刚起来又被杀，形成死循环 |
| Tab 按钮被判为不可点 | stub 的可点判定对系统控件（如 Tab 按钮）有漏洞，后来又发现坐标换算的方向也反了，整屏容器被判可点、真正的按钮反而不可点。修正过程见覆盖率专项一篇 |
| 高频调用导致 App 被系统杀掉 | `/view` 要在主线程上遍历整棵视图树，调用过于频繁会占满主线程，触发系统看门狗。调试时只做单次探测 |
| 改动 stub 后 Fastbot 整晚取树失败 | Fastbot 的解析逻辑是闭源的，对返回结构有隐含要求。从日志推断，它至少需要两个窗口才能正常解析，曾经因为跳过键盘窗口导致整晚盲跑。改动 stub 时，必须按调用方的行为来评估影响 |

---

## 九、一次完整运行的时间线

把前面的内容串起来。我们的夜间任务会依次用两个测试账号各跑 5 小时，下面是其中一个账号的时间线：

```
T+0:00   run.py 启动
           ├── 安装注入了 stub 的 IPA
           ├── devicectl 把 UDID 转换成 CoreDevice identifier
           ├── xcodebuild 启动 FastbotRunner（参数写入本次 xctestrun）
           ├── 等待 App 进程出现（最长 90 秒）
           ├── 再等待 20 秒，让 Fastbot 完成初始化
           ├── perf_collector 开始第一段 xctrace 录制
           └── crash_watcher 记录崩溃日志基线，开始轮询

T+0:10   第一段录制结束 → 导出 → 追加写入 perf_raw.jsonl → 开始下一段

T+0:15   Fastbot 触发某条边界路径，App 崩溃并重启
           ├── crash_watcher 在下一个 30 秒轮询中发现新 .ips，拉取并解析
           └── perf_collector 挂载断开，按进程名重新挂载，继续录制

  ...    每 30 秒一次崩溃轮询，每 10 分钟一段性能录制，直到时间用完

T+5:00   时间到
           ├── 停止 Fastbot
           ├── crash_watcher 做最后一次拉取
           ├── perf_collector 收尾最后一段录制
           └── 从设备拉回页面访问日志

T+5:00+  报告生成
           ├── 内存、CPU：计算均值、峰值、分位数、增长趋势和泄漏嫌疑
           ├── 崩溃：去重、计数、区分 Flutter 层和 stub 崩溃
           ├── 页面覆盖率：访问日志对比静态分析出的分母
           ├── 对照阈值配置，给出 PASS / WARN / FAIL
           └── 生成 report.json 和带折线图的 report.html，FAIL 时推送告警
```

整个过程不需要人值守，从启动到拿到结论全部自动完成。两个账号都跑完后，还会把两份覆盖率取并集，生成一份批次汇总报告。

---

## 十、这一篇的关键结论

| 问题 | 答案 |
|------|------|
| tidevice 为什么会失效？ | iOS 17 起开发者磁盘镜像改为个性化签发，tidevice 无法生成，依赖它的 xctest 和 perfmon 全部不可用 |
| 现在用什么驱动 Fastbot？ | `xcodebuild test-without-building`，走 Apple 官方的 CoreDevice 通道 |
| 现在怎么采集性能？ | `xctrace` 按进程名挂载，每 10 分钟一段录制后导出解析，失败自动重试并记录盲区 |
| 内存用哪个口径？ | Physical Footprint，与 Xcode、Instruments 一致；RSS 作为辅助参考 |
| FPS 采了吗？ | 目前没有，Activity Monitor 模板不含 FPS，是后续要补的部分 |
| 崩溃日志怎么拿？ | `devicectl` 每 30 秒轮询系统崩溃日志目录，结束时再做一次最终拉取 |
| .ips 有什么坑？ | 两段独立 JSON，需要先切开再解析 |
| 哪些崩溃报告不算 App 崩溃？ | 系统模拟报告（ExcUserFault）直接排除；stub 引起的崩溃单独计数，只判 WARN |
| 为什么能直接测 Release 包？ | Fastbot 跑在独立的测试进程里，通过系统接口操作 App；stub 以注入方式加入，不改源码 |
| 为什么需要 stub？ | 自定义控件在无障碍树里不可见，stub 在 App 内直接遍历视图树，Fastbot 才能看到并操作它们 |
| 覆盖率的分母从哪来？ | 注入时静态分析安装包：`otool` 读类列表得到原生页面，`strings` 提取 Flutter 路由 |

---

## 下一篇预告

下一篇进入 Android：adb 是怎么工作的，`dumpsys meminfo` 采集的到底是什么内存，以及怎么从源源不断的 logcat 里精准筛出被测 App 的崩溃。Android 和 iOS 的采集方式差异很大，但两边最终产出的是同一套格式的报告，这种"归一化"是怎么做到的，也会一起讲。
