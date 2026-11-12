---
title: SwiftUI 从入门到放弃
date: 2022.07.06
group: iOS
slug: swiftui-intro
summary: SwiftUI 入门:声明式 UI 框架的基本概念、视图与布局方式。
---

![SWiftUITitleImage](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h4461xrrg2j211906rjrv.jpg)

## 什么是SwiftUI

SwiftUI 于 2019 年度 WWDC 全球开发者大会上发布，它是基于 Swift 建立的声明式UI框架。

该框架可以用于 watchOS、tvOS、macOS、iOS 等平台的应用开发，等于说统一了苹果生态圈的开发工具。

> SwiftUI provides views, controls, and layout structures for declaring your app’s user interface. The framework provides event handlers for delivering taps, gestures, and other types of input to your app, and tools to manage the flow of data from your app’s models down to the views and controls that users will see and interact with.

## SwiftUI Hello World

[创建新项目并预览画布](https://developer.apple.com/tutorials/swiftui/creating-and-combining-views)

和平时创建新项目流程基本一致。只需要选择Swift UI Interface即可。

![2](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h36ny2yym8j213002fmx4.jpg)

工程初始化创建完毕后可以看到文件结构如下：

![3](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h36o3x0gvgj207h04lglm.jpg)

```ruby
.
├── SwiftUIClient
│   ├── Assets.xcassets // 素材文件夹
│   │   ├── AccentColor.colorset
│   │   │   └── Contents.json
│   │   ├── AppIcon.appiconset
│   │   │   └── Contents.json
│   │   └── Contents.json
│   ├── ContentView.swift // 默认view
│   ├── Preview Content
│   │   └── Preview Assets.xcassets
│   │       └── Contents.json
│   └── SwiftUIClientApp.swift // APP入口文件
└── SwiftUIClient.xcodeproj 
    ├── project.pbxproj
    └── xcuserdata
        └── pxcm-0101-01-0246.xcuserdatad
            └── xcschemes
                └── xcschememanagement.plist
```

## @main

找到APP入口文件 `SwiftUIClientApp.swift`中的 `@main`标记
根据经验APP会从@main入口启动开始执行

```swift
import SwiftUI

@main
struct SwiftUIClientApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

我们会遇到三个新的结构: App, Scene, WindowGroup

### App Protocol

```swift
@available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
public protocol App {
}
```

通过声明符合 `App`协议的结构来创建应用程序。实现所需的[`body`](https://developer.apple.com/documentation/swiftui/app/body-swift.property)计算属性来定义应用程序的内容。

在结构声明之前加上[@main](https://docs.swift.org/swift-book/ReferenceManual/Attributes.html#ID626)属性，表明您的自定义 `App`协议符合者提供了应用程序的入口点。[`main()`](https://developer.apple.com/documentation/swiftui/app/main())该协议提供了系统调用以启动您的应用程序的方法的默认实现。在所有应用程序文件中只可以有一个入口点。

可以简单理解为APP的外壳/容器

### Scene Protocol

```swift
@available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
public protocol Scene {
}
```

您可以[`App`](https://developer.apple.com/documentation/swiftui/app)通过组合一个或多个符合 `Scene`应用程序中协议的实例来创建[`body`](https://developer.apple.com/documentation/swiftui/app/body-swift.property). 您可以使用 SwiftUI 提供的内置场景，例如，以及您从其他场景中组合的自定义场景。要创建自定义场景，请声明符合协议的类型。实现所需的计算属性并为您的自定义场景提供内容：[`WindowGroup`](https://developer.apple.com/documentation/swiftui/windowgroup)`Scene`[`body`](https://developer.apple.com/documentation/swiftui/scene/body-swift.property)

场景是视图（View）层次结构的容器。通过在App实例的body中组合一个或多个符合Scene协议的实例来呈现具体程序。

- 生命周期由系统管理
- 系统会根据运行平台的不同而调整场景的展示行为（比如相同的代码在iOS和macOS下的呈现不同，或者某些场景仅能运行于特定的平台）
- SwiftUI2.0提供了几个预置的场景，用户也可以自己编写符合Scene协议的场景。上述代码中便是使用的一个预置场景WindowGroup

可以简单理解为多窗口模式下的某一个窗口(iPad/Mac)

### WindowGroup Struct

```swift
@available(iOS 14.0, macOS 11.0, tvOS 14.0, watchOS 7.0, *)
public struct WindowGroup<Content> : Scene where Content : View {
}
```

最常用的Scene，可以呈现一组结构相同的窗口。使用该场景，我们无需在代码上做修改，只需要在项目中设定是否支持多窗口，系统将会按照运行平台的特性自动管理。

如果在一个WindowGroup里加入多个View,呈现状态有点类似VStack。从上到下依排列

在一个Scene中加入多个WindowGroup，只有最前面的可以被显示。

## View Protocol 和常用控件

SwiftUI使用过程中可以明显感觉到整个APP都是使用一系列View互相嵌套/堆叠而成的。

View 协议是整个UI界面的基础,提供配置界面的各个部分。

> A type that represents part of your app's user interface and provides modifiers that you use to configure views.

```swift
struct TestView: View {
    var body: some View {
        Text("Hello, World!")
    }
}
```

### 文本

#### Text

```swift
Text("我是一个设置了蓝底白字行间距5内边距5边框3的Text控件")
.lineLimit(2)// 最大2行
.font(.largeTitle) // 字体
.foregroundColor(.white)// 字体颜色
.background(.blue) // 背景颜色
.lineSpacing(5) // 行间距
.padding(.all, 5) // 文字和空间间的内边距
.border(.blue, width: 3)// 边框
.rotationEffect(Angle(degrees: 50)) // 旋转
```

简单且强大的文本控件,类似于UILabel.可以支持很短的代码设置所需属性

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3i0g7vwrdj214w0mjacl.jpg"></image></pre>
</details>

#### TextField

```swift
TextField("输入框", text: $value)
.textFieldStyle(.roundedBorder)
.keyboardType(.alphabet)
```

相当于UIKit中的UITextField的单行文本输入框.支持banging一个@state修饰的string变量。

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3i5s1lrouj214r0mejuw.jpg"></image></pre>
</details>

#### SecureField

密码输入框,用法和普通的输入框一致

```swift
SecureField("密码输入", text: $value)
.textFieldStyle(.roundedBorder)
.keyboardType(.alphabet)
.accentColor(.red)
```

#### TextEditor

类似UITextView,多行输入文本

```swift
TextEditor(text: $value)
.keyboardType(.default)
.multilineTextAlignment(.leading)
.accentColor(.red)
.foregroundColor(.black)
.background(.gray.opacity(0.3))
.lineSpacing(5)
.frame(maxHeight: 500)
.textInputAutocapitalization(.words)
.disableAutocorrection(true )
.onChange(of: value) { newValue in
    textCount = newValue.count // 输入文本变化监听器
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3i8b01bi2j214q0mg437.jpg"></image></pre>
</details>

### 按钮

#### Button

```swift
// 不带边框style的button
Button("不应用边框的按钮样式"){}.buttonStyle(BorderlessButtonStyle()).padding()

// 可以通过自定义PrimitiveButtonStyle类来实现一些自定义的button
struct PriButton: PrimitiveButtonStyle {
    typealias Body = Button
    func makeBody(configuration: Configuration) -> some View {
        configuration.trigger()
        return
        Button(configuration)
            .background(Color.orange)
            .clipShape(RoundedRectangle(cornerRadius: 25.0, style: .continuous))
    }
}

// 也可以直接使用label参数设置自定义view
Button {
    print("click") // 事件block
} label: {
   //这里可以放自定义view
    Image(systemName: "star").offset(x: -10, y: 0)
    Text("带图标的按钮")
}.padding()
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3i0k7u9qvj213d0mj42p.jpg"></image></pre>
</details>

#### Menu(*PullDownButton*)

点击弹出选择菜单,可以加在toolbar上或者其他地方,本体是一个Button,也可以是自定义View.

```swift
Menu("menu") {
    Button("Duplicate", action: duplicate)
    Button("Rename", action: rename)
    Button("Delete…", action: delete)
    Menu("Copy") {
        Button("Copy", action: copy)
        Button("Copy Formatted", action: copyFormatted)
        Button("Copy Library Path", action: copyPath)
    }
}.menuStyle(.borderlessButton)

Menu {
    Button("Open in Preview", action: openInPreview)
    Button("Save as PDF", action: saveAsPDF)
} label: {
    Image(systemName: "document")
    Text("PDF")
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3i91gt97aj214s0mgn15.jpg"></image></pre>
</details>

#### EditButton

支持改变整个环境变量中的editMode字段,开启编辑状态后一些系统控件会自动触发状态变化。例如支持删除或者排序的List中的ForEach列表在开启editmode后会显示出List的编辑功能。

当然,你也可以创建一些支持编辑模式的View,同时也可以监听环境中的editMode。

```swift
@Environment(\.editMode) var editMode
```

经常会和toolbar功能共用,在导航条右上角支持编辑模式。

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3j3vq77r8j214l0md793.jpg"></image></pre>
</details>

### 列表

#### List, Section, ForEach

```swift
List{
  Section("水果列表") {
      ForEach(fruits, id: \.self) { fruit in
          Text("\(fruit)")
      }.onMove { indexSet, index in
          fruits.move(fromOffsets: indexSet, toOffset: index)
      }
  }

  if !balls.isEmpty {
      Section("球类列表") {
          ForEach(balls, id: \.self) { ball in
              Text("\(ball)")
          }.onDelete { indexSet in
              balls.remove(atOffsets: indexSet)
          }
      }
  }
}
```

List类似UIKit中的UITableView,常与ForEach语句一起使用。不像UIKit中繁琐的代理和数据源模式,List是字面含义的View列表,手动将每个VIew排列起来即可。

当然List也可以直接装填数据源进行列表展示

```swift
List(0..<100){ i in
  Text("id:\(id)")
}
```

Section则可理解为UITableView中的SectionHeader和Footer在SwiftUI中的实现.List和Section联合使用可以实现常用的多Section的tableview。

ForEach语句需求传入的数据拥有唯一标识,针对数组可以直接使用

```swift
ForEach(array.indices, id: \.self){ index in
 //some view
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3j3sni4zjj214s0mhtbz.jpg"></image></pre>
</details>

#### Group

Group用于集合多个视图，对 Group 设置的属性，将作用于每个子视图。

```swift
Group {
    Text("Hello, World!")
    Text("Hello, World!")
}
.foregroundColor(.blue)
.font(.caption)
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3rnl7bryaj213o0metbb.jpg"></image></pre>
</details>

#### From

Form是SwiftUI的基础控件，如果我们需要显示产品配置、选项、用户输入时，使用Form可以快速搭建出各类表单。

```swift
 Form {
    Section {
        HStack{
            Image(systemName: "star.fill")
            Text("输入的内容:\(value)")
        }
        TextField("输入框的placeholder", text: $value)
            .textFieldStyle(.roundedBorder)
            .keyboardType(.alphabet)
            .accentColor(.red)
        Text("一个简单的Form写法,如果我们需要显示产品配置、选项、用户输入时，使用Form可以快速搭建出各类表单,会自动增加内边距")
            .font(.caption)
            .foregroundColor(.gray)
    }

    Section("另一组内容") {
        HStack{
            Image(systemName: "star")
            Spacer()
            Text("一个右对齐的文案")
        }
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3jl3sied0j214q0mb0w3.jpg"></image></pre>
</details>

#### ScrollView

在有限空间放较多内容的容器View

```swift
ScrollView(.vertical, showsIndicators: false) {
    ForEach(list, id:\.self) { item in
        Text(item).padding()
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3jbr3uhfej214s0mfjy1.jpg"></image></pre>
</details>

### 布局

#### VStack,HStack

VStack类似UIStackView,属于布局修饰符,其中包裹的view会按照一定的规则进行垂直方向的自动布局。

同理HStack会在水平方向自动布局,二者可叠加嵌套。

```swift
VStack(alignment: .leading, spacing: 10) {
    Text("垂直方向左对齐").border(.blue, width: 1)
    Text("设置的两个label").border(.blue, width: 1)
    HStack(alignment: .center, spacing: 5) {
        Text("嵌套一个水平方向的HStack").border(.blue, width: 1)
        Spacer()
        Text("的两个label").border(.blue, width: 1)
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3uoh36i9gj213v0n1418.jpg"></image></pre>
</details>

#### ZStack

ZStack的布局方式类似于UIKit中的View父子层级,但是SwiftUI中较少提及父子层级关系,SwiftUI中认为每个View都是独立的View,仅仅是布局方式的不同。

例如在UIKit中在一个View内部增加几个小View会用到addSubview方法来添加子View,但是在SwiftUI中会使用ZStack布局方式来进行View堆叠。

```swift
ZStack(alignment: .center) {
}
```

<details>
<summary><font color=gray>点击查看运行效果</font></summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3uorpdw9qj213s0mtn0l.jpg"></image></pre>
</details>

### 导航

#### TabView

类似UIKit中的UITabbar承担tab切换的功能

```swift
enum TabType {
    case featureList
    case other
}

TabView {
  //FeatureListHomeView是这个tabbar的root层级的view
  FeatureListHomeView().tabItem({
      Label("列表", systemImage: "list.bullet")// tabItem来进行展示内容
  }).tag(TabType.featureList) // .tag来标志映射

  CustomViews().tabItem({
      Label("自定义", systemImage: "star")
  }).tag(TabType.other)
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3jkd4vkktj214o0men09.jpg"></image></pre>
</details>

#### NavigationView, NavigationLink

类似UINavigationViewController,负责导航栈的管理。

```swift
NavigationView {
List {
    ForEach(feature.demoFeatures.featureSections, id: \.self) { sec in
        Section(sec.featureSectionName) {
            ForEach(sec.featureList, id: \.self) { item in
                NavigationLink {
                    getDestinationViews(featureItem: item)
                } label: {
                    DemoRowView(title: item.featureName, subTitle: item.featureDesc)
                }
            }.onDelete { offset in
                deleteRow(offset: offset, from: sec)
            }
        }
    }
}.listStyle(.inset)
.navigationTitle("控件列表")
```

一般配合NavigationLink来进行点击跳转.类似的,导航栈跳转后续的页面共用同一个导航栈。可以通过navigationTitle方法设置导航栈的标题,通过navigationBarTitleDisplayMode方法设置导航标题的展示形式。

```swift
Text("Hello, World!")
.navigationTitle("NavigationView")
.navigationBarTitleDisplayMode(.inline)// 只在顶部标题区域显示
.navigationBarTitleDisplayMode(.large)// 会在当前页面顶部显示一个较大的标题
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3n25qldn7j214q0mg0va.jpg"></image></pre>
</details>

#### Modal

模态弹出是经常使用的一种弹出信息页面的模式。

SwiftUI给VIew增加的.sheet的扩展,给定一个绑定的值,当这个值发生变化的时候(true),触发模态框的事件。

UIKit中的Present VIewController不同的style,有半弹窗和全屏present

同理,SwiftUI给VIew增加了.fullScreenCover的扩展,给定一个绑定的值,当这个值发生变化的时候(true),触发全屏模态框的事件。

```swift
Form{
  Button("Modal New View") {
      isPresented.toggle()
  }.sheet(isPresented: $isPresented, onDismiss: {
      // dismiss
  }) {
      ImageDemo()
  }

  Button("FullScreenCover New View") {
      fullScreenCover.toggle()
  }.fullScreenCover(isPresented: $fullScreenCover) {
      TextEditorDemo(value: "FullScreenCover")
  }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3pdafcupzj213e0mgwgx.jpg"></image></pre>
</details>

#### Popover

Popover在不同的设备上展示会出现差异,在iOS上是模态弹出一个新页面,在iPad或Mac上弹出一个气泡框。

```swift
Button("Popover New View") {
    popover.toggle()
}.popover(isPresented: $popover) {
   Text("在iphone上显示为模态框弹出页面,在ipad上显示为点击气泡弹窗")
        .padding()
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3ro8fw598j21380fatah.jpg"></image></pre>
</details>

### Pickers

#### Picker

可以自定义数据的选择器

```swift
Picker(selection: $selectIndex) {
  ForEach(fruits, id: \.self) { fruit in
      Text(fruit)
  }
} label: {
  Text("Picker")
}.pickerStyle(.wheel) // 使用此方法切换选择风格
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3n2vebx0zj214s0mijv7.jpg"></image></pre>
</details>

#### DatePicker

系统内置的时间选择器

```swift
 DatePicker("选择日期", selection: $selectDate, displayedComponents: .date)
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3nr7v7zu9j214p0mdjvb.jpg"></image></pre>
</details>

#### Toggle

类似于UISwitch,用于开关选择

```swift
Toggle("开关", isOn: $open)
.onChange(of: open) { newValue in
    print("切换了开关状态")
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3o0cr0v3mj214q0mdmz8.jpg"></image></pre>
</details>

#### Slider

Slider相当于UIKit中的UISlider，通过移动滑杆实现指定区域和间隔的数值的选择。

```swift
Slider(value: $opacity, in: 0.1 ... 1.0, step: 0.05).accentColor(.red)
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3p7s7u4plj214v0mf0vu.jpg"></image></pre>
</details>

#### Stepper

步进选择器

```swift
Stepper("有限的选择数量", value: $value, in: -1 ... 5, step: 1)
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3p82b0ae5j214r0mhace.jpg"></image></pre>
</details>

### Alerts

#### Alert

AlertView将被废弃,被.alert方法替代

swiftUI给VIew增加了.alert的扩展,给定一个绑定的值,当这个值发生变化的时候(true),触发Alert的事件。

```swift
.alert("Alert Title", isPresented: $isPresented1, actions: {
    Button("OK"){
        // button点击事件
    }
}, message: {
    Text("一个选择项的Alert")
})
```

当action中的button数量不同时会自动切换alert的显示格式

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3pcgv2l0dj213s0mgjuh.jpg"></image></pre>
</details>

#### ActionSheet

ActionSheet将被废弃,被.confirmationDialog替代

SwiftUI给VIew增加了.confirmationDialog的扩展,给定一个绑定的值,当这个值发生变化的时候(true),触发ActionSheet的事件。

```swift
.confirmationDialog("选择你需要的选项", isPresented: $isPresented) {
    Button("Update") {
        // choose update
    }
    Button("Delete", role: .destructive) {
        // choose delete
    }

    Button("Cancel", role:  .cancel) {
        // choose cancel
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24egy1h3pctoaj0pj213k0mfaco.jpg"></image></pre>
</details>

### Image

Image,类似于UIImageView,相对于UIimageview,Image控件可以更加简单的设置圆角,边框,阴影等属性。

```swift
Image("stmarylake")
.resizable() // 必须先设置可以重设尺寸才可以改变图片原始尺寸
.frame(width: 100, height: 100, alignment: .center)
.clipShape(Rectangle()) // 边缘切割
.overlay(Rectangle().stroke(.white, lineWidth: 4), alignment: .bottom)// 覆盖一个等大小的方块增加4的宽度的stroke用来做边框
.shadow(radius: 10)// 阴影
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3jk79vi59j214p0mf76j.jpg"></image></pre>
</details>

### WebImage

SwiftUI中的VIew控件可以控制其生命周期,在onAppear的时候进行URL图片下载,下载成功后替换image即可。

```swift
Image(uiImage: baseImage)
.resizable()
.frame(height: 200)
.aspectRatio(contentMode: .fit)
.onAppear {
    downloadImageWithURL(url: url)
}
  
private func downloadImageWithURL(url: String?) {
  guard let urlStr = url, let url = URL(string: urlStr) else { return }
  SwiftUIDemoHelper.defult.downLoadImageWithURL(url: url) { receivedSize, totalSize in
      let progress = Float(receivedSize) / Float(totalSize)
      downloadTaskProgress = progress
  } completion: { res in
      switch res {
      case .success(let img):
          baseImage = img
          downloadTaskProgress = 1
      case .failure(_):
          downloadError = true
      }
  }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3uxv5n357j213q0natdv.jpg"></image></pre>
</details>

当然可以使用kf图片库来进行网络图片的下载和缓存管理。

<details>
<summary><font color=gray>点击查看长时间下载的加载效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3uxr4o7zbg20oo1hcx6p.gif" height = 400></image></pre>
</details>

### Webview

SwiftUI没有再封装一套新的Webview容器,直接桥接WKWebView即可。

如何和UIKit进行桥接参考后续桥接部分。

```swift
import SwiftUI
import WebKit

struct WebviewDemo: View {
    @State private var url: String = "https://www.baidu.com"
    @State private var pageTitle: String = "Webview"
    var body: some View {
       SWWkWebview(url: $url, pageTitle: $pageTitle)
            .navigationTitle(pageTitle)
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct SWWkWebview: UIViewRepresentable {
  
    typealias UIViewType = WKWebView
  
    @Binding var url: String
    @Binding var pageTitle: String
  
    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.navigationDelegate = context.coordinator
        if let url = URL(string: url) {
            view.load(URLRequest(url: url))
        }
        return view
    }
  
    func updateUIView(_ uiView: WKWebView, context: Context) {
     
    }

    func makeCoordinator() -> Coordinator {
        let val =  Coordinator()
        val.updateTitle = { title in
            self.pageTitle = title
        }
        return val
    }
  
    class Coordinator: NSObject, WKNavigationDelegate {
     
        var updateTitle: ((String) -> Void)?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.title") { (result, error) in
                let title: String = String(describing: result ?? "")
                self.updateTitle?(title)
            }
        }
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3uqhsiluvj213m0nc42w.jpg"></image></pre>
</details>

---

## 桥接UIKit

SwiftUI可以自由的和当前项目中的framework协作，不论你是UIKit还是APPKit或者是WatchKit。这里我们简单说下如何桥接UIKit。

### UIViewRepresentable

有一些View还未被SwiftUI原生实现，需要从UIKit中桥接而来，例如前面的[WebviewDemo](#Webview)。当然一些自己封装的View或者三方库View均可桥接到SwiftUI中展示。当我们需要在SwiftUI使用UIKit中的View时，我们需要创建一个实现了UIViewRepresentable协议的结构体作为我们的桥接View。

```swift
public protocol UIViewRepresentable : View where Self.Body == Never {
    /// 首先需要确定你要桥接的View的类型
    associatedtype UIViewType : UIView
    /// 必须实现的协议，系统在初始化结构体的时候会初始化你的View
    func makeUIView(context: Self.Context) -> Self.UIViewType
    /// 必须实现的协议，SwiftUI更新的时候会调用此方法让你的View同步更新
    func updateUIView(_ uiView: Self.UIViewType, context: Self.Context)
    /// 非必须实现的协议，相当于 UIView 的 deinit 方法，可以在其中做一些诸如删除通知 observer，停止 timer 等清理工作
    static func dismantleUIView(_ uiView: Self.UIViewType, coordinator: Self.Coordinator)
    /// 协调器，当前结构体从UIKit中获取数据的途径，一般用来实现UIKit View 的代理
    associatedtype Coordinator = Void
    /// 创建一个协调器，用来连接SwiftUI和UIKit，makeUIView之前就会调用
    func makeCoordinator() -> Self.Coordinator
    /// 存储一些数据的上下文
    typealias Context = UIViewRepresentableContext<Self>
}
```

桥接过程的生命周期为：

![4](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3x76m90gnj20b80buglq.jpg)

其中updateUIView方法会随着View的刷新调用多次。

### UIViewControllerRepresentable

类似于桥接UIView，SwiftUI也给出了桥接UIViewController的方式

```swift
public protocol UIViewControllerRepresentable : View where Self.Body == Never {

    associatedtype UIViewControllerType : UIViewController

    func makeUIViewController(context: Self.Context) -> Self.UIViewControllerType

    func updateUIViewController(_ uiViewController: Self.UIViewControllerType, context: Self.Context)

    func makeCoordinator() -> Self.Coordinator

    typealias Context = UIViewControllerRepresentableContext<Self>
}
```

从实现上来看桥接View和ViewController都是同一种实现方式，都借助了生成一个协调器Coordinator来连接二者。

---

## 数据流

SwiftUI的设计理念是，所有数据**有且仅有一个**数据源。物理内存中仅仅保存一份数据,其余地方均引用其指针地址。

### @State

SwiftUI中大量使用结构体 `Struct`,结构体中的变量一般是不能修改的,但是在View层级中会随着用户操作或者其他条件触发数据的变化,这个时候我们该如何让数据变化的同时界面跟随刷新变化呢。

如果视图需要存储它可以修改的数据，请使用[`State`](https://developer.apple.com/documentation/swiftui/state)属性包装器声明一个变量。

例如我们在开关Demo中使用了用 `@State`包裹着的 `open`属性,当触发开关onchange方法的时候会直接改变open属性的值。

```swift
struct ToggleDemo: View {
    @State private var open: Bool = false
    var body: some View {
        Form{
            Toggle("开关", isOn: $open)
                .onChange(of: open) { newValue in
                    print("切换了开关状态")
                }
            Text("开关状态: \(open.description)")
        }.navigationTitle("Toggle")
      
    }
}
```

通俗的理解为struct内的属性都是不可变的,但是当你的View的body想要监听某个属性的时候可以给这个属性增加@State修饰符,这样的话就可以在struct内部直接修改此变量而不再使用mutating,同时当此变量发生改变的时候会触发View的重载和刷新。

在State单词的语境下理解这个修饰符会更容易--状态变量。实质为当结构体中的属性发生了改变,Swift会创建一个新的Struct来替换原来的Struct。而@State 能够发现这种变化，并自动重新加载视图。

SwiftUI在别的存储位置专门存放使用@State修饰的变量,来绕过结构体的限制。

注意,这种用法破坏了常识中的结构体的规则,@State 是专门为存储在一个结构体中的简单属性而设计的,所以尽量将使用@State修饰的变量设置为私有的(private)。

值得一提的是SwiftUI支持在任何线程安全地修改@State修饰的变量。

### @Binding

由上一节的@State我们可以做到数据源变化的时候刷新View,当然有时候会出现一些相反的场景,比如一些View的操作变化产生了新的数据需要回传给另一个View显示,例如之前的WebviewDemo中桥接Wkwebview的SWWkWebview类。

在Wkwebview的WKNavigationDelegate代理中发现Webview加载完毕之后执行JS代码来获取页面的标题,然后反向传递到上层页面的导航条上显示。

这种情况适合使用@Binding修饰符来修饰属性让SwiftUI知晓这里需要使用指针传递,而非值传递(Swift中的struct内属性赋值默认是值传递)。

```swift
struct WebviewDemo: View {
    @State private var url: String = "https://www.36kr.com"
    @State private var pageTitle: String = "Webview" // 默认的标题,状态变量
    var body: some View {
       SWWkWebview(url: $url, pageTitle: $pageTitle)// 注意@Binding的属性需要使用$符号来传递指针值
            .navigationTitle(pageTitle)// pageTitle改变时会更新导航栏标题
            .navigationBarTitleDisplayMode(.inline)
    }
}

struct SWWkWebview: UIViewRepresentable {
  
    typealias UIViewType = WKWebView
  
    // @Binding修饰的属性,说明这个属性需要指针传递,不能使用值传递
    @Binding var url: String
    // 指针传递才能够做到不增加别的操作就能直接改变外部环境的属性值
    @Binding var pageTitle: String
  
    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.navigationDelegate = context.coordinator
        if let url = URL(string: url) {
            view.load(URLRequest(url: url))
        }
        return view
    }
  
    func updateUIView(_ uiView: WKWebView, context: Context) {
     
    }

    func makeCoordinator() -> Coordinator {
        let val =  Coordinator()
        val.updateTitle = { title in
            //这里更新pageTitle指针指向的属性的值
            self.pageTitle = title
        }
        return val
    }
  
    class Coordinator: NSObject, WKNavigationDelegate {
     
        var updateTitle: ((String) -> Void)?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.evaluateJavaScript("document.title") { (result, error) in
                let title: String = String(describing: result ?? "")
                // 这里每次加载页面都获取页面的标题,然后执行block进行SWWkWebview结构体的更新
                self.updateTitle?(title)
            }
        }
    }
}
```

当然@Binding的链接是双向的,不仅可以从下向上修改数据,在上层View修改的下层View绑定的数据属性的时候,下层View也会受到影响。

可以看到数据流向图:

![基本数据流向](https://docs-assets.developer.apple.com/published/d98251c2fac9fc4f6843be1e4836cb93/Managing-User-Interface-State-1@2x.png)

首先我们在上层View中存在一个@State修饰的状态变量,上层View会观察此变量的变化随之刷新界面,相应刷新的View可能是另外一个下层VIew,不过这个并不影响既定的刷新规则。这种数据流向为单向绑定。

其次我们可以把状态变量的指针传递给下层@Binding修饰的属性变量,当任何一方修改此属性的时候都会触发观察者更新全部的View。这种数据流向为双向绑定。

从上图可以观察到,当使用@State属性来修饰的时候可以认为此属性为值的真实来源,当使用@Binding修饰属性的时候可以认为此属性为真实值的指针。

类似的当看到带有State单词的修饰符时都可以认为当前属性为值的真实来源，且当前View是这个属性的原始持有者。

### @ObservableObject、@Published、@StateObject

虽然Swift中推荐使用Struct,但是Class的使用还是不可缺少的一环。相比于结构体的值传递,class默认进行的就是指针传递。那么指针传递的Class是否就自动获得了类似于@State和@Binding的功能呢?

答案是NO

SwiftUI中并不会因为你传递进来的是一个类变量就默认自动刷新显示。想要达到这样的效果必须使当前类满足ObservableObject协议。

ObservableObject字面意思,可观察对象。在类中可以添加@Published修饰符来告诉SwiftUI这个类中的这个属性可以发布订阅。

例如我们现在有一个可以显示用户信息的文本可一个点击一下增加一岁的按钮：

```swift
class User {
    var name = "Apple"
    var age = 15
}

struct CustomViews: View {
    private var user = User()
    var body: some View {
        NavigationView{
            VStack {
                Text("当前的用户名:\(user.name)")
                Text("当前的用户年龄:\(user.age)岁")
                Button("一年过去了") {
                    user.age += 1
                    print("一年后的年龄:\(user.age)")
                }
            }
            .navigationTitle("自定义view组件")
        }
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3w250asb2j213u0mqwgy.jpg"></image></pre>
</details>

可以看到我们点了很多次按钮,内存中的age字段已经变成了25,界面上却依旧显示为原始的值,这是因为User类是不可观察的,所以当User中的字段发生改变的时候不能触发页面的刷新.

现在我们为User类增加可观察属性

```swift
class User: ObservableObject {
    @Published var name = "Apple"
    @Published var age = 15
}

struct CustomViews: View {
    // 以前使用@ObservableObject的时候有user属性被异常释放的风险,改为使用@StateObject修饰符
    @StateObject private var user = User()
  
    var body: some View {
        NavigationView{
            VStack {
                Text("当前的用户名:\(user.name)")
                Text("当前的用户年龄:\(user.age)岁")
                Button("一年过去了") {
                    user.age += 1
                    print("一年后的年龄:\(user.age)")
                }
            }
            .navigationTitle("自定义view组件")
        }
    }
}
```

<details>
<summary><font color=gray>点击查看运行效果</font> </summary>
  <pre><image src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/SwiftUI/e6c9d24ely1h3w27hniv2j213o0luad5.jpg"></image></pre>
</details>

可以看到随着我们的点击增加user的age字段值,界面上显示的年龄文字也随之增加.

当然你需要给可观察的对象增加**@StateObject**修饰符

**为什么不使用@ObservedObject修饰符呢?**

1. 这将确保 User 实例在视图更新时不会被破坏。以前可能已经使用 @ObservedObject 来获得相同的结果，但这是有风险的。有时 @ObservedObject 可能会意外释放它正在存储的对象，因为它不是设计为最终的真相来源目的，但 @StateObject 就不会发生这种情况，因此应该改用它。
2. @StateObject 和 @ObservedObject 之间有一个重要的区别，即**所有权**，哪个视图创建了对象，哪个视图只是在监视它。规则是这样的：首先创建对象的视图必须使用**@StateObject**，告诉 SwiftUI 它是数据的所有者并负责保持它的活动，所有其它视图都必须使用 **@ObservedObject** 来告诉 SwiftUI，它们想要观察对象的变化但不直接拥有它。即每个对象应该只使用一次 @StateObject，它应该在负责创建对象的任何视图中，共享对象的所有其它视图都应使用@ObservedObject。

**思考1: 我们能对Class使用@State修饰吗?**

可以,只不过使用@State修饰的时候只有当前值发生变化的时候才会触发View变化,当被修饰的是Class类型的变量时,类内容的属性改变并不能改变当前类的值(指针).所以必须触发类的当前值改变的时候才能和观察者产生一样的效果.

```swift
class User {
    var name = "Apple"
    var age = 15
}

struct CustomViews: View {
    @State var user = User()
    var body: some View {
        NavigationView{
            VStack {
                Text("当前的用户名:\(user.name)")
                Text("当前的用户年龄:\(user.age)岁")
                Button("一年过去了") {
                  // 直接生成新的类,或者做类的深拷贝后改变age数值
                    let userB = User()
                    userB.name = user.name
                    userB.age = user.age + 1
                    user = userB
                }
            }
            .navigationTitle("自定义view组件")
        }
    }
}
```

**思考2: 我们可以对结构体使用@StateObject吗?**

很遗憾不能, 因为@StateObject修饰符必须要求属性满足ObservableObject协议,而非class类型不能遵循协议.

### @EnvironmentObject

思考一种场景，如果您有视图 A，并且视图 A 有一些视图 E 想要的数据，使用@ObservedObject 视图 A 需要将对象交给视图 B，视图 B 将把它交给视图 C，然后是视图 D，最后是视图 E，所有中间视图都需要发送对象，即使它们实际上并没有需要它。

这个时候我们可以使用@EnvironmentObject ，视图 A 可以创建一个对象并将其放入环境中；然后，其中的任何视图都可以随时通过请求访问该环境对象，而不必显式传递它，这样会使我们的代码更简单。

例如之前的Demo种的列表数据:

```swift
struct SwiftUIDemoApp: App {
    @StateObject private var features = FeatureInfoModel()
    var body: some Scene {
        WindowGroup {
            DemoHomeView().environmentObject(features)//这里向环境变量中添加了一个FeatureInfoModel
        }
    }
}

struct FeatureListHomeView: View {

  @EnvironmentObject var feature: FeatureInfoModel //这个view从环境变量中获取了FeatureInfoModel

  var body: some View {
      NavigationView{
          List {
              ForEach(feature.demoFeatures.featureSections, id: \.self) { sec in
                  Section(sec.featureSectionName) {
                      ForEach(sec.featureList, id: \.self) { item in
                          NavigationLink {
                              getDestinationViews(featureItem: item)
                          } label: {
                              DemoRowView(title: item.featureName, subTitle: item.featureDesc)
                          }
                      }.onDelete { offset in
                          deleteRow(offset: offset, from: sec)
                      }
                  }
              }
          }.listStyle(.inset)
          .navigationTitle("基础控件")
          .navigationBarTitleDisplayMode(.large)
          .toolbar{
              EditButton()
          }
      }

}
```

很明显DemoHomeView和FeatureListHomeView中间间隔了一些其他View，类似于全局变量可以直接读取使用。

通常EnvironmentObject用于整个应用程序中一些View都依赖和共享的数据，因为所有的视图都指向同一个模型，当被修饰的属性发生变化时，所有的视图都会立即更新，排除了应用程序的不同部分出现不同步的风险。

## 应用程序行为控制

### UIApplicationDelegate

作为一个完整的APP，开发者应该可以控制APP的完整生命周期，这个时候我们需要一个[`UIApplicationDelegate`](https://developer.apple.com/documentation/uikit/uiapplicationdelegate)类型的对象来承载App生命周期内各种行为的相应。

但是创建SwiftUI项目的时候Xcode并没有给我们默认创建Applegate.swift文件。

如果我们需要实现UIApplicationDelegate方法，我们需要手动创建Applegate.swift文件，并且让我们的Applegate类遵循NSObject协议和UIApplicationDelegate协议，然后实现我们需要的方法。

```swift
import Foundation
import UIKit

class APPDelegate: NSObject, UIApplicationDelegate, ObservableObject {
 
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        print("didFinishLaunchingWithOptions")
        return true
    }
  
    // SwiftUI中一些方法不能触发
    func applicationDidReceiveMemoryWarning(_ application: UIApplication) {
        print("log-DidReceiveMemoryWarning")
    }
  
    func applicationDidBecomeActive(_ application: UIApplication) {
        print("log-applicationDidBecomeActive")
    }
  
    func applicationDidEnterBackground(_ application: UIApplication) {
        print("log-applicationDidEnterBackground")
    }
}
```

实现了代理方法后，我们还需要告诉SwiftUI在哪里增加我们的代理，在@main入口的struct中添加@UIApplicationDelegateAdaptor标记，SwiftUI会自动识别我们的代理类，并在合适的时机调用对应的代理方法。

```swift
@main
struct SwiftUIDemoApp: App {
   
  @UIApplicationDelegateAdaptor private var appdelegate: APPDelegate
    //@UIApplicationDelegateAdaptor(APPDelegate.self) var appdelegate 这个写法也可以
   ...
}
```

比较方便的是如果你的APPDelegate类遵循了ObservableObject协议，SwiftUI会自动把@UIApplicationDelegateAdaptor修饰的属性放到全局环境变量里去，例如这里我们并没有声明全局环境变量，但是在下层的View中依旧可以使用全局环境变量获取。

```swift
struct FeatureListHomeView: View {  
 // 这里去获取环境变量
 @EnvironmentObject var appdelegate: APPDelegate
 var body: some View {
    NavigationView {
      ...
    }.onAppear {
        print("我在App内部的view获取到了全局的appdelegate中的name属性\(appdelegate.name)")
    }
  }
}
```

但是要注意一个问题，随着API的更新，有些代理方法不再由UIApplicationDelegate调用。

例如App前后台切换的代理，iOS13以前，由UIApplicationDelegate来控制生命周期，iOS13以后，由UISceneDelegate来控制生命周期。在iOS 13之后为了解决iPadOS展示多窗口的问题，用UIScene替代了之前UIWindow来管理视图。

iOS14以后Apple又给SwiftUI提供了更优雅的API来显示和控制Scene。

```swift
@main
struct SwiftUIDemoApp: App {

  @Environment(\.scenePhase) var scenePhase

  var body: some Scene {
      WindowGroup {
          DemoHomeView()
      }.onChange(of: scenePhase) { newValue in
          switch newValue {
          case .active:
              print("active")
          case .background:
              print("background")
          case .inactive:
              print("inactive")
          @unknown default:
              break
          }
      }
  }
}
```

### UIWindowSceneDelegate

多窗口管理和App代理类似，平常用的较少。

如果使用了场景委托UIWindowSceneDelegate，也需要自行创建委托文件SceneDelegate。

```swift
import Foundation
import UIKit

class SceneDelegate: NSObject, UIWindowSceneDelegate, ObservableObject {
    func windowScene( _ windowScene: UIWindowScene,performActionFor shortcutItem: UIApplicationShortcutItem ) async -> Bool {
        // Do something with the shortcut...
        return true
    }
}
```

然后直接在Appdelegate类中的方法中返回场景委托类即可。

```swift
func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
  let configuration = UISceneConfiguration(name: nil,sessionRole: connectingSceneSession.role)
  if connectingSceneSession.role == .windowApplication {
      configuration.delegateClass = SceneDelegate.self
  }
  return configuration
}
```

同样的，如果你的SceneDelegate类遵循了ObservableObject协议，SwiftUI会自动把当前类型的属性放到环境环境变量里去。
