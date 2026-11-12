---
title: 一帖看透iOS14 小组件
date: 2021.02.23
group: iOS
slug: ios14-widgetkit
summary: 一帖看透 iOS 14 小组件:WidgetKit 的结构、刷新机制与开发要点。
---

> 自iOS8之后，苹果支持了扩展（Extension）的开发，开发者可以通过系统提供给我们的扩展接入点 (Extension point) 来为系统特定的服务提供某些附加的功能。
> 但iOS14后，苹果更新了扩展组件，引入了新的UI组件：`WidgetKit` 而舍弃了iOS14以下版本的Today Extension组件

### Widget介绍

[这里有一份官方的小组件使用指南](https://support.apple.com/zh-cn/HT207122)

简单来说：小组件相当于一个动态程序入口，在有限的空间内展示你想看到的重要的信息

<img src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu0x3a5faj305g05p0tr.jpg" alt="电池小组件" style="zoom:50%;" />

苹果自带的日历使用起来非常不适，下载第三方日历又不想被捆绑的无用功能打扰。有了小组件之后这个问题就很好的解决了，比如上面的日历小组件，清晰的展示了今天的日期和农历以及周几，打开手机锁屏就能看见。

此外系统自带的电量小组件，方便的展示了需要下滑去状态栏才能看到的耳机电量：

<img src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu0y70jk5j30ae0bgjuv.jpg" alt="电池小组件" style="zoom:50%;" />

之前发布的时候觉得这都是安卓系统玩剩下的东西，没什么卵用，不过现在是真香！

---

### Widget设计指南

[这里有一份官方的设计指南](https://developer.apple.com/design/human-interface-guidelines/ios/system-capabilities/widgets/)

简而言之，设计一个简单漂亮吸引人并且快速显示内容的小组件。

---

### Widget: HelloWorld

[这里有一份官方的开发文档可以参考](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension)

一个小组件需要经过

`FIle` > `New` >`Target` >`Wiget Extension`  来创建

<img src="https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu1b833goj30g90gdadn.jpg" style="zoom:100%;" />

找到我们需要的 `Widget Extension`

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu1b7z83jj30kb0eodh5.jpg)

命名小组件

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu1b7vu85j30ke0eoq3v.jpg)

图中圈着的选项控制了我们的小组件能否配置属性，例如天气相关的小组件就可能需要你手动配置地址来获取你想要知道的城市的天气数据。

这样就创建好了一个小组件。小组件的文件结构如下：

![不带配置项的小组件结构](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEgy1gnu587og7mj30e902s3yi.jpg)

这里我们选则了不带配置项的小组件

![带配置项的结构](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu1ge3kbuj30eb03hglp.jpg)

带配置项的小组件的结构 主要区别在于 `TestWidget.intentdefinition`文件上，这个文件内部可以添加配置选项。

TestWidget代码如下

```swift
import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
   	/// 默认显示（无自定数据情况下显示）
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date())
    }
	
    ///getSnapshot方法是提供一个预览数据，可以让用户看到该组件的一个大致情况，是长什么样、显示什么数据的，可以写成固定数据，国外的			文章里叫它“fake information”
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date())
        completion(entry)
    }
  
		///包含要显示的所有条目：预期显示的时间（条目的日期）以及时间轴“过期”的时间
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        var entries: [SimpleEntry] = []

        // Generate a timeline consisting of five entries an hour apart, starting from the current date.
        let currentDate = Date()
        for hourOffset in 0 ..< 5 {
            //需要在这里从网络加载数据回来 同步进行初始化
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = SimpleEntry(date: entryDate)
            entries.append(entry)
        }
				// atEnd 指在最后一个显示时间点的小组件完毕后重新刷新TimeLine
        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
  	// 下面可以自己添加自定义的model
}

struct TestWidgetEntryView : View {
    var entry: Provider.Entry
		// swiftUI的View 可以返回一系列View 具体请参看SwiftUI文档
    var body: some View {
        Text(entry.date, style: .time)
    }
}
// 小组件主入口
@main
struct TestWidget: Widget {
    let kind: String = "TestWidget"
		// StaticConfiguration 不带配置项的小组件初始化方式
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TestWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("This is an example widget.")
    }
}
// 实时预览view
struct TestWidget_Previews: PreviewProvider {
    static var previews: some View {
        TestWidgetEntryView(entry: SimpleEntry(date: Date()))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}

```

于是我们获得了第一个小组件：

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnu2oixw72j304o051mx9.jpg)

看起来很简单吧！

---

### Widget结构解析

#### 至关重要 TimeLine

`getTimeLine` 方法获取小组件整个显示周期。

为了管理系统负载，`WidgetKit`使用预算来分配一天中的窗口小部件重新负载。

