---
title: runloop 学习笔记
date: 2020.09.25
group: iOS
slug: ios-runloop
summary: 从「RunLoop 和线程是什么关系」出发,梳理 RunLoop 的运行机制与应用。
---

### 从一个问题开始

Runloop 和线程有什么关系？

`Runloop` 和 `线程`是密不可分的，可以说Runloop是为线程而生的。线程和runloop是`一一对应的`，我们只可以在当前线程内操控当前线程对应的Runloop。

Runloop是懒加载的在线程`第一次`获取他的时候创建，在线程`结束`的时候销毁。

主线程的runloop是默认启动的，因为主线程需要一直监听事件。子线程的Runloop默认是不启动的，需要手动开启循环。



### Runloop 的作用？

保持程序的运行，主线程的runloop使得APP不会退出

响应并处理APP中的事件，用户交互、定时任务等

节省cpu资源，按需运行，提升程序性能

### Runloop的运行过程

Run Loop本质是一个处理事件源的循环。我们对Run Loop的运行时具有控制权，如果当前没有时间发生，Run Loop会让当前线程进入睡眠模式，来减轻CPU压力。如果有事件发生，Run Loop就处理事件并通知相关的Observer。具体的顺序如下:

1) Run Loop进入的时候，会通知Observer

2) Timer即将被触发时，会通知Observer

3) 有其它非Port-Based Input Source即将被触发时，会通知Observer

4) 启动非Port-Based Input Source的事件源

5) 如果基于Port的Input Source事件源即将触发时，立即处理该事件，并跳转到9

6) 通知Observer当前线程进入睡眠状态

7) 将线程置入睡眠状态直到有以下事件发生：1. Port-Based Input Source被触发。2.Timer被触发。 3.Run Loop设置的时间已经超时。 4.Run Loop被显式唤醒。

8) 通知Observer线程将要被唤醒

9) 处理被触发的事件：1. 如果是用户自定义的Timer，处理Timer事件后重启Run Loop并直接进入步骤2。 2.如果线程被显示唤醒又没有超时，那么进入步骤2。 3.如果是其他Input Source事件源有事件发生，直接传递这个消息。

10) 通知Observer Run Loop结束，Run Loop退出。

### Runloop的mode

runloop有下可以有多个模式，但是同一时间只能有一个模式在运行；

常用的模式有以下3种:

1) NSDefaultRunLoopMode: 大多数工作中默认的运行方式。

2) UITrackingRunLoopMode: 使用这个Mode去跟踪来自用户交互的事件（比如UITableView上下滑动）。

3) NSRunLoopCommonModes: 这是一个伪模式，其为一组run loop mode的集合。如果将Input source加入此模式，意味着关联Input source到Common Modes中包含的所有模式下。在iOS系统中NSRunLoopCommonMode包含NSDefaultRunLoopMode、UITrackingRunLoopMode.

runloop运行在某一指定模式下，就意味着input源或者time源只能在该模式下运行

