---
title: iOS使用Cursor开发配置指南
date: 2025.04.02
group: Tools
slug: ios-cursor-setup
summary: 从 Xcode 迁到 Cursor:Swift、SweetPad 等插件与编译运行配置全流程。
---

## 一、背景介绍

公司采购了Cursor IDE，其中的Composer功能十分强大。目前Xcode缺乏对应的AI功能，尝试迁移到Cursor。

## 二、准备工作

### 2.1 必要插件安装

- 安装Swift扩展插件
  ![iShot_2025-04-01_10.53.03](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.53.03.png)
- 安装SweetPad扩展插件
  ![iShot_2025-04-01_10.28.35](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.28.35.png)
- 在SweetPad插件中安装TOOLS
  ![iShot_2025-04-01_10.27.36](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.27.36.png)
- xcode-build-server 必须安装 别的按需安装即可

### 2.2 可选插件安装

- 安装Chinese简体中文插件将Cursor语言改成中文
- 安装Xcode Keymap扩展插件将Xcode的快捷键映射到Cursor

### 2.3 界面优化

新下载的Cursor功能菜单默认布局是横向的，空间很小，建议改成纵向布局：

1. Cursor - 首选项 - 设置 - 工作台 - 外观
2. 搜索 workbench.activityBar.orientation，改为vertical
3. 重启即可![iShot_2025-04-01_11.14.20](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_11.14.20.png)

## 三、编译与运行

### 3.1 设备选择

在SweetPad插件中找到DESTINATIONS(设备列表)项：

- 只能找到iOS17以上的设备，最好使用模拟器
- 此插件不支持真机Debug
- 右键点击模拟器后弹出选择设备

![iShot_2025-04-01_10.28.03](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.28.03.png)

### 3.2 构建项目

找到BUILD项，找到需要编译的target：

- 右键点击弹出菜单选择Build
- 或者点击右侧快捷按钮

![iShot_2025-04-01_10.56.48](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.56.48.png)

## 四、代码索引配置

### 4.1 生成代码树

1. Cursor顶部快捷栏搜索 >Build Server Config
   ![iShot_2025-04-01_10.32.42](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.32.42.png)
2. 通过SweetPad生成代码索引树
3. 注意这一步一定要在全量编译之后执行

完成后在Cursor中可以点按command进行代码调用回溯。

## 五、调试配置

### 5.1 设置调试环境

1. 打开Cursor和SweetPad在同一级的Debug项目
2. 点击绿色按钮创建launch.json
3. 选择中间顶部弹出的菜单通过SweetPad创建LLDB

![iShot_2025-04-01_10.30.46](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.30.46.png)

### 5.2 启动调试

1. 手动点击Attach to running app (SweetPad)或者F5快捷键启动Debug
2. 注意只能选择模拟器，目前还不支持真机调试
3. 等待模拟器启动APP后，LLDB会命中断点
4. 在Debug项目下可以看到各种Debug信息，在调试控制台可以使用LLDB命令

![iShot_2025-04-01_10.26.25](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.26.12.png)
![iShot_2025-04-01_10.26.25](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-04-01_10.26.25.png)

## 六、注意事项

### 6.1 索引依赖

相比与Xcode常驻的代码索引来说，此插件的索引强依赖一次成功的全量编译，如果发现不能定位方法调用栈时可能是编译缓存失效了，需要再次全量编译。

### 6.2 工具依赖

- 此插件强依赖Xcode提供的Xcode Command Line工具
- 所有的编译&运行工作其实都是在终端中调用Xcode命令行工具
- debug会有任务依赖，需要等待前置lunch任务执行

## 七、待解决问题

### 7.1 系统兼容性

目前这种方式只支持iOS17以上的系统设备，且只支持模拟器调试。我们的项目有些三方库去掉了模拟器架构，需要调整三方库架构。

### 7.2 项目配置

.xcodeproj、BuildSetting等项目配置还依赖Xcode进行编辑，需使用XcodeGen进行改造，有一些成本。

### 7.3 文件组织方式

目前Xcode组织文件使用Group格式，通过Cursor创建的文件是Folder格式，需要将当前的组织方式从Group全部转成Folder，成本也比较高。
