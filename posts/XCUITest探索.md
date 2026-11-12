---
title: XCUITest iOS自动化UI测试框架
date: 2022.02.28
group: Tools
slug: xcuitest
summary: XCUITest 入门:基于 XCTest 与 Accessibility 的 iOS UI 自动化测试。
---

## XCUITest简介

XCUITest是Apple提供的内嵌到xcode中的一套UI自动化测试框架。

>UI测试依赖于两项核心技术:XCTest框架和Accessibility。
>
>XCTest提供了UI测试功能的框架，与Xcode集成在一起。创建和使用UI测试扩展了您对使用XCTest和创建单元测试的了解。您创建了一个UI测试目标，并将创建UI测试类和UI测试方法作为项目的一部分。您可以使用XCTest断言来验证预期结果是否为真。你也可以通过Xcode Server和xcodebuild实现持续集成。XCTest与Objective-C和Swift完全兼容。
>
>Accessibility是一项核心技术，它允许残疾用户获得与其他用户相同的iOS和macOS丰富体验。它包含了一组丰富的UI语义数据，用户可以使用它来指导他们使用你的应用。可访问性集成了UIKit和AppKit，并有api允许你调整行为和对外公开的使用。UI测试使用这些数据来执行其功能。
>
>在源代码中创建UI测试类似于创建单元测试。你为你的应用创建一个UI测试目标;然后Xcode为你创建一个默认的UI测试组和实现文件，在实现文件中有一个示例测试方法模板。在创建UI测试目标时，可以指定测试要处理的应用程序。



