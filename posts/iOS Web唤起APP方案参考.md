---
title: iOS 一键唤起APP方案参考
date: 2021.12.06
group: iOS
slug: ios-web-open-app
summary: H5 活动页一键唤起 App:URL Scheme、Universal Links 与下载引导方案对比。
---

## iOS 一键唤起APP方案参考

移动端业务发展过程中，几乎每个公司都会有活动宣传或者运营引流的需求。这些需求的实现不外乎开发一些吸引人的HTML页面，在页面的某些事件的响应中引导用户下载APP或者打开已经下载的APP。

基本流程为：

1. 策划运营投放活动链接（新用户送红包或者PDD砍一刀）

2. 用户点击活动链接进入活动页面

3. 用户被吸引或诱导点击某个按钮触发事件

4. H5页面调起相关APP

5. APP响应调起并接力打开对应页面

我们这里主要说一说4、5两步其中的细节处理，也是对最近相关的业务的一个总结。



### DeepLink技术

在`iOS9`之前只有通过`URL Scheme`能够唤起一个APP。

`Scheme`可以理解为一个APP的名字，因为是`URL Scheme`所以遵循URL的书写格式，类比于`http://www.baidu.com`，其中`http`就是它的`Scheme`。

每个APP可以设置自己的Scheme，即给自己起个名字，方便”别人“叫我的时候我可以听得懂。

例如我们起了个`Scheme`叫`kr`，那么在H5页面内可以通过 `openURL()`的方式打开 `kr://testPage`链接调起我们的APP，当然如果你知道别人的`Scheme`就可以调起他的APP。

这个时候就需要H5和APP约定好连接的`path`和`parameter`，APP端根据调起的链接中的`Path`来确定要跳转的目的页，根据传参来获取需要的数据比如文章ID、用户ID等，然后根据参数加载原生页面。这样就完成了从H5到原生APP的接力跳转。

---

#### 如何给自己的APP"起名"？

注册URL Scheme，即配置info.plist 文件

