---
title: iOS Crash类型总结
date: 2023.03.12
group: iOS
slug: ios-crash-types
summary: iOS 崩溃分类总结:Objective-C Exception 与 Unix Signal 的常见类型与成因。
---

iOS APP系统crash主要分两类：一类是Objective-C Exception，一类是Unix Signal Exception。下面详细介绍。

> 崩溃日志路径：~/Library/Logs/CrashReporter/MobileDevice

## 一、Objective-C Exception

例如NSDictionary加入nil、数组访问越界等。主要有如下类型：

### 1. NSInvalidArgumentException

非法参数异常(NSInvalidArgumentException)是Objective-C代码最常出现的错误。平时在写代码时需要多加注意，加强对参数的检查，避免传入非法参数导致异常，其中尤以nil参数为甚。

主要场景包括：

#### 1.1 集合数据的参数传递

比如NSMutableArray、NSMutableDictionary的数据操作：

- NSDictionary不能删除nil的key
- NSDictionary不能添加nil的对象
- 不能插入nil的对象
- 其他一些nil参数

#### 1.2 其他API的使用

APP一般都会有网络操作，免不了使用网络相关接口，比如NSURL的初始化，不能传入nil的http地址。

#### 1.3 未实现的方法

- .h文件里函数名，却忘了修改.m文件里对应的函数名
- 使用第三方库时，没有添加"-ObjC" flag
- MRC时，大部分情况下是因为对象被提前release了，在你心里不希望他release的情况下，指针还在，对象已经不在了

### 2. NSRangeException

越界异常(NSRangeException)也是比较常出现的异常，有如下几种类型：

1. 数组最大下标处理错误
   - 比如数组长度count，index的下标范围[0, count-1]，在开发时，可能index的最大值超过数组的范围
2. 下标的值是其他变量赋值
   - 这样会有很大的不确定性，可能是一个很大的整数值
3. 使用空数组
   - 如果一个数组刚刚初始化，还是空的，就对它进行相关操作

> 为了避免NSRangeException的发生，必须对传入的index参数进行合法性检查，是否在集合数据的个数范围内。

### 3. NSGenericException

NSGenericException这个异常最容易出现在foreach操作中。在for-in循环中如果修改所遍历的数组，无论你是add或remove，都会出错。"for-in"的内部遍历使用了类似Iterator进行迭代遍历，一旦元素变动，之前的元素全部被失效。

> 在foreach的循环当中，最好不要去进行元素的修改动作，若需要修改，循环改为for遍历，由于内部机制不同，不会产生修改后结果失效的问题。

### 4. NSInternalInconsistencyException

不一致导致出现的异常，例如：

- NSDictionary当做NSMutableDictionary来使用，从他们内部的机理来说，就会产生一些错误

```objc
NSMutableDictionary *info = method return to NSDictionary type;
[info setObject:@"sxm" forKey:@"name"];
```

- xib界面使用或者约束设置不当

### 5. NSFileHandleOperationException

处理文件时的一些异常，最常见的还是存储空间不足的问题，比如应用频繁的保存文档，缓存资料或者处理比较大的数据。

> 在文件处理里，需要考虑到手机存储空间的问题。

### 6. NSMallocException

这也是内存不足的问题，无法分配足够的内存空间。

### 7. 其他常见Crash

- KVO相关Crash
  - 移除未注册的观察者
  - 重复移除观察者
  - 添加了观察者但是没有实现 `-observeValueForKeyPath:ofObject:change:context:`方法
  - 添加移除keypath=nil
  - 添加移除observer=nil
- unrecognized selector sent to instance（这种也经常是野指针问题）

## 二、Unix Signal Exception

### 常见信号类型

1. **SIGHUP**

   - 本信号在用户终端连接(正常或非正常)结束时发出
   - 通常是在终端的控制进程结束时，通知同一session内的各个作业
2. **SIGINT**

   - 程序终止(interrupt)信号
   - 在用户键入INTR字符(通常是Ctrl-C)时发出，用于通知前台进程组终止进程
3. **SIGQUIT**

   - 类似SIGINT，但由QUIT字符(通常是Ctrl-)来控制
   - 进程在因收到SIGQUIT退出时会产生core文件
4. **SIGABRT**

   - 调用abort函数生成的信号
5. **SIGBUS**

   - 非法地址，包括内存地址对齐(alignment)出错
   - 与SIGSEGV的区别在于后者是由于对合法存储地址的非法访问触发的
