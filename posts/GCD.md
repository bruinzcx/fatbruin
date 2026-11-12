---
title: GCD相关知识学习笔记
date: 2020.09.22
group: iOS
slug: ios-gcd
summary: 写给未来自己的 GCD 速查:队列与任务的组合、死锁成因与预防。
---

致未来的我：你是不是有点忘记了GCD的一些知识？恰巧这几天我有看这些，让我给你讲讲吧？
GCD是基于C语言的API，开发者只需要将任务放在block内，并指定好追加的队列，就可以完成多线程开发.

## 知识点速览
1.队列： 串行队列、并发队列

2.任务： 同步任务、异步任务

3.队列和任务的交叉组合使用

4.死锁的产生和预防



### 队列
Dispatch Queue是执行处理的等待队列，按照任务（block）追加到队列里的顺序，先进先出执行处理。

而等待队列有两种

Serial Dispatch Queue：串行队列，等待当前执行任务处理结束的队列。

Concurrent Dispatch Queue:并发队列，不等待当前执行任务处理结束的队列

那么如何创建一个新队列呢

```
//创建了串行队列
dispatch_queue_t serailQueue = dispatch_queue_create("Test_SERIAL_GCD_Queue", DISPATCH_QUEUE_SERIAL);
//创建了并行队列
dispatch_queue_t concurrentQueue = dispatch_queue_create("Test_CONCURRENT_GCD_Queue", DISPATCH_QUEUE_CONCURRENT);

```

另外系统自带的两个队列
主队列：mainqueen, APP启动随之启动的一个操作队列
全局队列：golobalQueue, Apple为开发者预设的一个全局并发队列，任务较为简单没有新建队列的需求的时候 可以直接在全局队列执行任务
```
//获取到了主队列
dispatch_queue_t mainQueue = dispatch_get_main_queue();
//获取到了全局队列 （默认优先级，第二个参数暂时没用）
dispatch_queue_t golobalQueue = dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0);
```
### 任务
GCD的任务是以封装好的block的形式来执行的
任务分为 同步任务和异步任务

同步任务：一种追加到队列中按照追加顺序执行的任务，当前任务未执行完毕时会等待其执行完毕再开始自己的任务, 使用 dispatch_sync 来追加任务
例如 给全局队列追加一个同步任务：
```Objective-C
dispatch_sync(golobalQueue, ^{
    [self logCurrentThreadNameWith:@"我是golobalQueue的同步任务一"];
});
```

异步任务：追加到队列中不再等待当前任务执行完毕而直接开始执行的任务，一般会开启一个新的线程，但是线程不会无限制的创建, 使用 dispatch_async 来追加任务
例如 给全局队列追加一个异步任务：
``` Objective-C
// 主队列异步会等待主队列的任务执行完了再执行
dispatch_async(golobalQueue, ^{
    [self logCurrentThreadNameWith:@"我是golobalQueue的异步任务一"];
});
```

### 队列和任务的组合

串行队列+同步任务

```
//给串行队列增加两个同步任务
dispatch_sync(serailQueue, ^{
    [self logCurrentThreadNameWith:@"我是串行队列serailQueue的同步任务一"];
});

dispatch_sync(serailQueue, ^{
    [self logCurrentThreadNameWith:@"我是串行队列serailQueue的同步任务二"];
});
```
串行队列的同步任务会按照添加的次序在当前线程依次执行

```
2020-09-22 00:30:08.334655+0800 MyDemo[75669:3948525] 我是串行队列serailQueue的同步任务一当前线程: <NSThread: 0x6000023ec780>{number = 1, name = main}
2020-09-22 00:30:08.335000+0800 MyDemo[75669:3948525] 我是串行队列serailQueue的同步任务二当前线程: <NSThread: 0x6000023ec780>{number = 1, name = main}
```
因为是在主线程给串行队列追加的同步任务，所以可以看到两个任务在主线程里依次执行

串行队列+并行任务

