---
title: APP内部代理
date: 2021.01.18
group: Notes
slug: app-proxy
summary: 不用每次去 Wi-Fi 设置里手动配代理:在 App 内部直接接管网络代理,抓包与日常使用两不误。
---

### APP内部代理

---

#####  wifi的代理配置不会自动保存？

使用iPhone的大概都遇见过这种事情：

每次需要给APP抓包的时候都需要到设置-WIFI-下手动配置代理，然而当我们连着代理的时候无法访问App Store或其他禁止代理的服务，这个时候我们会把WIFI的代理给关闭。

弄完杂七杂八的东西之后回到抓包调试，打开WIFI设置页，手动配置代理...

？？？

我刚才填的本机IP和端口呢？我还得再输一次？WTF！

---

##### 解决方案一

弄两个wifi信号，一个挂笔记本的代理不关，另一个正常联网，需要切换代理的时候切换wifi。

 说实话操作起来挺麻烦的，并且公司只有一个公用的wifi信号，想弄一个新的信号还需要运维小伙伴来搞，难顶。

---



##### 解决方案二

安装VPN软件，配置本地代理规则，需要抓包的时候打开网络代理。

小火箭之类好用的软件需要美区账号安装，每个测试机都可能会有这个需求，不可能每个测试机都这么操作一遍。

---



##### 解决方案三

APP内部通过代码设置代理，只在APP内部生效，开发环境使用，可持久化配置文件。

去goole了一圈，发现`URLSessionConfiguration` 中有个字典专门保存代理信息`connectionProxyDictionary` 

官方这么说的：

>This property controls which proxy tasks within sessions based on this configuration use when connecting to remote hosts.
>The default value is NULL, which means that tasks use the default system settings.

也就是说默认NULL的时候是走系统的代理设置，如果我们自定义的话就走我们APP内部自定义的代理设置咯。

同理如果我们强制将这个值置空就能够避免我们的请求走隧道也能防止别人抓包辣！

---



##### 动动小手试试效果

我们工程中使用了`Moya`来做网络封装，`Moya`内部使用`Alamofire`来请求网络，不论是`Moya` 还是`Alamofire`都不影响实际的代码效果。因为他们都使用了`URLSessionConfiguration`的单例，只需要在构建网络请求的时候添加上对应的代理信息即可。

```swift
private var alamofireConfiguration: URLSessionConfiguration {
        let configuration = URLSessionConfiguration.default
        #if DEBUG
        configuration.timeoutIntervalForRequest = 30
        if let proxyHost: String = UserDefaultManager.object(forKey: UserDefaultsKeys.Test.proxyHost),
           let proxyPort: Int64 = UserDefaultManager.object(forKey: UserDefaultsKeys.Test.proxyPort) {
            var proxyConfiguration = [AnyHashable:Any]()
            //HTTP
            proxyConfiguration.updateValue(1 as AnyObject, forKey: "HTTPEnable")
            proxyConfiguration.updateValue(proxyHost as AnyObject, forKey: "HTTPProxy")
            proxyConfiguration.updateValue(proxyPort as AnyObject, forKey: "HTTPPort")
            //HTTPS
            proxyConfiguration.updateValue(1 as AnyObject, forKey: "HTTPSEnable")
            proxyConfiguration.updateValue(proxyHost as AnyObject, forKey: "HTTPSProxy")
            proxyConfiguration.updateValue(proxyPort as AnyObject, forKey: "HTTPSPort")
            configuration.connectionProxyDictionary = proxyConfiguration
        }
        #else
        configuration.timeoutIntervalForRequest = 10
        #endif
        return configuration
    }
```

最后再做个保存设置功能之类的东东就大功告成了！

使用起来十分舒服，再也不用老去WIFI设置页去填自己电脑的IP和端口了，在APP内部设置然后持久化一下就可以抓包分析而且不担心影响其他APP了。

当然要记得控制好开发环境，不要影响线上业务哦！