> Widgets use SwiftUI views to display their content. WidgetKit renders the views on your behalf in a separate process. As a result, your widget extension is not continually active, even if the widget is onscreen. Despite your widget not always being active, there are several ways you can keep its content up to date.

抛开 `SwiftUI`不谈，单说 `your widget extension is not continually active` ，这段文字清晰的说明了小组件所面临的问题：不能实时刷新。即使你的小组件在你目光注视中，小组件也不能保持最新状态。

重新加载窗口小部件会消耗系统资源，并会由于额外的联网和处理而导致电池消耗。为了减少对性能的影响并保持全天的电池寿命，请求的更新频率和更新次数将会限制为必要。

那么小组件如何刷新？

> Many widgets have predictable points in time where it makes sense to update their content. For example, a widget that displays weather information might update the temperature hourly throughout the day. A stock market widget could update its content frequently during open market hours, but not at all over the weekend. By planning these times in advance, WidgetKit automatically refreshes your widget when the appropriate time arrives.

许多APP需要定时刷新数据，这些刷新时间是可预测的，比如日历APP每天刷新当日的日期信息，股市APP则会在工作日频繁刷新交易信息，但是在休息日不频繁刷新。

当我们能够为小组件提供一个可预测的时间点和刷新策略，系统便会按照既定的顺序刷新。

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwiq5qmqfj30n80rugn1.jpg)

如图所示，我们在 `.Now`和每隔1小时共三小时设置四个显示时间点，系统在get到我们给定的 `TimeLine`之后会在当前、一小时后、两小时后、三小时后总计四个时间点进行小组件UI渲染,由于我们第一次给定的重新刷新策略为 `.atEnd`所以会在三个小时时间点渲染完毕之后重新获取 `TimeLine`。

第二个 `TimeLine(Provide timeline)`中设置的重新刷新策略为 `.never`所以在这个时间点的小组件渲染完毕之后就不再刷新了。

#### 添加预览 Snapshot

`getSnapshot`方法比较简单，这个方法获取我们在打开小组件预览界面时所看到的三个小组件的 `Entry`。

这里如果不需要展示实时数据的时候可以放入固定的预览数据以获得最好的体验(不需要请求网络直接渲染数据)。

#### 界面美化 Placeholder

`placeholder`方法目的在于获取一个没有数据或者没有网络情况下的默认View,一般是进行美化小组件的时候在这个view上做文章，

#### 数据支撑 TimelineEntry

```swift
struct SimpleEntry: TimelineEntry {
    let date: Date
}
```

`TimelineEntry`协议必须包含一个 `date`属性，用于计算需要渲染页面的时间点

自定义的模型可以实现这个协议用于承载内容数据。

#### 内容基石 WidgetEntryView

```swift
struct TestWidgetEntryView : View {
    var entry: Provider.Entry

    var body: some View {
        Text(entry.date, style: .time)
    }
}
```

小组件的 `View`就是一个普通的包含 `Provider.Entry`的 `View(swiftUI)`，一般创建timeline的时候会提供 `Provider.Entry`给 `View`进行渲染。