[User Interface Testing](https://developer.apple.com/library/archive/documentation/DeveloperTools/Conceptual/testing_with_xcode/chapters/09-ui_testing.html#//apple_ref/doc/uid/TP40014132-CH13-DontLinkElementID_8)

[WWDC15 Session笔记 - Xcode 7 UI 测试初窥](https://onevcat.com/2015/09/ui-testing/)

## 添加target

以前在新建项目的时候可以看到自带单元测试和UI测试。新版本的XCode新建项目的时候可以看到Incloud Tests的选项，勾中这个选项就可以创建出来带单元测试和UI测试的target。

![](https://cdn.zcx.info/e6c9d24ely1gzt95s1si1j20kq0eodge.jpg)

![自动创建了test有关的Target](https://cdn.zcx.info/e6c9d24ely1gzt95u7e5qj20ea0ajjrx.jpg)

当然如果是以前就创建的项目也可以单独添加UI Test的Target。

## 编写测试代码

>UI 测试在基本方面不同于单元测试。单元测试使您能够在应用程序的范围内工作，并允许您在完全访问应用程序变量和状态的情况下练习函数和方法。UI 测试以与用户在不访问应用程序的内部方法、函数和变量的情况下执行相同的方式来测试应用程序的 UI。这使您的测试能够以与用户相同的方式查看应用程序，从而暴露用户遇到的 UI 问题。
>
>您的测试代码作为一个单独的进程运行，综合应用程序中的 UI 响应的事件。

编写测试代码不是一件容易的事情，由于UITest不能侵入代码逻辑，仅仅使用识别界面上的控件后发送事件来驱动APP，所以测试代码的编写逻辑趋向于查询屏幕上显示的控件，找到满足条件的控件，发送控件支持的事件，等待事件响应后使用断言或者期望断言来判断是否达到了预期的测试结果。

以36氪直播间内预约直播的过程为例：

~~~swift
func testSubscribeLiveInLiveHome() {
  	//获取APP实例
    let app = XCUIApplication()
 		//启动APP
    app.launch()
  	//这里延迟了1s来等待APP启动项配置加载
    sleep(1)
  	//查询所有tabbar，筛选包含直播文字的底导，点击
    app.tabBars["标签页栏"].buttons["直播"].tap()
  	//查询APP上显示的scrollViews上的控件
    let elementsQuery = app.scrollViews.otherElements 
  	//点击包含直播文字的按钮 
    elementsQuery.staticTexts["直播"].tap()
 	 	//查询并点击APP上显示collectionViews中包含即将开播文字的按钮
    elementsQuery.collectionViews.staticTexts["即将开播"].tap()
 	 	//延迟1s等待APP加载即将开播列表
    sleep(1)
  	//找到第一个包含预约文字的cell，这里如果已经预约则不显示预约文字
    app.collectionViews.cells.otherElements.containing(.staticText, identifier:"预约").element(boundBy: 0).tap()
  	//延迟1s等待APP加载直播间
    sleep(1)
 	 //查询并点击包含预约直播文字的按钮
    elementsQuery.staticTexts["预约直播"].tap()
 	 //创建期望断言判断已预约文案是否存在，预约成功会修改按钮文案
    let result = app.staticTexts["已预约"]
    expectation(for: NSPredicate(format: "exists >= 1"), evaluatedWith: result, handler: nil)
    waitForExpectations(timeout: 3, handler: nil)
}
~~~

这样就写好了一个直播间预约的测试流程。

可以看出测试代码的编写还是很繁琐的，写功能的同时几乎没有足够的时间再编写一套对应的测试代码。而且功能还会随着项目的迭代不断变化，同时维护功能代码和测试代码的成本是巨大的。

但是一些变化概率低的核心路径还是建议使用自动化测试来解放双手降低重复工作量。

## 录制测试代码

有时候不知道怎么查询具体某个控件的时候可以借用XCode上的录制功能。

把光标移入测试代码方法大括号内部空白处可以看到左下角有个红色圆点亮了起来，点击红色圆点及开启录制功能。

录制功能可以记录你手动点击的路径和流程，自动计算出操作路径的代码。但是计算结果可能不是一个通用的路径，所以还需要开发者自行调整。

## 执行测试脚本

执行上面的测试方法，xcode会自动编译、运行你的APP，并会输出具体的测试结果。

```Swift
Test Case '-[ClientUITests.ClientUITestsLaunchTests testSubscribeLiveInLiveHome]' started.
    t =     0.00s Setting appearance mode to Light
    t =     2.08s     Wait for com.apple.springboard to idle
    t =    62.18s Start Test at 2022-02-25 15:18:37.506
    t =    62.27s Set Up
    t =    62.28s Open com.zcx.iosclient
    t =    62.35s     Launch com.zcx.iosclient
    t =    66.50s         Setting up automation session
    t =    67.71s         Wait for com.zcx.iosclient to idle
    t =    70.00s Tap "直播" Button
    t =    70.00s     Wait for com.zcx.iosclient to idle
    t =    71.77s     Find the "直播" Button
    t =    72.10s     Check for interrupting elements affecting "直播" Button
    t =    72.14s     Synthesize event
    t =    72.30s     Wait for com.zcx.iosclient to idle
    t =    72.42s Tap "直播" StaticText
    t =    72.42s     Wait for com.zcx.iosclient to idle
    t =    72.49s     Find the "直播" StaticText
    t =    72.52s     Check for interrupting elements affecting "直播" StaticText
    t =    72.53s     Synthesize event
    t =    72.67s     Wait for com.zcx.iosclient to idle
    t =    72.75s Tap "即将开播" StaticText
    t =    72.75s     Wait for com.zcx.iosclient to idle
    t =    72.81s     Find the "即将开播" StaticText
    t =    73.85s         Find the "即将开播" StaticText (retry 1)
    t =    73.91s     Check for interrupting elements affecting "即将开播" StaticText
    t =    73.93s     Synthesize event
    t =    74.07s     Wait for com.zcx.iosclient to idle
    t =    75.66s Tap Other
    t =    75.66s     Wait for com.zcx.iosclient to idle
    t =    75.74s     Find the Other
    t =    75.81s     Check for interrupting elements affecting Other
    t =    75.83s     Synthesize event
    t =    75.98s     Wait for com.zcx.iosclient to idle
    t =    77.58s Tap "预约直播" StaticText
    t =    77.58s     Wait for com.zcx.iosclient to idle
    t =    77.68s     Find the "预约直播" StaticText
    t =    77.78s     Check for interrupting elements affecting "预约直播" StaticText
    t =    77.81s     Synthesize event
    t =    77.97s     Wait for com.zcx.iosclient to idle
    t =    79.10s Checking `Expect predicate `exists >= 1` for object "已预约" StaticText`
    t =    79.10s     Checking existence of `"已预约" StaticText`
    t =    79.17s Tear Down
Test Case '-[ClientUITests.ClientUITestsLaunchTests testSubscribeLiveInLiveHome]' passed (79.370 seconds).
Test Case '-[ClientUITests.ClientUITestsLaunchTests testSubscribeLiveInLiveHome]' started.
    t =     0.00s Setting appearance mode to Dark
    t =     2.10s     Wait for com.zcx.iosclient to idle
    t =     2.19s Start Test at 2022-02-25 15:18:56.883
    t =     2.26s Set Up
    t =     2.26s Open com.zcx.iosclient
    t =     2.33s     Launch com.zcx.iosclient
    t =     2.33s         Terminate com.zcx.iosclient:21694
    t =     4.44s         Setting up automation session
    t =     5.53s         Wait for com.zcx.iosclient to idle
    t =     7.76s Tap "直播" Button
    t =     7.76s     Wait for com.zcx.iosclient to idle
    t =     9.30s     Find the "直播" Button
    t =     9.53s     Check for interrupting elements affecting "直播" Button
    t =     9.57s     Synthesize event
    t =     9.72s     Wait for com.zcx.iosclient to idle
    t =     9.86s Tap "直播" StaticText
    t =     9.86s     Wait for com.zcx.iosclient to idle
    t =     9.94s     Find the "直播" StaticText
    t =     9.96s     Check for interrupting elements affecting "直播" StaticText
    t =     9.97s     Synthesize event
    t =    10.12s     Wait for com.zcx.iosclient to idle
    t =    10.21s Tap "即将开播" StaticText
    t =    10.21s     Wait for com.zcx.iosclient to idle
    t =    10.27s     Find the "即将开播" StaticText
    t =    11.29s         Find the "即将开播" StaticText (retry 1)
    t =    11.39s     Check for interrupting elements affecting "即将开播" StaticText
    t =    11.42s     Synthesize event
    t =    11.57s     Wait for com.zcx.iosclient to idle
    t =    13.18s Tap Other
    t =    13.18s     Wait for com.zcx.iosclient to idle
    t =    13.26s     Find the Other
    t =    13.33s     Check for interrupting elements affecting Other
    t =    13.35s     Synthesize event
    t =    13.51s     Wait for com.zcx.iosclient to idle
    t =    15.09s Tap "预约直播" StaticText
    t =    15.09s     Wait for com.zcx.iosclient to idle
    t =    15.29s     Find the "预约直播" StaticText
    t =    15.39s     Check for interrupting elements affecting "预约直播" StaticText
    t =    15.41s     Synthesize event
    t =    15.58s     Wait for com.zcx.iosclient to idle
    t =    16.67s Checking `Expect predicate `exists >= 1` for object "已预约" StaticText`
    t =    16.67s     Checking existence of `"已预约" StaticText`
    t =    16.74s Tear Down
Test Case '-[ClientUITests.ClientUITestsLaunchTests testSubscribeLiveInLiveHome]' passed (16.947 seconds).

Test Suite 'ClientUITestsLaunchTests' passed at 2022-02-25 15:19:11.642.
Executed 2 tests, with 0 failures (0 unexpected) in 96.317 (96.319) seconds

Test Suite 'ClientUITests.xctest' passed at 2022-02-25 15:19:11.644.
Executed 2 tests, with 0 failures (0 unexpected) in 96.317 (96.321) seconds

Test Suite 'Selected tests' passed at 2022-02-25 15:19:11.647.
Executed 2 tests, with 0 failures (0 unexpected) in 96.317 (96.324) seconds
     
```