![](https://cdn.zcx.info/008i3skNly1gv92vcxu6jj60u206ewex02.jpg)

####  如何响应被调用的跳转

检测到H5向自己发起了调用请求，我们需要对请求进行响应。在AppDelegate类中通过系统预留方法进行处理。

```swift
// iOS9之前使用这个方法处理外部URL调用 
func application(_ application: UIApplication, handleOpen url: URL) -> Bool {
     
}
```

iOS9之后使用这个方法处理外部URL调用，示例代码中展示了若干个可以调起APP的途径，根据具体的路径和参数来处理不同的逻辑。 

```swift
func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any]) -> Bool {
  // 三方登录回调
  if LoginSettings.handleOpenURL(url) ?? false {
      return true
  }
  // 神策SDK回调
  if let sensor = SensorsAnalyticsSDK.sharedInstance(), sensor.handleSchemeUrl(url) {
      return true
  }
  // zfb支付回调
  if url.host == Constants.KrOpenAppSource.AliPayHost {
      KrThirdPayManager.default.processOrderWithZfbPaymentResult(url: url)
      return true
  }
  // Today小组件点击
  if url.host == Constants.KrOpenAppSource.TodayExtensionHost {
      if let queryItems = url.queryItems, !queryItems.isEmpty {
          if let query = url.queryItems?.first {
              if let route = query.value, query.name == Constants.KrOpenAppSource.TodayExtensionQueryNews {
                  Router2.pushURL(route, TrackInfo(source: TrackSource.todayExtension))
              }
          }
      }
      return true
  }
  // widget小组件点击
  if url.host == Constants.KrOpenAppSource.WidgetExtensionHost {
      Router2.pushURL(urlStr, TrackInfo(source: TrackSource.widgetExtension))
      return true
  }
  // URL Scheme 唤起app
  if canAppHandleURL(url) {
      let urlString = url.description
      let tempArray = urlString.components(separatedBy: "route/")
      if !tempArray.isEmpty, tempArray.count > 0 {
          let route = tempArray[1]
          Router2.pushURL(route, TrackInfo(source: TrackSource.linkedMe))
      }
      return true
  }
  // app store 唤起
  if let sourceApp = options[UIApplication.OpenURLOptionsKey.sourceApplication] as? String,
     sourceApp == Constants.KrOpenAppSource.AppStore {
      TrackManager.track(event: .appLaunch)
  }
  // 处理旧版微信通过URL启动App时传递的数据
  if url.scheme == ShareManager.Wechat.appID {
      return WXApi.handleOpen(url, delegate:self)
  }
  return false
}
```

#### DeepLink的局限性

##### 无法检测目标APP是否安装

> 我知道你叫什么就可以调起你，但是我不知道你在不在。

H5无法获取APP是否已经安装过，所以大部分的处理方案是在发起调用APP的链接之后几秒直接跳转到对应APP的下载页面。

即如果能够调起APP，用户就不会再关注H5页面， H5页面跳到哪里用户也看不见。

反之就稍等一下跳转到APP的下载页面引导用户下载。

##### Scheme冲突

>和你叫周杰伦我也叫周杰伦一样，大家都是周杰伦。
>
>当周杰伦真正回应你的呼唤的时候你才知道你调起的是哪个周杰伦，真~薛定谔的周杰伦...

由于每家的APP都自己注册自己的URL Scheme，所以有可能出现两家APP的URL Scheme注册的一样的情况。当两个APP都安装之后就会出现问题，不确定调起的是哪个APP。

##### 调起流程冗余且可能被阻断

> 将在xxx中打开页面，是否继续？

由于是使用js方法openURL来调起的APP，在调起之前系统会询问你是否在xxxAPP中打开连接。

这个询问是一个比较突兀的alert弹窗，所以在不知情的用户看来可能会认为存在一定的风险从而取消打开导致唤起APP中断。如果在这里中断则用户极有可能会直接返回上一页或者直接取消整个操作，前功尽弃！

### UniversalLink技术

>Seamlessly link to content inside your app, or on your website in iOS 9 or later. With universal links, you can always give users the most integrated mobile experience, even when your app isn’t installed on their device.
>
>苹果开发文档

`UniversalLink `技术是苹果在`iOS9`之后推出的一种使用`HTTPS`协议的，可以方便得使用已经存在的链接同时打开网址和唤起APP的新功能。

相对于DeepLink技术来说，UniversalLink在使用体验上是类似的。明显区别在于用户点击了支持的通用链接后会直接调起APP，进入APP内部处理逻辑，而不会再弹起提示信息弹窗以达到从H5页面无缝衔接到APP内部的效果。（可能会在第一次使用UniversalLink时还会弹窗，但是授权之后就不再弹出了）

#### UniversalLink的优点

但是相对于`DeepLink`技术，`UniversalLink`技术还具有着以下优点：

**唯一**：与自定义`URL`方案不同，其他应用无法声明通用链接，因为通用链接使用的是指向您网站的标准`HTTP`或`HTTPS`链接

>- **Unique.** Unlike custom URL schemes, universal links can’t be claimed by other apps, because they use standard HTTP or HTTPS links to your website.

每个APP控制自身可以支持的通用链接的域名，由于域名的注册和解析都具有唯一性，通用链支持的域名一定不会出现和别家APP重复的情况。

---

**安全**：当用户安装您的应用程序时，iOS会检查您已上传到Web服务器的文件，以确保您的网站允许您的应用程序代表其打开URL。只有您可以创建和上传此文件，因此您的网站与应用程序的关联是安全的。

>- **Secure.** When users install your app, iOS checks a file that you’ve uploaded to your web server to make sure that your website allows your app to open URLs on its behalf. Only you can create and upload this file, so the association of your website with your app is secure.

通用链接的域名配置写在项目中且每个可以支持通用链的域名都需要上传一份提供判断是否满足通用链接对应的配置文件。

配置文件规定了支持通用链功能的域名后的path和可以调起的APP，比如配置文件中规定了`www.abc.com/app/UniversalLink/*`这个路径可以打开`abcAPP`，那么只有访问对应的链接才能调起对应的APP。

---

**灵活**：即使未安装您的应用程序，通用链接也可以使用。如果未安装您的应用程序，点击指向您网站的链接可在Safari中打开内容。

>- **Flexible.** Universal links work even when your app is not installed. When your app isn’t installed, tapping a link to your website opens the content in Safari, as users expect.

不用管用户是否安装了对应的APP，如果没有安装对应的APP，用户点击的链接也是一个有效的页面地址，会在浏览器中继续打开所点击的链接呈现出对应的内容。

常规的做法是在某个通用链链接的地址上放APP的下载引导页，如果用户未安装APP而点击了通用链接就会直接跳转到下载页。

对于iOS用户来说这个下载页也可以尝试重定向到`App Store`的通用链接。`App Store`对每个APP的下载页面都提供了可用的通用链接，重定向到`App Store`通用链会直接调起应用商店且打开APP下载页。

---

**简单**：一个URL既适用于您的网站，也适用于您的应用程序。


> - **Simple.** One URL works for both your website and your app.

一个正常使用的URL即可当做通用链功能进行配置，同时不影响其本身的页面和功能。

---

**私有**：其他应用程序可以与您的应用程序通信，而无需知道您的应用程序是否已安装。

> - **Private.** Other apps can communicate with your app without needing to know whether your app is installed.

通用链可以暴露给别的应用程序使用，像打开普通的webview一样的方式调起APP，而不用关心你是否真正下载了APP。你的通用链的功能和设置对其他APP来说是透明的。

---

**短信、备忘录、邮件内部均可使用**：

> 使用通用链的一大优势。

在iOS系统自带的短信、备忘录甚至邮件内的网页链接的点击也可以正常调起APP，这样发送给用户的引流短信或者邮件中均可附带对应活动的链接，如果用户有安装我们的APP，在点击链接时可以直接导向到APP内部对应的活动页面，不再需要Safari做中间人角色。如果用户未安装APP则跳到对应的活动页面，然后重定向到App Store的下载页。

---

#### 如何配置UniversalLink

网上很多朋友都分享了他们配置UniversalLink的过程，但是我还是建议去苹果官网上按照最新的文档说明进行配置。

[Support Universal Links](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

> - Create an `apple-app-site-association` file that contains JSON data about the URLs that your app can handle.
> - Upload the `apple-app-site-association` file to your HTTPS web server. You can place the file at the root of your server or in the `.well-known` subdirectory.
> - Prepare your app to handle universal links.

大体上分为三个步骤:

1. 在xcode的Associated Domains配置项中添加你需要映射的链接

   一般需要先去开发者账号的管理网站上为APP根证书开通这个功能，然后在XCode上进行域名配置。

   ![](https://cdn.zcx.info/008i3skNly1gvw7qzmkjdj30zn07lglw.jpg)

   

2. 创建`apple-app-site-association`文件并编辑配置
   ```json
   {
       "applinks": {
           "apps": [],
           "details": [
               {
                   "appID": "9JA89QQLNQ.com.apple.wwdc",
                   "paths": [ "/wwdc/news/", "/videos/wwdc/2015/*"]
               },
               {
                   "appID": "ABCD1234.com.apple.wwdc",
                   "paths": [ "*" ]
               }
           ]
       }
   }
   ```

   >The `appIDs` and `apps` keys specify the application identifiers for the apps that are available for use on this website along with their service types. Use the following format for the values in these keys:
   >
   ><Application Identifier Prefix>.<Bundle Identifier>
   >
   >前缀使用APPId 可以在 App Store Connect网站上找到APP的id，后面是APP的Bundle ID，可以在Xcode签名管理的地方找

3. 将`apple-app-site-association`文件放在链接的域名服务根目录下


   这个文件使用json格式但是并不能设置.json扩展名，仅仅作为纯文本文件放在对应链接域名下的根目录或者`.well-known`目录下，以方便系统访问到配置。

   比如你关联的域名为 www.test.com ，就需要把`apple-app-site-association`文件放在服务器的根目录下，在浏览器访问

   https://www.test.com/apple-app-site-association 链接可以下载此文件或者直接打开此文件。

####  配置UniversalLink需要注意的问题

1. 配置`apple-app-site-association`的域名必须支持HTTPS，且访问的链接没有被重定向
2. 每个被链接的域名下都要有自身的配置`apple-app-site-association`文件，**`www.test.com`和 `test.com` 不是同一个域名**，如果需要每个域名都需要通用链接功能则需要每个域名下都配置一个对应的文件。**如果这两个域名有重写规则且属于同一台服务器则会优先生效`www.test.com`而忽略`test.com`**。（虽然大部分公司都是将test.com重写为www.test.com，但是也有为了SEO反向重写的例子）
3. 从 macOS 11 和 iOS 14 开始，应用程序不再直接向您的网络服务器请求`apple-app-site-association`文件。相反，他们将这些请求发送到专用于关联域的 Apple 管理的内容交付网络 (CDN)。所以在APP启动阶段不会抓到对应域名和路径的请求了。
4. 第一次安装APP的时候苹果CDN服务会在24 小时内为您的域请求`apple-app-site-association`文件进行配置，非第一次安装时每周检查一次通用链配置更新。

### 特殊的微信环境 

鉴于国内的网络社交大环境基本以微信为中心，所以每个APP的引流都绕不开微信生态环境。

而微信属于应用层APP，并不能像操作系统一样开放，基于安全性考虑，微信针对Deeplink和UniversalLink均做了不同程度的屏蔽。

#### 安全域名回调

在微信内部浏览器中是无法直接调起Deeplink的，一般通过微信分享出链接卡片，打开目的页面后再通过微信开放平台提供的安全域名功能来做Deeplink调用。

js调用安全域名下的DeepLink后会通过微信的onReq回调来接收请求，然后解析传递的数据进而做出页面跳转功能。

大体的逻辑如下

![微信环境下使用DeepLink流程](https://cdn.zcx.info/008i3skNly1gw4bj7l2lej31280u0411.jpg)

#### 通用链跳转

而针对UniversalLink的屏蔽则表现为无法通过UniversalLink调起APP，只能打开对应的落地页。不过最近由于某些政策的调整，微信针对UniversalLink的屏蔽已经被放开了。目前可以正常在微信环境内使用通用链跳转功能（只要你要跳转的目的链接和当前链接是跨域的并且正确安装配置了对应的通用链的APP）。

![](https://cdn.zcx.info/008i3skNly1gw7uwunklrj31da0u0n07.jpg)

#### 屏蔽链接分享

鉴于对UniversalLink的放开，微信对某些竞争对手做出了限制链接分享的功能。比如某多多和某宝是无法使用微信卡片分享的，所以针对这种场景他们做出了分享文字到微信的功能，即发送常一大串带标识码的文本到微信，然后通过系统粘贴板作为中转到APP内（常见的“复制这段话到xxxAPP打开即可获得xxx红包”）。



### 总结

不论是DeepLink技术 还是UniversalLink技术，都可以实现我们的需求。

在使用体验上来说还是UniversalLink技术更胜一筹。