`body`属性下包含一系列 `VIew`控件用于渲染页面，更多 `SwiftUI`相关的知识看[SwiftUI文档](https://developer.apple.com/tutorials/swiftui/creating-and-combining-views)。

以上就是小组件的结构拆分和解析，只要明白组成结构和运行机制就能根据自己的需求去定制开发了。

---

### Widget进阶

#### 功能和限制

`iOS14 Widget`的功能对比着以前的 `TodayExtension`要少了很多，官方对小组件添加了很多限制。

- 小组件扩展整体需要使用 `SwiftUI`结构，`WidgetEntryView`需要提供 `SwiftUIView`。
- 页面滚动、动画和视频是被禁止的，`SwiftUI` 中 ` List` 控件是无法使用的，扩展的 `UIKit`中 `UIVisualEffectView`是被禁用的(毛玻璃效果)，更多被禁用的 `View`还需要在开发中发现。
- 只支持点击事件交互。
- 无法主动更新数据 刷新数据使用 `Timeline`方式手动设置。
- 每次重置刷新轮次的间隔不能低于5分钟，低于5分钟无效 ，我们在填充 `entries`时应该为其填充5分钟内需要显示的数据。不建议显示实时时间，和手机系统显示的时间可能会出现偏差。

#### 小组件样式区分  supportedFamilies

```swift
@main
struct TestWidget: Widget {
    let kind: String = "TestWidget"
		// StaticConfiguration 不带配置项的小组件初始化方式
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            TestWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("My Widget")
        .description("This is an example widget.")
        .supportedFamilies([.systemSmall])// 注意这里增加了一个方法来限制小组件支持的类型 这里只支持2x2小方块
    }
}
```

从主入口可以看到我们定义了一个 `TestWidget的`小组件，这个小组件默认支持三种样式。

我们常常只需要某一个小组件只支持一种样式，比如最小的方块形状的组件设计的时候由于尺寸及形状往往不考虑其他显示格式。

这时我们可以在 `StaticConfiguration`后跟上配置支持的样式方法 `supportedFamilies()`，小组件按照体积大小分为   `systemSmall`, ` systemMedium`，`systemLarge`三种。

#### 多小组件容器  WidgetBundle

在设计完成并确定要展示的小组件之后，我们会遇到一个问题，如何在入口方法处展示多个不同类型的小组件。

比如我们确定了三个小组件，`2x2`、`2x4`、`4x4`三种尺寸各一个，展示的内容也不相同。

```swift
@main // 移除原来的标记 放在这里 main只能存在一个
struct KrWidget: WidgetBundle {
    var body: some Widget {
        KrSmallWidget()
        KrMediumWidget()
        KrLargeWidget()
      	TestWidget()// 声明好的小组件可以在WidgetBundle下直接初始化
    }
}
```

这时我们可以将入口方法标记改成 `WidgetBundle`来适应多个小组件，`KrSmallWidget`、`KrMediumWidget`、`KrLargeWidget`为我们自定义的小组件，其结构和 `TestWidget`一致。

#### 所见即所得   PreviewProvider

如果对 `swiftUI`比较熟悉的胖友对这个会比较熟悉。

```swift
struct TestWidget_Previews: PreviewProvider {
    static var previews: some View {
        TestWidgetEntryView(entry: SimpleEntry(date: Date()))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
    }
}
```

这个 `PreviewProvider`可以呼出实时预览的页面，方便我们码UI。

可以点编辑器右边的resume按钮进行预览

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwfwkcrujj30il04f3yq.jpg)

经过build可以看到预览的结果，在你代码改动的时候会实时变化，十分方便。

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwfux3fiej31310ibn10.jpg)

不小心把页面关掉的话可以在右上角五条横线按钮中找到 `Canvas`选项勾选即可 `(Xcode12)`

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwfqmmkj4j305r06waag.jpg)

#### APP内刷新小组件   WidgetCenter

如果你需要在主工程里干预小组件的刷新，你可以使用 `WidgetCenter（单例）`类来进行操作。

```swift
 		/// Reloads the timelines for all widgets of a particular kind.
    /// - Parameter kind: A string that identifies the widget and matches the
    ///   value you used when you created the widget's configuration.
    public func reloadTimelines(ofKind kind: String)

    /// Reloads the timelines for all configured widgets belonging to the
    /// containing app.
    public func reloadAllTimelines()
```

一般使用这两个方法，来实现主APP内刷新小组件。

#### 为小组件启用定位

一些天气类型的小组件经常会获取当前的定位，小组件中如果要请求定位信息，需要在小组件目录下的 `info.plist`文件中添加 `NSWidgetWantsLocation`字段来请求权限

更多定位权限相关的信息请参考[给你的小组件添加定位信息](https://developer.apple.com/documentation/widgetkit/accessing-location-information-in-widgets)

#### 和主APP数据共享

由于widget跟APP间相互独立，如果想用相同的数据则需要两者间数据共享，创建**`App Group`**
主APP中  `Target` -> `Signing & Capability` -> `+Capability` -> `添加 App Group`

不过如果开发者账号开启 `Automatically manage signing`的话苹果会自动给你创建相关联的APPID。

两者间的数据共享主要通过**`UserDefaults`**和** `FileManager`**两种形式。

#### 点击交互和跳转方式

点击Widget窗口唤起APP进行交互指定跳转支持两种方式：

- `.widgetURL`：点击区域是Widget的所有区域，适合元素、逻辑简单的小部件，一个小组件只能响应一个 `widgetURL`，其中**`systemSmall`**类型的小组件只能使用此方式进行跳转
- `Link`：通过Link修饰，允许让界面上不同元素产生点击响应，一个小组件可以包含多个 `Link`

以上两种小组件链接点击后，可以在主 `APP`中的 `APPDelegate`类中进行响应

```swift
func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
  		 // 一般为小组件链接定义特殊的host进行区分
       if url.host == WidgetExtensionHost {
         //处理小组件点击事件源
       }
}
```

如果 `APP`内做了切屏适配，实现了 `SceneDelegate`则需要在 `SceneDelegate`里面实现跳转处理

```swift
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
        print(context.url)
    }
}
```

#### 调试小组件

开发的过程中总是充满了不确定性，一些东西需要断点进行调试。那么针对小组件如何调试？其实很简单，安装APP之后把 `Scheme`修改为我们的 `WidgetExtension`，选择测试机，然后运行，在手机上添加小组件后即可看到代码进入断点。

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwg0oh85cj30iw06ljsr.jpg)