6. **SIGFPE**

   - 致命的算术运算错误信号
   - 包括浮点运算错误、溢出及除数为0等
7. **SIGKILL**

   - 用来立即结束程序的运行
   - 本信号不能被阻塞、处理和忽略
8. **SIGSEGV**

   - 试图访问未分配给自己的内存
   - 试图往没有写权限的内存地址写数据
9. **SIGPIPE**

   - 管道破裂
   - 通常在进程间通信产生

### iOS中常见的系统信号

在iOS crash中主要是SIGKILL、SIGSEGV、SIGABRT、SIGTRAP，引起系统信号crash主要有内存泄露、野指针等。

### 特殊类型Crash

| 错误码     | 含义           | 描述                                                 |
| ---------- | -------------- | ---------------------------------------------------- |
| 0x8badf00d | "ate bad food" | 在启动、终止应用或响应系统事件花费过长时间           |
| 0xdeadfa11 | "dead fall"    | 用户强制退出（系统无响应时，用户按电源开关和HOME）   |
| 0xbaaaaaad | -              | 用户按住Home键和音量键，获取当前内存状态，不代表崩溃 |
| 0xbad22222 | -              | VoIP应用因为恢复得太频繁导致crash                    |
| 0xc00010ff | "cool off"     | 因为太烫了被干掉                                     |
| 0xdead10cc | "dead lock"    | 因为在后台时仍然占据系统资源（比如通讯录）被干掉     |

## 三、Crash解决方案

### 1. Objective-C Exception处理

NSInvalidArgumentException、NSRangeException这一类很好重现，能够复现定位就好解决。需要写代码的时候多做验证，也可以把一些验证写出category，统一使用。

例如数组访问安全封装：

```objc
- (id)safeObjectAtIndex:(NSUInteger)index {
    if (index < self.count) {
        return [self objectAtIndex:index];
    }
    return nil;
}

- (void)safeAddObject:(id)object {
    if (object) {
        [self addObject:object];
    }
}
```

这样代码统一使用，可以避免一些问题。还可以在有异常的时候加入日志或者上报。

### 2. 信号类Crash处理

- 主要通过分析是否是系统crash，还是内存泄露、多线程问题等
- 内存泄露可以通过instrument定位，也可以在Xcode开启zombie选项定位
- retain-cycle可以使用第三方工具检测

### 3. Crash上报机制

实际项目中通常会接入crash上报工具，如腾讯Bugly。这些上报原理是注册对应的处理handleUncaughtException和信号handle：

```objc
// 异常处理
void InstallUncaughtExceptionHandler(void) {
    NSSetUncaughtExceptionHandler(&handleUncaughtException);
}

void handleUncaughtException(NSException *exception) {
    NSString *crashInfo = [NSString stringWithFormat:@"Exception name：%@\nException reason：%@\nException stack：%@",
                          [exception name], 
                          [exception reason], 
                          [exception callStackSymbols]];
    [CrashReporter saveCrash:crashInfo];
}

// 信号监听
void InstallSignalHandler(void) {
    signal(SIGHUP, handleSignalException);
    signal(SIGINT, handleSignalException);
    signal(SIGQUIT, handleSignalException);
    signal(SIGABRT, handleSignalException);
    signal(SIGILL, handleSignalException);
    signal(SIGSEGV, handleSignalException);
    signal(SIGFPE, handleSignalException);
    signal(SIGBUS, handleSignalException);
    signal(SIGPIPE, handleSignalException);
}

void handleSignalException(int signal) {
    NSMutableString *crashInfo = [[NSMutableString alloc] init];
    [crashInfo appendString:[NSString stringWithFormat:@"signal:%d\n", signal]];
    [crashInfo appendString:@"Stack:\n"];
  
    void *callstack[128];
    int frames = backtrace(callstack, 128);
    char **strs = backtrace_symbols(callstack, frames);
  
    for (int i = 0; i < frames; ++i) {
        [crashInfo appendFormat:@"%s\n", strs[i]];
    }
  
    [CrashReporter saveCrash:crashInfo];
}
```

这样crash的时候存储crash信息，然后再次启动对应上报。

> 注意：还有一些激进的处理方法，hook系统对应函数不让app crash。但即便不crash，出了问题app体验也不好了，也可能用不了了。建议谨慎使用这种方案。