```
//给串行队列增加两个异步任务
dispatch_async(serailQueue, ^{
    [self logCurrentThreadNameWith:@"我是串行队列serailQueue的异步任务一"];
});

dispatch_async(serailQueue, ^{
    [self logCurrentThreadNameWith:@"我是串行队列serailQueue的异步任务二"];
});
```
串行队列的异步任务会新开一条线程然后按照添加的次序执行
```
2020-09-22 00:30:08.335765+0800 MyDemo[75669:3949753] 我是串行队列serailQueue的异步任务一当前线程: <NSThread: 0x6000023d7980>{number = 11, name = (null)}
2020-09-22 00:30:08.336010+0800 MyDemo[75669:3949753] 我是串行队列serailQueue的异步任务二当前线程: <NSThread: 0x6000023d7980>{number = 11, name = (null)}
```
虽然在主线程追加的任务，但是异步任务会开启一条新线程执行，再看两次打印的线程地址相同，可得知串行队列的异步任务只会开启一条新线程执行异步任务

并发队列+同步任务

```
//给并行队列增加两个同步任务
dispatch_sync(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的同步任务一"];
});

dispatch_sync(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的同步任务二"];
});
```
并发队列的同步任务依旧会在当前线程按照添加次序执行
```
2020-09-22 00:30:08.335258+0800 MyDemo[75669:3948525] 我是并行队列concurrentQueue的同步任务一当前线程: <NSThread: 0x6000023ec780>{number = 1, name = main}
2020-09-22 00:30:08.335446+0800 MyDemo[75669:3948525] 我是并行队列concurrentQueue的同步任务二当前线程: <NSThread: 0x6000023ec780>{number = 1, name = main}
```
因为是在主线程给并发队列追加的同步任务，所以可以看到两个任务在主线程里依次执行

并发队列+异步任务

```
//给并行队列增加两个异步任务
dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务一"];
    [self logThreadRunSomeTimeWith:3 TaskName:@"异步任务一"];
});

dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务二"];
    [self logThreadRunSomeTimeWith:2 TaskName:@"异步任务二"];
});
```
```
2020-09-22 00:37:23.038545+0800 MyDemo[75770:3956315] 我是并行队列concurrentQueue的异步任务一当前线程: <NSThread: 0x600002a900c0>{number = 4, name = (null)}
2020-09-22 00:37:23.038552+0800 MyDemo[75770:3956312] 我是并行队列concurrentQueue的异步任务二当前线程: <NSThread: 0x600002addf40>{number = 5, name = (null)}
```

并发队列的异步任务会立即开启新线程执行，可以看到两个任务所在的线程是不一致的


### 死锁的产生和预防
死锁就是队列引起的循环等待

一个最常见的例子：主队列追加同步任务
```
- (void)viewDidLoad {
    [super viewDidLoad];
    
    dispatch_sync(dispatch_get_main_queue(), ^{
       
        NSLog(@"deallock");
    });
    // Do any additional setup after loading the view, typically from a nib.
}
```

在主线程中运用主队列同步，也就是把任务放到了主线程的队列中。
同步对于任务是立刻执行的，那么当把任务放进主队列时，它就会立马执行,只有执行完这个任务，viewDidLoad才会继续向下执行。
而viewDidLoad和任务都是在主队列上的，由于队列的先进先出原则，任务又需等待viewDidLoad执行完毕后才能继续执行，viewDidLoad和这个任务就形成了相互循环等待，就造成了死锁。
想避免这种死锁，可以将同步改成异步dispatch_async,或者将dispatch_get_main_queue换成其他串行或并行队列，都可以解决。

复杂一点的例子: 串行队列异步任务中嵌套了同一个队列的同步任务
```
dispatch_queue_t serialQueue = dispatch_queue_create("Test_SERIAL_GCD_Queue", DISPATCH_QUEUE_SERIAL);

dispatch_async(serialQueue, ^{
    
    dispatch_sync(serialQueue, ^{
        
        NSLog(@"deadlock");
    });
});
```

外面的函数无论是同步还是异步都会造成死锁。
这是因为里面的任务和外面的任务都在同一个serialQueue队列内，又是同步，这就和上边主队列同步的例子一样造成了死锁
解决方法也和上边一样，将里面的同步改成异步dispatch_async,或者将serialQueue换成其他串行或并行队列，都可以解决

