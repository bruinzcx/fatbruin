---
title: iOS-i18n动态化思考
date: 2025.03.27
group: iOS
slug: ios-i18n-dynamic
summary: 支持 18+ 语言的教育 App:在系统 .strings 之上叠加动态 JSON 多语的设计与反思。
---

## 一、项目背景

在全球化业务快速发展的背景下，我们的教育类应用需要支持18+语言、覆盖100+国家地区的本地化需求。

## 二、现状分析

目前iOS端在基于系统级的.String文件支持多语能力的基础上又增加了一层动态Json多语。

为了获取动态修复多语的能力，我们额外实现了一套动态拉取多个scope下的18种语言json的功能。支持server、本地文件、内存三级缓存。

在根据多语key提取文本时会先到动态多语模块去查询，如果查不到目标字符串则会回退到系统NSLocalizedString获取文本。

主要实现特点：

```objective-c
// 内存管理核心逻辑
- (NSDictionary *)getCurrentLanguagesData {
    NSMutableDictionary *stableLanguages = [NSMutableDictionary dictionary];
    [self.subScopes enumerateObjects...]; // 全量合并多语数据
    return stableLanguages; // 产生内存峰值
}
```

现存问题 ：

i18n模块在设计阶段为了获取动态化能力投入了较多的资源。但是后期在应用阶段发现其动态化能力并未带来很大的收益。并且在经历了大批量的本地多语修改需求后发现在这种场景下需要考虑双倍的更新成本。

一个版本的APP发布后其内部使用的多语K-V也基本固定，所谓的动态化的能力仅仅是为了支持动态下发多语做热更新。在长时间的迭代和实践中发现多语热更新的次数较少，对文本翻译的调整的优先级也不高，可以接受发版更新。

由于支持热更新，我们在开发阶段对多语翻译的准入标准也逐渐劣化，甚至出现了一个版本发布前不做多语走查直接上线依赖动态能力再热修的情况。

而且随着下发的json逐渐增大，APP的启动周期内加载动态多语的开销也逐渐增大，目前纯json数据已经有5mb左右，全量加载到内存中需要消耗的内存会更多。所以这里考虑将内存加载Json替换为系统级的使用Bundle获取数据以减轻内存压力。

## 三、技术方案对比

### 1. 内存JSON方案

```objective-c
// 当前实现方式
- (void)syncSubscopesWithHashId:(NSString *)hashId 
                      timestamp:(NSString *)timestamp
                         config:(UGI18NConfigModel *)i18nConfig {
    // 内存合并逻辑...
}
```

优势 ：热更新即时生效 劣势 ：内存占用高，无法利用系统优化

### 2. 动态Bundle方案

```objective-c
// 新增动态Bundle支持
@property (nonatomic, strong) NSMutableArray<NSBundle *> *dynamicBundles;

- (NSString *)localizedStringForKey:(NSString *)key {
    for (NSBundle *bundle in _dynamicBundles) {
        NSString *value = [bundle localizedStringForKey:key value:nil table:nil];
        if (value) return value;
    }
    return [super localizedStringForKey:key];
}
```

优势 ：

- 系统级内存管理
- 支持模块化更新
- 无缝兼容Xcode

## 四、动态Bundle方案设计

### 架构设计

* 动态bundle代替内存json缓存
* 系统bundle做静态兜底
* 业务模块无感直接调用

### 核心实现

**1. 动态加载器（UGI18NScope扩展）**

```
// 动态Bundle管理
- (void)loadDynamicBundles {
    NSString *path = [NSSearchPath...];
    NSArray *langDirs = [fm contentsOfDirectoryAtPath:path];
  
    for (NSString *dir in langDirs) {
        if ([dir.pathExtension isEqualToString:@"lproj"]) {
            NSBundle *bundle = [NSBundle bundleWithPath:...];
            [_dynamicBundles addObject:bundle];
        }
    }
}
```

**2. 读写分离机制**

* 读路径：MainBundle → DynamicBundles 链式查询
* 写路径：Python脚本生成标准.lproj结构

3. 更新流程

```
[SSZipArchive unzipFileAtPath:zipPath toDestination:cacheDir];
[[UGI18NScope sharedInstance] loadDynamicBundles];
```

## 五、性能优化

### 1. 内存优化对比

| 方案       | 启动内存 | 语言切换耗时 | 峰值内存 |
| ---------- | -------- | ------------ | -------- |
| 内存Json   | 82MB     | 420ms        | 105MB    |
| 动态Bundle | 35MB     | 150ms        | 60MB     |

### 2. 懒加载机制

系统通过NSBundle的NSCache实现：

* 首次访问字符串时加载对应语言文件
* 内存压力时自动释放未使用资源
* 相同key自动复用缓存

## 六、未来展望

### 1. 架构演进方向

* **智能化加载策略** ：基于用户行为预测的预加载机制
* **云端协同方案** ：CDN分发+差分更新（Delta Update）
* **AR国际化支持** ：动态加载3D模型的多语资源

### 2. 工具链建设

* **自动化测试工具** ：多语覆盖率检测
* **可视化监控平台** ：实时查看各语言模块加载状态

### 3. 跨平台扩展

* **Flutter混合方案** ：通过MethodChannel共享Bundle资源
* **React Native适配** ：构建JS-Native的字符串映射桥接

## 七、总结

我们的重心应该由支持多语的动态化转为提升多语翻译的准入标准，弱化热更新能力，尽量不依赖热更新来做一个不规范的操作。

未来将持续优化多语资源的加载效率，构建覆盖全平台的国际化解决方案，为全球1.2亿用户提供更流畅的本地化体验
