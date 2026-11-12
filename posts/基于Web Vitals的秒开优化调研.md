---
title: 基于Web Vitals的秒开优化调研
date: 2025.05.09
group: iOS
slug: web-vitals-fast-open
summary: 以 Web Vitals 为指标,调研 App 内 H5 页面秒开的度量与优化手段。
---

## 需求背景

项目中上线的H5页面越来越多，用户在Web页面的体验变得更加重要。

随着网络带宽不断发展增大，人们对网页的打开速度要求也变得越来越高。

## 性能指标

做性能优化之前首先需要明确相关指标。明确性能指标就是要明确我们关注哪些数据，这些数据如何测量，什么数据算是好的，什么数据算是不好的。

拿到我们需要的指标数据之后才能再针对特定的场景进行优化。

### 基于Core Web Vitals的指标

多年来Google提供了许多工具衡量和报告网页加载效果，有些开发者擅长使用这些工具，而有些开发者因为工具和指标众多难以跟上节奏。

这里我们按照Chrome的最新LightHouse给出的以用户为中心的标准化指标Web Vitals来衡量网页的性能。

其中我们最关心以下指标：

![20250509142715](https://gcore.jsdelivr.net/gh/zcx4u/images/images/20250509142715.png)

#### LCP 最大可视内容绘制时间

LCP 会报告视口内可见的最大图片、文本块或视频的渲染时间（相对于用户首次导航到网页的时间）。

从用户视角来看，相比于其他指标LCP最能反映出页面加载的速度。

为了提供良好的用户体验，一个网页应该在2.5s内完成最大可视内容加载。

#### INP 输入延迟时间

输入延迟时间指用户交互中点击网页后的延迟时间，网页的INP不应超过200ms。

#### CLS 页面布局累积偏移量

CLS指网页在加载中页面布局总计偏移量，用来衡量页面稳定性，避免过多的闪烁带来较差的用户体验。网页的CLS应该低于0.1。

#### p75

用户网络环境良莠不齐，再精致的优化也不能保证所有的用户都能达到这些指标的建议值。

一个合适的衡量阈值是按照不同的设备进行区分的网页加载时间的第75个百分数。即有75%的用户达到了这些指标的建议值就将其视为通过性能测试。

#### FCP Safari平台对LCP的平替（白屏时间）

FCP 测量用户导航到页面后浏览器呈现初始 DOM 内容所需的时间。页面上的图像、非白色元素和 SVG `<canvas>`被视为 DOM 内容。iframe 内的任何内容均不包含在内。

一个良好的页面应该保持FCP在1s以内。

> [Webkit 声称2025年会支持LCP](https://webkit.org/blog/16458/announcing-interop-2025/#core-web-vitals)

> In Safari 18.0, we updated our implementation to the latest spec, but there’s more work to do to reach full interoperability.
> Core Web Vitals
> The performance of your website is key to providing a fantastic user experience, and we know it’s top-of-mind as you write code. We’ve heard your > >  requests for cross-browser support of the popular Core Web Vitals, and we are excited to have them on the agenda for 2025. The focus areas includes:
> Largest Contentful Paint (LCP)
> Interaction to Next Paint (INP)
> Having these metrics available in all browsers allows you to track how quickly and smoothly users can interact with a page, no matter which platform they are on.

## 检测工具

检测工具根据数据源的不同大致可以分为两类：

分别以线上和dev环境来区分为基于真实用户数据的检测工具和基于实验室数据的检测工具。

### 基于实验室数据的工具

大多是指在开发者做针对性优化时为测试出网页数据使用的工具。例如 PageSpeed Insights、Chrom DevTools、Lighthouse、Web Vitals Extension 等等。

最直接的就是Chome浏览器开发者模式选择Lighthouse：

![20250509144435](https://gcore.jsdelivr.net/gh/zcx4u/images/images/20250509144435.png)

### 基于真实用户数据的工具

可以理解为线上用户使用场景下采集数据的工具。例如 web-vitals、CrUX、等等。

其中基于web-vitals的已经有成熟的存储和可视化查询工具。

例如我们私有化部署的Sentry

![iShot_2025-05-09_14.11.27](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-05-09_14.11.27.png)

或者是开源项目 Grafana

![iShot_2025-05-09_14.10.16](https://gcore.jsdelivr.net/gh/zcx4u/images/images/iShot_2025-05-09_14.10.16.png)

## 性能优化

了解了**性能指标**和**检测工具**后就是真正的重头戏--**性能优化**。

根据实践中的总结，所有的优化手段大致可以分为两类：系统级优化和针对性优化。

### 系统级优化

顾名思义，不针对某个具体功能或者指标的整体性的优化。例如前端的架构选型，项目脚手架、模板、编译构建、组件库等，还有服务端和客户端配合做的一些优化。

#### 服务端渲染-SSR

常规的CSR架构下天然存在一些缺陷，比较明显的是LCP问题。

因为CSR架构下服务端返回了Html之后还要等待CSS，JS加载完成后才能看到Dom页面。这样就导致用户需要等待浏览器渲染Html，白屏时间较长。

而SSR通过服务端渲染首屏内容，请求返回后可以直接看到（部分）页面内容。

这样可以让用户在第一时间看到首屏页面，配合一些数据预加载手段可以大大缓解LCP问题。

另外由于服务端已经将页面结构渲染好了，基本不会出现大范围的Dom结构位移，也就不会出现CLS问题。

但是SSR架构会带来额外的问题：

首先SSR架构强依赖接口的性能，如果服务端接口迟迟不能响应，且前端没有做CSR降级，用户体验就会更加劣化。

其次用户虽然能看到页面内容，但是在刚加载出页面时会密集的执行大量任务导致用户无法进行交互和操作，其体验也不好。

而CSR架构中页面初始化时的任务都是比较分散的，一定程度的降低了longTask的产生。

针对这些问题，前端技术又衍生出来很多解决方案这里不再一一阐述。

#### 离线包

在APP环境内开发者可以针对Webview做各种各样的修改，拥有更强更自由的定制化能力。

而离线包的思路就需要客户端和服务端相互配合，通过将Web页面资源进行打包下发的方式在加载页面的时候直接从APP内访问本地资源从而减少用户等待时间。

也就是说将一个包含HTML、JS、CSS、图片等静态资源的压缩包放到APP本地，APP拦截Webview的请求并使用本地资源响应，从而最大程度的摆脱网络环境对H5页面的影响。

粗看离线包仅仅去解决网络问题，不过如果能彻底解决加载问题，对用户体验的提升还是非常大的。但是围绕**离线包**这个点需要做的工作还有很多的。

### 针对性优化

大多是针对某个具体的指标，某种具体类型的资源。需要具体情况具体分析，比如优化资源的加载优先级，动态import，拆分longTask等。

## APP侧秒开优化

回到正题，秒开指的是我们想对APP环境内的H5页面加载时间进行优化。对应上文属于从APP系统级对LCP指标的针对性优化。

从APP开发者的视角开发对应的方案也显而易见 -- 离线包。

### 离线包方案预估收益

### 离线包方案调研

市面上关于离线包的技术方案也基本类似，比较其原理是一致的。资源预加载 -> 拦截请求 -> 命中缓存 -> 渲染WebContent。

以京东开源的离线包方案为例，拦截以及匹配流程如下：

![20250509154959](https://gcore.jsdelivr.net/gh/zcx4u/images/images/20250509154959.png)

看似简单的流程中还存在很多细节需要处理，也有很多风险点需要特别注意。

#### Webview请求拦截

Android Webview 可以通过重写 shouldInterceptRequest 方法进行拦截Http请求进行资源查询并返回。

iOS WkWebview可以通过WKURLSchemeHandler拦截自定义scheme请求但是未提供拦截http(s)请求的接口。

目前可以通过一些黑魔法进行hook来达成拦截http(s)的目的。

一旦拦截到请求就可以去本地静态资源池中进行匹配，如果命中本地资源就可以直接返回本地的数据，跳过请求网络的等待环节。

请求拦截阶段存在一些问题：

由于Webview发起请求和APP内部请求不在同一个进程，其Cookie、Header等很多内容不能共享，需要额外的工作量去处理这些问题。

iOS通过hook手段支持拦截Http(s), 这意味着在Webview中所有的非离线包的请求也需要开发者手工处理，其风险等级陡升。

而且随着官方API变更以及审核条款变更，hook方法可能会失效，一旦失效等于离线包的基础已不存在，基于离线包做出的设计全部作废。

#### 资源更新和分发能力

服务端需要开发离线包更新和下发功能，前端需要开发打包离线包资源功能，APP需要开发资源包的下载和管理功能。

#### 差量更新

打离线包资源下发这一环节还有比较重要的内容要考虑--带宽压力。

前端页面更新很快，不可能一点点页面变动就推送全量的资源包到APP，所以这里还需要做差量更新，APP需要做基于diff算法的文件管理和维护。

另外APP主动获取资源包的时机也有待考究，对网络环境和APP业务任务优先级处理需要有比较细致的操控。

还有加载速度和资源实时性的取舍，需要实现**动态离线**，对不同的权重的页面实施不同的离线策略。

#### 接口预请求

在资源预加载的基础上我们还可以对特定页面需要的数据进行接口数据预加载。

APP可以在初始化Webview的同时异步去请求这个页面需要的接口数据保证H5更早的拿到数据来减少LCP时间。

当然如何识别某个页面需要什么请求什么接口还需要进行定制化配置的开发。

#### 多语适配

对离线包来说多语适配还存在一些问题需要解决，前端项目的多语资源很多，所以需要考虑打静态资源的时候拆分需要展示的i18n资源进行下发。

另外APP内切换了语言之后如何动态切换静态HTML的语言也要和当前项目中的i18n的实现相关联。

#### 容器预热

得益于APP对Webview更加自由的定制化，APP内加载H5页面还有一些手段可以提升加载速度 - 容器预热。

Webview初始化也需要一定时间，所以APP启动后就可以创建Webview复用池来预创建容器。

当前用户击一个链接后直接从内存中取出预热的容器直接加载URL，缩减用户从点击到看到第一帧画面的时间。

严格来说容器预热不从属于离线包的技术范畴，所以预热中的容器也可以提前请求一些公共JS库（非离线）。

利用Http的Cache-Control先把H5页面可能使用到的公共JS加载到内存缓存中，可以一定程度提升首次加载页面的速度。

### 离线包方案风险和弊端

#### 资源投入大

iOS和Android双端都要支持功能，并且要对齐具体的策略，更新和迭代需要双端开发。

需要服务端开发对应的离线包更新和分发服务，前端开发静态资源打包能力。

#### 维护成本高，易劣化

设计结构复杂，容易对现有业务产生负面影响，对风险范围难以控制，很容易出现bug。

### APP内Web秒开优化评估

#### 监控数据来源

Web端支持在sentry上报数据新增区分APP内环境的tag，可以通过此tag筛选处于APP Webview容器的数据集合。

![20250509180527](https://gcore.jsdelivr.net/gh/zcx4u/images/images/20250509180527.png)

Web端预计于5月第二周上线带入此修改，APP可以在第三周查询数据统计。

#### 预期采用方案

Web端已经进行了一波性能优化，已经处于灰度上线阶段。

从APP角度来看，基于离线包方案的收益和风险不成正比，目前可以先从容器预热着手。

## 参考资料

[Google Developer Lighthouse](https://developer.chrome.com/docs/lighthouse/performance)
[Core Web Vitals 指标阈值是如何定义的](https://web.dev/articles/defining-core-web-vitals-thresholds?hl=zh-cn)
[Webkit 声称2025年会支持LCP](https://webkit.org/blog/16458/announcing-interop-2025/#core-web-vitals)
[使用 Sentry 做性能监控](https://juejin.cn/post/7151753139052347399)
[Android 拦截Webview请求](https://juejin.cn/post/6923415236049534989)
[京东离线包开源方案](https://github.com/jd-opensource/JDHybrid/tree/main/iOS/JDHybrid/JDCache)