#### 机型适配

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwgzuiadlj30rh09g751.jpg)

不同的设备尺寸所拥有的小组件的尺寸也是不同的，目前（iPhone12时代）小组件有以上几种尺寸。

在设计界面的时候和布局时需要考虑不同大小的区域的布局区别。

官方建议保证大的组件看起来比较好，其他尺寸的小组件根据大尺寸的进行微调。（毕竟屏幕一天比一天大）

#### 暗黑模式

开发过程中有遇到使用双模式的图片素材时，手机切换暗黑模式后页面的图标配图没有及时更新。总觉的目前小组件还有许多问题，不是很完善。

解决方案为使用单模式的图，使用两套图进行根据环境切换。

swiftUI中使用ColorScheme判断暗黑模式

```swift
@Environment(\.colorScheme) var colorScheme: ColorScheme
//根据不同模式填充不同颜色
Rectangle().fill(Color(colorScheme == .dark ? UIColor(hex: 0x262626) ?? UIColor.black : .white))
```

#### 网络请求

如果主项目是使用swift进行开发的，可以将对应的网络请求库分享到小组件的target进行使用。在对应的类文件的Target Membership选项勾选小组件target即可。

![](https://gcore.jsdelivr.net/gh/zcx4u/images/Hexo/iOS14Widget/008eGmZEly1gnwha6k9wsj30970g3dgy.jpg)

但是一般主项目中的网络框架往往会夹杂很多定制化的插件或其他需求，这么分享会使项目工程代码依赖十分混乱。

小组件中要使用的接口服务不会很多，所以我建议这里使用简单的网络请求即可。

当然由于widget类似于todayExtension，这里可以和todayExtension的网络请求策略保持一致。

#### 网络图片

SwiftUI中的Image没有提供直接加载URL方式的图片显示。在 `getTimeline`中进行数据请求中 `completion(timeline)`执行完之后，不再支持图片的异步回调，用异步加载的方式就无法加载网络图片，所以必须在数据请求回来的处理中采用**同步方式**，将图片的data获取，转换成UIImage，再赋值给Image展示

```swift
struct KrBaseWidgetEntity: Mappable {
    var itemId: Int?
    var itemType: Int?
    var widgetTitle: String?
    var widgetImageURL: URL?
    var widgetImage: UIImage?
    var route: String?

    init?(map: Map) { }

    mutating func mapping(map: Map) {
        itemId <- map["itemId"]
        itemType <- map["itemType"]
        widgetTitle <- map["widgetTitle"]
        widgetImageURL <- (map["widgetImage"], CustomURLTransform())
        route <- map["route"]
      	//获取到图片地址后直接同步获取图片数据转换为UIImage然后在View里面转换为Image显示
        if let url =  widgetImageURL,let img = try? Data(contentsOf: url) {
            widgetImage = UIImage(data: img)
        }

    }

    init(id: Int, img: UIImage) {
        self.itemId = id
        self.itemType = 0
        self.widgetTitle = ""
        self.widgetImage = img
        self.route = defultRoute
    }

}
```

#### 埋点传值

小组件中埋点不宜设计过于复杂，因为小组件能够一直在操作系统界面上留存，但是主APP却不一定，需要传递埋点的时候只能在点击事件传递的URL中附带埋点值然后在APP内接收和处理的时候再提取固定的埋点字段。

```swift
		//目前有一个自定义的埋点传值 类似"media_event_value=click_mor_and_eve_widget"
		let routeStr = route ?? defultRoute
    var pathURL =  URL(string: "TestWidget://\(widgetHost)?\(routeStr)")!
    if let trackStr = track {
        pathURL =  URL(string: "TestWidget://\(widgetHost)?\(routeStr)&\(trackStr)")!
    }
```

### Widget踩坑

#### 强制使用SwiftUI

这次的小组件更新强制使用SwiftUI可以看到苹果的目标和态度。对这个UI库不熟的话开发起来还是有点困难，不过正好也可以通过Widget对swiftUI进行一次实战训练。

#### 偶现第一次添加小组件到桌面UI渲染失败(系统不调用getTimeLine)

测试过程中发现的一个问题

APP第一次安装，第一次添加小组件的的时候，如果不等待小组件预览渲染完成就直接点 `添加到桌面`会触发初始化失败问题

断点调试发现这个时候操作系统不调用（有时候会等很久才调貌似是线程被阻塞了）`getTimeLine`方法，导致页面加载不成功，由于timeline获取失败，其后续的刷新时间点也没法确定，则最后全部都不能刷新。

#### 刷新不及时

自己使用的一些其他家的小组件，例如上文提到的日历，偶尔能看到小组件上还保持着昨天的日期，这让我感觉体验很差。

这个新兴事物还有待优化呀。
