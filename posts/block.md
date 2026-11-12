---
title: __block 关键字探究
date: 2020.09.23
group: iOS
slug: ios-block
summary: 从 __block 修饰符说起,拆解 Block 捕获变量的底层原理。
---

### __block 是干什么用的

```objective-c
int val = 10;   
MyBlock block = ^{
    NSLog(@"val = %d",val);
};
block();
//输出
2020-09-22 14:24:47.018497+0800 MyDemo[2987:2658512] val = 10
```

从一段简单的`code`说起，在`block`中修改val的值该怎么办呢？



直接在`block`中修改会报编译错误`Variable is not assignable (missing __block type specifier)` 

显而易见我们只需要在`val`变量前加`__block`关键字即可。

```objective-c
__block int val = 10;
MyBlock block = ^{
    val += 10;
    NSLog(@"val = %d",val);
};
block();
//输出
2020-09-22 14:29:38.065700+0800 MyDemo[2991:2660066] val = 20
```

现在我们简单的在`block`中修改了`val`的值。

### __block 原理思考推测

so why？现在到了探究其所以然的时候了。



由于`objc`封装的较深，我们可以把`objc`代码转换成`c++`代码一探究竟

```ruby
xcrun -sdk iphoneos clang -arch arm64 -rewrite-objc main.m
```

在`main.m`文件夹内执行这条命令生成一个`main.cpp`的`c++`类

在`xcode`中打开,在该类中搜索`main`方法.

```c++
/*这个时候使用的是这些code
int val = 10;   
MyBlock block = ^{
    NSLog(@"val = %d",val);
};
block();
*/
int main(int argc, char * argv[]) {
    NSString * appDelegateClassName;
    /* @autoreleasepool */ { __AtAutoreleasePool __autoreleasepool; 

        appDelegateClassName = NSStringFromClass(((Class (*)(id, SEL))(void *)objc_msgSend)((id)objc_getClass("AppDelegate"), sel_registerName("class")));
				// 我们声明的auto变量
        int val = 10;
        // 我们声明的block        
        MyBlock block = ((void (*)())&__main_block_impl_0((void *)__main_block_func_0, &__main_block_desc_0_DATA, val));
				// block的调用
        ((void (*)(__block_impl *))((__block_impl *)block)->FuncPtr)((__block_impl *)block);

    }
    return UIApplicationMain(argc, argv, __null, appDelegateClassName);
}
```

我们可以看到`__main_block_impl_0`这个东西，是我们创建的`block`在`c++`里面的实现

```c++
typedef void(*MyBlock)(void);

struct __main_block_impl_0 {
  struct __block_impl impl;
  struct __main_block_desc_0* Desc;
  int val; // 这个地方看到block内部有生成一个对象来保存我们创建的val来使用
  __main_block_impl_0(void *fp, struct __main_block_desc_0 *desc, int _val, int flags=0) : val(_val) {
    impl.isa = &_NSConcreteStackBlock;
    impl.Flags = flags;
    impl.FuncPtr = fp;
    Desc = desc;
  }
};
```

对应的`__block_impl`是block数据结构在c++的实现

```c++
struct __block_impl {
  void *isa; // 由此可见block在底层也是一种objc对象
  int Flags;
  int Reserved;
  void *FuncPtr; // block里保存的函数指针
};
```

我们还能找到我们的`NSLog`方法`__main_block_func_0`

```c++
static void __main_block_func_0(struct __main_block_impl_0 *__cself) {
  int val = __cself->val; // 从自身的结构体中取出val对象来使用
	NSLog((NSString*)&__NSConstantStringImpl__var_folders_j2__3l5gw_93rz1_jfmq7r7wwph0000gn_T_main_18d90f_mi_0,
      val);
}
```

我们从而知道了`block`会捕获`auto`类型的变量到自身的结构体，这时候会生成一个新变量`val`来使用。

虽然捕获到了变量，但是此变量非彼变量，我们并不能在这里修改外部的值。

回想我们遇见的各种类型的`block`我们发现声明为`static`的变量不需要加`__block`就可以直接修改值:

```objective-c
static int staticVal = 10;        
MyBlock block = ^{
    staticVal += 10;
    NSLog(@"staticVal = %d",staticVal);
};
block();
//输出
2020-09-22 14:41:08.103780+0800 MyDemo[3004:2662839] staticVal = 20
```

那么`static`的变量是怎么实现的呢？相应的我们可以看看他在`block`结构体里面到底是怎么做的。

```c++
struct __main_block_impl_0 {
  struct __block_impl impl;
  struct __main_block_desc_0* Desc;
  int *staticVal; // 由此可以看到block拿到了staticVal的指针
  __main_block_impl_0(void *fp, struct __main_block_desc_0 *desc, int *_staticVal, int flags=0) : staticVal(_staticVal) {
    impl.isa = &_NSConcreteStackBlock;
    impl.Flags = flags;
    impl.FuncPtr = fp;
    Desc = desc;
  }
};
// block封装的方法
static void __main_block_func_0(struct __main_block_impl_0 *__cself) {
  int *staticVal = __cself->staticVal; // bound by copy
	(*staticVal) += 10;
  NSLog((NSString *)&__NSConstantStringImpl__var_folders_j2__3l5gw_93rz1_jfmq7r7wwph0000gn_T_main_68799d_mi_0,(*staticVal));
}
```

