---
title: NSCache
date: 2021.04.20
group: iOS
slug: ios-nscache
summary: NSCache 精读:自动淘汰策略、线程安全,以及与 NSDictionary 的区别。
---

## NSCache

### Introduction

> A mutable collection you use to temporarily store transient key-value pairs that are subject to eviction when resources are low.

一种用于临时存储临时键值对的可变集合，在资源不足时容易被回收。

> Cache objects differ from other mutable collections in a few ways:
> The NSCache class incorporates various auto-eviction policies, which ensure that a cache doesn’t use too much of the system’s memory. If memory is needed by other applications, these policies remove some items from the cache, minimizing its memory footprint.
> You can add, remove, and query items in the cache from different threads without having to lock the cache yourself.
> Unlike an NSMutableDictionary object, a cache does not copy the key objects that are put into it.
> You typically use NSCache objects to temporarily store objects with transient data that are expensive to create. Reusing these objects can provide performance benefits, because their values do not have to be recalculated. However, the objects are not critical to the application and can be discarded if memory is tight. If discarded, their values will have to be recomputed again when needed.
> Objects that have subcomponents that can be discarded when not being used can adopt the NSDiscardableContent protocol to improve cache eviction behavior. By default, NSDiscardableContent objects in a cache are automatically removed if their content is discarded, although this automatic removal policy can be changed. If an NSDiscardableContent object is put into the cache, the cache calls discardContentIfPossible() on it upon its removal.

缓存对象与其他可变集合在以下几个方面有所不同:

**自动回收**： NSCache类包含各种自动回收策略，这些策略确保缓存不会使用太多的系统内存。如果其他应用程序需要内存，这些策略会从缓存中删除一些项，从而最小化其内存占用。

**线程安全**：可以从不同的线程在缓存中添加、删除和查询项，而不必自己锁定缓存。

**Key无需实现NSCopying**：与NSMutableDictionary对象不同，缓存不会复制放入其中的key对象，降低内存占用。

**不能长久储存数据**： 您通常使用NSCache对象来临时存储带有临时数据的对象，这些数据的创建成本很高。重用这些对象可以提供性能优势，因为它们的值不必重新计算。但是，这些对象对应用程序并不重要，如果内存紧张，可以丢弃这些对象。如果丢弃，它们的值将不得不在需要时重新计算。

**NSDiscardableContent 在NSCache中不会强引用**：具有子组件的对象在不使用时可以被丢弃，可以采用NSDiscardableContent 协议来改进缓存回收行为。默认情况下，如果缓存中的NSDiscardableContent 对象的内容被丢弃，那么它们将被自动删除，尽管这个自动删除策略可以更改。如果一个NSDiscardableContent 对象被放入缓存，缓存在它被删除时调用discardContentIfPossible()。

（一般不用可丢弃对象包裹，直接使用方法保存原始obj就行）

### Values & Methods

```objective-c
#import <Foundation/NSObject.h>

@class NSString;
@protocol NSCacheDelegate;

NS_ASSUME_NONNULL_BEGIN

API_AVAILABLE(macos(10.6), ios(4.0), watchos(2.0), tvos(9.0))
@interface NSCache <KeyType, ObjectType> : NSObject {
@private
    id _delegate;
    void *_private[5];
    void *_reserved;
}

@property (copy) NSString *name; // 用来管理区分cache对象的名字

@property (nullable, assign) id<NSCacheDelegate> delegate;

- (nullable ObjectType)objectForKey:(KeyType)key; // 取数据
- (void)setObject:(ObjectType)obj forKey:(KeyType)key; // 0 cost 缓存数据
- (void)setObject:(ObjectType)obj forKey:(KeyType)key cost:(NSUInteger)g; // 缓存数据 cost值设置的消耗内存大小
- (void)removeObjectForKey:(KeyType)key;// 移除数据

- (void)removeAllObjects;// 移除所有数据

@property NSUInteger totalCostLimit;	// limits are imprecise/not strict 限制缓存数量
@property NSUInteger countLimit;	// limits are imprecise/not strict 限制缓存保存数大小（cost）
@property BOOL evictsObjectsWithDiscardedContent; // 是否自动回收

@end

@protocol NSCacheDelegate <NSObject>
@optional
- (void)cache:(NSCache *)cache willEvictObject:(id)obj; // 回收内存的时候调用代理的方法
@end

NS_ASSUME_NONNULL_END

```