而两个不同的串行队列嵌套则不会产生死锁，且两个队列追加的任务在同一个线程中执行
```
dispatch_queue_t serialQueueA= dispatch_queue_create("TestA_SERIAL_GCD_Queue", DISPATCH_QUEUE_SERIAL);
dispatch_queue_t serialQueueB = dispatch_queue_create("TestB_SERIAL_GCD_Queue", DISPATCH_QUEUE_SERIAL);

dispatch_async(serialQueueA, ^{
       
    dispatch_sync(serialQueueB, ^{
        
        NSLog(@"deadlock");
    });
});
```

### 栅栏任务和延时任务

栅栏任务：等待栅栏之前的异步任务都执行完毕了之后再执行此任务
举个栗子：

```Objectivc-C
//给并行队列增加两个异步任务
dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务一"];
    [self logThreadRunSomeTimeWith:3 TaskName:@"异步任务一"];
});

dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务二"];
    [self logThreadRunSomeTimeWith:2 TaskName:@"异步任务二"];
});

//给并行队列增加栅栏任务 栅栏任务会等待之前所有的异步任务完成后才执行
dispatch_barrier_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的栅栏任务"];
});

dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务三"];
    dispatch_async(mainQueue, ^{
        [self logCurrentThreadNameWith:@"concurrentQueue异步任务回到主队列追加任务"];
        [self logThreadRunSomeTimeWith:2 TaskName:@"回到主队列的异步任务"];
    });
});

dispatch_async(concurrentQueue, ^{
    [self logCurrentThreadNameWith:@"我是并行队列concurrentQueue的异步任务四"];
    [self logThreadRunSomeTimeWith:4 TaskName:@"异步任务四"];
});
```

```
2020-09-22 00:37:23.038545+0800 MyDemo[75770:3956315] 我是并行队列concurrentQueue的异步任务一当前线程: <NSThread: 0x600002a900c0>{number = 4, name = (null)}
2020-09-22 00:37:23.038552+0800 MyDemo[75770:3956312] 我是并行队列concurrentQueue的异步任务二当前线程: <NSThread: 0x600002addf40>{number = 5, name = (null)}
2020-09-22 00:37:26.045128+0800 MyDemo[75770:3956315] 我是并行队列concurrentQueue的栅栏任务当前线程: <NSThread: 0x600002a900c0>{number = 4, name = (null)}
2020-09-22 00:37:26.045309+0800 MyDemo[75770:3956315] 我是并行队列concurrentQueue的异步任务三当前线程: <NSThread: 0x600002a900c0>{number = 4, name = (null)}
2020-09-22 00:37:26.045323+0800 MyDemo[75770:3956312] 我是并行队列concurrentQueue的异步任务四当前线程: <NSThread: 0x600002addf40>{number = 5, name = (null)}
```
延时任务：使用GCD的延时任务比较简单

```
dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), mainQueue, ^{
    [self logCurrentThreadNameWith:@"2秒后异步追加的任务执行"];
});
```

## 总结
同步任务不具备开启新线程的能力 异步任务总是会开启新线程
串行队列中无论是否开启了新线程 都会按照指定的顺序执行

如果执行同步任务则阻塞任务的线程 执行异步任务则不会阻塞任务所在的线程
串行队列中的异步任务即使开启了新线程也会因为队列的串行限制而一个一个按顺序执行，所以只需要开启一条新线程就能够满足需求
并发队列中的同步任务在当前线程去执行

为了方便程序员的使用,苹果提供了全局队列:dispatch_get_global_queue(0, 0)
全局队列是一个并发队列(concurrent)
在使用多线程开发时,如果对队列没有特殊需求,在执行异步任务时,可以直接使用全局队列

队列相当于一个线程的调度器 串行队列总是在当前线程去进行任务调度 并发队列会对异步任务开启新线程

## 感悟
通过我今天对GCD的学习，我觉得之前总是有许多自己给自己设置的学习障碍，一个大概只需要两个小时就能搞明白的知识为什么不静下心来去看看呢？
不会的技术并不是难以跨越的大山，只要用心钻研，就一定会有所收获。
好了，看到这里了，未来的我有什么要给我补充的吗？