拿到了指针就是拿到了他,原来`static`类型的变量是这么做的，仔细想想明白反正他会一直存在内存中，只要拿到了他的指针就可以在任意时间访问他而不用担心野指针的问题啦。

那么只要我们想办法能在`block`里面访问`auto变量`的`指针`同时保证这个变量不会被`释放`是不是就能在`block`里面修改变量了呢？

### __block 底层实现验证

现在我们看一下`__block`的`c++`实现

```c++
struct __main_block_impl_0 {
  struct __block_impl impl;
  struct __main_block_desc_0* Desc;
  __Block_byref_val_0 *val; // 我们发现这里增加了一个__Block_byref_val_0 的结构体 并命名为val
  __main_block_impl_0(void *fp, struct __main_block_desc_0 *desc, __Block_byref_val_0 *_val, int flags=0) : val(_val->__forwarding) {
    impl.isa = &_NSConcreteStackBlock;
    impl.Flags = flags;
    impl.FuncPtr = fp;
    Desc = desc;
  }
};
// block封装的方法
static void __main_block_func_0(struct __main_block_impl_0 *__cself) {
  __Block_byref_val_0 *val = __cself->val; // bound by ref
  (val->__forwarding->val) += 10;// 使用val的__forwarding指针来拿val结构体中的val对象进行赋值
  NSLog((NSString *)&__NSConstantStringImpl__var_folders_j2__3l5gw_93rz1_jfmq7r7wwph0000gn_T_main_00193b_mi_0,  	(val->__forwarding->val));
}
```

对于`__Block_byref_val_0`可以找到

```c++
typedef void(*MyBlock)(void);

struct __Block_byref_val_0 {
 void *__isa;
 __Block_byref_val_0 *__forwarding; // 这个指针指向了自身
 int __flags;
 int __size;
 int val;
};
```

我们可以看到block使用了一个对象`__Block_byref_val_0`把`val`对象包住之后进行使用。

但是这个对象里面的val到底是不是我们定义的那个呢？

这里可以把`c++`的结构体拷贝到`objc`中进行一次转换就能拿到这个对象了

```c++
struct __Block_byref_val_0 {
 void *__isa; 
 struct __Block_byref_val_0 *__forwarding; 
 int __flags; 
 int __size;
 int val; 
};

struct __block_impl {
  void *isa;
  int Flags;
  int Reserved;
  void *FuncPtr;
};

static struct __main_block_desc_0 {
  size_t reserved;
  size_t Block_size;
  void (*copy)(void);
  void (*dispose)(void);
};


struct __main_block_impl_0 {
  struct __block_impl impl;
  struct __main_block_desc_0* Desc;
  struct __Block_byref_val_0 *val; // by ref
};

__block int val = 10;

MyBlock block = ^{
    val += 10;
    NSLog(@"val = %d",val);
};

block();

struct __main_block_impl_0 * blockImpl = (__bridge struct __main_block_impl_0 *) block; //这里做一个桥接（对象转换）

NSLog(@"val = %p",&val);
```

然后我们在`debug`的断点进来的时候去找`blockImpl`中val对象的地址,再对比打印出来的`val`的地址

```objective-c
2020-09-22 16:57:00.771793+0800 MyDemo[3028:2688246] val = 20
(lldb) p/x &(blockImpl->val->val)
(int *) $0 = 0x00000002811c36f8
2020-09-22 16:57:05.581925+0800 MyDemo[3028:2688246] val = 0x2811c36f8

```

我们可以看到 `__main_block_impl_0`对象中的`val`对象的`val`字段的地址和我们定义的`val`的地址相同。

至此,我们明白了__block是如何运作的。

### __block是如何保证auto变量不被释放的

从上面来看 我们已经能在block内部拿到auto变量的地址了，那么只要能保证block生命周期中这个变量不会被释放掉就可以实现在block中修改他的值了！看起来离我们的目标不远了。

再把目光投向main.cpp文件,我们可以发现三个方法

```c++
static void __main_block_copy_0(struct __main_block_impl_0*dst, struct __main_block_impl_0*src) {_Block_object_assign((void*)&dst->val, (void*)src->val, 8/*BLOCK_FIELD_IS_BYREF*/);}

static void __main_block_dispose_0(struct __main_block_impl_0*src) {_Block_object_dispose((void*)src->val, 8/*BLOCK_FIELD_IS_BYREF*/);}

static struct __main_block_desc_0 {
  size_t reserved;
  size_t Block_size;
  void (*copy)(struct __main_block_impl_0*, struct __main_block_impl_0*); 
  void (*dispose)(struct __main_block_impl_0*);
}

```

ARC环境下,系统会自动帮我们把在栈中的访问`auto`变量的`block`给`copy`到堆上去。

在执行`copy`方法的时候`block`会执行 `__main_block_copy_ `方法对`__main_block_impl_`对象进行一次强引用。该方法中执行了`_Block_object_assign`对包裹`val`的对象进行`retain`操作,这里恍然大悟,明白为什么`block`容易导致`循环引用`和`内存泄漏`了。

对应的,在`block`将要释放的时候执行`__main_block_dispose_`方法来释放`__main_block_impl_`对象。

### 思考

`__forwarding`指针为什么会指向自己,指向自身的指针是否多余呢？

反过来看，如果在block外部修改掉`__block`修饰的变量的值时`block`内部的`__Block_byref_val_0`的`val`值会跟随改变吗？会改变的话又是怎么实现的呢？

