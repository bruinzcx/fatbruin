---
title: iOS编译优化方案探索与实践-组件篇
date: 2021.09.18
group: iOS
slug: ios-build-optimization-pods
summary: CocoaPods 组件二进制化:源码与二进制切换,缩短本地与 CI 全量编译时间。
---

### 序言

目前主流的项目构建方案中几乎都使用cocoapods进行组件库管理，不论是第三方开源库还是自研的私有库，都会生成.podspec文件使用cocoapods工具进行维护。

为了便于进行调试，第三方开源库或私有代码库 我们都以源码的方式进行引入。

每次在本机进行全量编译或者ci机器进行打包的时候都会先编译pod仓库中的源代码，然后链接到主项目中。

这个流程没有问题，但是随着项目的的大量迭代和长时间维护，引入的仓库会越来越多。以我们的项目为例，项目迭代了3年左右，引入的第三方仓库达到了30+个。在我的mac上进行一次全量编译时间达到了500s，性能稍差的设备编译消耗的时间更长。

针对组件库的编译时长的优化方案很简单，把cocoapods仓库中引入的需要编译的源码改成不需要编译的二进制库即可。

当然一刀切的引入方式切换是不可取的，根据自身的实际情况，对一些基本不会进入调试的代码和一些稳定版本的常用的仓库进行二进制化较为合适。


针对以上想法有了一些cocoapods插件可以使用。

### Cocoapods-Binary
cocoapods 1.6.x版本的时候常用的一个仓库，大家可能都用过，其思路是在cocoapods进行install操作时通过将 dependencies 预编译成 binary 后缓存至本地，然后将原有的 Source Code link 到 binary 以几乎零成本的方式实现编译效率的提高。

也就是说在pod install的过程中先进行预编译，预编译之后每次pod install都将编译完的二进制link到项目，这样就完成了源码到二进制的转化。

规模较小的团队非常适合这种方案，没有什么额外的成本，成员协作之间也不会产生冲突，通过简单的 :binary => true指令即可设置仓库的二进制和源码的切换。

>但是目前这个库不再维护了，同时在swift方面也存在着一些问题
由于 CocoaPods 在 1.7.x 以上版本，修改了 framework 生成逻辑，不会把 bundle copy 至 framework，因此我们需要将 Pod 环境固定到 1.6.2
pod 要支持 binary，header ref 需要变更为 #import <>或者 @import 以符合 moduler 标准
统一 CI 和开发的 compiler 环境，如果项目支持 Swift，不同 compiler 编译产物有 Swift 版本兼容问题
最终的 binary size 会比使用源码的时候大一点，不建议最终上传 Store
建议 Git ignore Pods 文件夹，否则在 source code 与 binary 切换过程会有大量的 file change，增加 git 负担
---引用自[浅析 Cocoapods-Binary 实现](https://juejin.cn/post/6844904025624674311)

### cocoapods-imy-bin

cocoapods-imy-bin 插件是美柚团队开源的cocoapods二进制管理方案。

其核心思想是先制作二进制文件，然后上传到文件服务器进行保存，在pod install 阶段动态判断三方库是否在本地私有源有二进制记录，如果有就会将此库的源替换成二进制源然后下载二进制文件，进而link到项目中完成源码和二进制的切换。

[iOS编译速度如何稳定提高10倍以上之一](https://juejin.cn/post/6903407900006449160#heading-3)

[iOS编译速度如何稳定提高10倍以上之二](https://juejin.cn/post/6903408514778497031#heading-1)

所谓实践出真知，咱就试一试看看效果。


### cocoapods-imy-bin实践

[cocoapods-imy-bin使用教程](https://github.com/MeetYouDevs/cocoapods-imy-bin/blob/master/使用教程.md)

[cocoapods-imy-bin-demo工程](https://github.com/su350380433/cocoapods-imy-bin-demo)

[binary-server 静态资源服务器](https://github.com/su350380433/binary-server)

按照使用教程开始操作：

#### 1、首先创建二进制仓库私有源

可以选择私有的github/gitlab仓库，这个仓库负责二进制源cocoapods repo的维护。

添加到本地repo
``` ruby
pod repo add example_spec_bin_dev git@github.com:su350380433/example_spec_bin_dev.git
```

坑点：cocoapods-imy-bin配置私有源时只支持ssh，因此要修改以前的https的源，对ssh操作不熟练的需要google出现的问题及解决方案。

> git@xxx.com ssh一直报错，之前的公钥有密码,通过ssh连接私有库的时候一直报错让输入密码，但是输入之后还是不行,报错无授权,重新生成rsa秘钥对之后尝试还是不行，报同样的错误。最后发现是git地址没有给对，从cocoapods file中拷贝出来的时候带了一个source字符串，所以ssh授权一直失败（地址都错了授权肯定失败啊）

创建repo不能仅仅拉一个git仓库就行了，还得找一个已有的仓库进行.podspec文件push ，否则添加此源之后 执行pod repo update 会一直失败。

>新增空的pod repo 之后 pod repo update 一直失败,尝试push一次已有的.podspec文件再更新repo才成功

```ruby
# pod push 命令
pod repo push demo_binary_source APPLog.podspec --allow-warnings
```


#### 2、搭建静态资源服务器

本质是一个可以接收和下载文件的服务器，使用Node承载服务，使用MongoDB存储数据。 可自行选择ECS或者其他文件服务器，做测试的话可以在本地搭建。

先搭建数据库(Mac)

文档上MongoDB是在官网下载安装的，但是实测有很多文件夹权限问题，改用homebrew安装。
brew install mongodb 命令失效，且官网不再开源，这里改用homebrew的社区版。

```ruby
brew tap mongodb/brew #先执行这个
brew install mongodb-community@4.2 #等一小会执行这个 安装4.2版本的 
```
安装完毕后需要设置环境变量才能使用，根据终端使用的zsh还是bash各自在配置文件设置

```ruby
export PATH=$PATH:/usr/local/Cellar/mongodb-community@4.2/4.2.9/bin
```
安装完毕后测试结果，然后使用Mac系统服务的方式打开数据库，这样不用依托终端窗口，即使终端窗口关闭了数据库也不会关闭。

```ruby
mongod -version #测试是否安装成功
#除了安装包文件，安装还创建了以下文件和目录：
#配置文件（/usr/local/etc/mongod.conf）
#日志目录（/usr/local/var/log/mongodb）
#数据目录（/usr/local/var/mongodb）
#将MongoDB作为系统服务启动 不再依托终端窗口
brew services start mongodb-community@4.2 //启动
brew services stop mongodb-community@4.2 //停止
brew services restart mongodb-community@4.2 //重启
```
也可以执行mongo shell命令查看数据库启动状态

```ruby
mongo
```
![mongodb启动shell](https://cdn.zcx.info/008i3skNly1gukuhvxnh2j613i0u0gr602.jpg)

到这里 你的数据库就搭好了也启动起来了。

然后搭建静态资源服务器

先下载服务源码：

```ruby
git clone git@github.com:su350380433/binary-server.git
cd /binary-server #进入到你下载binary-server的根目录去
npm install #安装依赖包
npm start # 启动node
```
这是文件服务器App.js源码：
```js
const Koa = require('koa')
const router = require('./server/routes')
const logger = require('koa-logger')
const mongoose = require('mongoose')
const koaBody = require('koa-body')

const app = new Koa

mongoose.connect('mongodb://localhost/binary_database')

app.use(koaBody({ multipart: true }))
app.use(logger())
app.use(router.routes())
app.listen(8080)
```

由此可见，文件服务器创建了binary_database数据库，并且占用了8080端口。

执行了npm start之后可能会出现两个问题

8080端口已经被占用：出现这个问题有可能是你之前安装过其他服务也占用这个端口，可以切换静态资源文件的使用端口修改app.listen(8080)即可，或者和我一样直接把不用的其他服务关掉。

数据库连接失败：出现这个问题可以看一下具体的报错内容，根据不同的内容处理。如果出现

```ruby
...
getaddrinfo ENOTFOUND localhost     at GetAddrInfoReqWrap.onlookup
...
```
这样的报错的话很可能是你的设备没有做localhost的127.0.0.1的映射。db使用的链接是ip地址，但是静态资源服务中的代码里连接数据库使用的是localhost，且端口是db的默认端口，如果你数据库改过端口号，那这里一定要修改数据库连接地址。

```ruby

> binary-server@0.1.0 start /Users/zcx/binary-server
> node app.js

```
如果一切顺利，这里node服务器就启动起来了，监听8080(或你设置的)端口，提供http服务。

#### 3 安装和初始化cocoapods-imy-bin插件

安装这一步比较简单 直接执行gem命令安装插件即可

```ruby
sudo gem install cocoapods-imy-bin
```
初始化插件配置：
```ruby
xx:Demo slj$ pod bin init #执行这个命令 根据提示信息进行下一步的操作

======  dev 环境 ========

开始设置二进制化初始信息.
所有的信息都会保存在 /Users/slj/.cocoapods/bin_dev.yml 文件中.
%w[bin_dev.yml bin_debug_iphoneos.yml bin_release_iphoneos.yml] 
你可以在对应目录下手动添加编辑该文件. 文件包含的配置信息样式如下：

---
configuration_env: dev
# 上面这个是环境切换选项 先不改 目前先配一套环境
code_repo_url: git@github.com:su350380433/example_spec_source.git
# 上面这个是正在使用的私有源地址
binary_repo_url: git@github.com:su350380433/example_spec_bin_dev.git
# 上面这个是新增的二进制私有源地址
binary_download_url: http://localhost:8080/frameworks/%s/%s/zip
# 上面这个是新创建的服务器地址 默认使用的本地 %s是动态替换三方库的名称的 这里不要改
download_file_type: zip
# 上面这个是二进制传输用的压缩格式 一般都zip也不用改

# 以上的配置都可以在配置文件里进行更改
open /Users/zcx/.cocoapods/bin_dev.yml  #文件保存 插件的配置信息
```
到这里准备工作就算是就绪了，可以开始制作二进制文件了。

#### 4 制作二进制文件

想要制作一系列的三方库二进制组件，必须得有个文件存储三方库的列表吧，所以这里还得准备一个.podspec文件来维护你想要制作的库。

在项目根目录新增一个`demo_binary_source.podspec`文件,内容如下（一个基本的依赖文件）
```ruby
# MARK: converted automatically by spec.py. @hgy

Pod::Spec.new do |s|
	s.name = 'demo_binary_source'
	s.version = '1'
	s.description = 'demo_binary_source'
	s.license = 'MIT'
	s.summary = 'demo_binary_source'
	s.homepage = 'https://gitlab-media.corp.demo.com/iOS/krmedium_binary_source'
	s.authors = { 'zcx' => 'zhouchuanxiang@demo.com' }
	s.source = { :git => 'git@gitlab-media.corp.demo.com:iOS/krmedium_binary_source.git', :branch => 'master' }
        s.requires_arc = true
        s.ios.deployment_target = '11.0'
        s.source_files = 'Source/**/*.{h,m,c,swift}'
        s.public_header_files = 'Source/**/*.{h,swift}'
        #objc依赖
        s.dependency 'Masonry', '1.1.0'
        s.dependency 'MJRefresh', '3.3.1'
        s.dependency 'SDWebImage', '5.3.1'
        s.dependency 'YYCategories', '1.0.4'
        s.dependency 'MJExtension', '3.2.2'
        s.dependency 'MBProgressHUD', '1.1.0'
        #demo项目依赖
        s.dependency 'KeychainAccess', '4.1.0'
        s.dependency 'Moya/RxSwift', '13.0.1'
        s.dependency 'ObjectMapper', '3.4.2'
        s.dependency 'IQKeyboardManagerSwift', '6.5.1' #键盘管理
        s.dependency 'RTRootNavigationController', '0.5.19' #UI
        s.dependency 'Kingfisher', '5.15.4' #图片处理
        s.dependency 'Zip'
        s.dependency 'SnapKit', '5.0.1'
        s.dependency 'Stencil'
        s.dependency 'iCarousel', '1.8.3'
        s.dependency 'YYText', '1.0.5'
        s.dependency 'lottie-ios', '3.1.9'
        s.dependency 'YYCache', '1.0.4'
        #debug调试工具
        s.dependency 'NetSwitch'
        s.dependency 'LookinServer'
end

```
文件中所有的`dependency`依赖都会被尝试制作二进制文件。制作二进制文件之前需要保证所有的`repo`都是正常的，每个三方库的源都指向原始源（源代码源），我们制作的时候会先获取源码进行编译。
把这个文件放在和`Podfile`同一个目录下，进入此目录，然后执行

```ruby
pod bin auto --all-make # 开始制作二进制
```
这个过程可能会根据你依赖的库报各种错误，比如我遇到的

```ruby
Installing...
Installing Realm (3.19.0)
Installing RealmSwift (3.19.0)
Installing demo_binary_source (1)
[!] /bin/bash -c
set -e
sh build.sh cocoapods-setup

sh: build.sh: No such file or directory

#执行pod bin auto --all-make 报错 不知道啥原因
#经排查 使用插件后 swiftRealm库附带的下载依赖脚本无法执行

Running prepare command
$ /bin/bash -c  set -e sh build.sh cocoapods-setup
Downloading dependency: 10.3.2 from https://static.realm.io/downloads/core/realm-monorepo-xcframework-v10.3.2.tar.xz

# 解决方案
单独的库无法处理，这里因为'Realm'编译源码也很慢，所以改成'xcframework'方式进行引入了。
解决问题的过程中可能遇见'pod repo'混乱的问题，
之前尝试的 '--all-make'命令 生成了一部分二进制和'repo'信息引起混乱
那就全部删掉，删掉'repo'源，删掉已经上传的二进制文件从头再来一遍 
```
解决完问题后再尝试进行二进制文件制作。如果顺利的话会看到制作结果。

![](https://cdn.zcx.info/008i3skNly1gukvojcuwpj60u015rjxk02.jpg)

同时可以检验一下新创建的 私有源中是否记录的二进制文件的地址信息。

![](https://cdn.zcx.info/008i3skNly1gukvrtyptvj61h30u0td202.jpg)

二进制文件制作好了，就差link到项目中了。

既然我们更新了私有源，这里最好把`cocoapods repo `更新一下再安装。

```ruby
pod repo update --verbose #更新源
pod install --verbose #你懂得
#然后你会看到执行的结果，部分三方库被替换成了打包好的静态库
======  dev 环境 ========
CDN: trunk Relative path: CocoaPods-version.yml exists! Returning local because checking is only performed in repo update
cocoapods-imy-bin 插件
- 开始处理 Alamofire 4.9.1 组件.
specification =Alamofire (4.9.1)
#<Pod::Resolver::ResolverSpecification:0x00007fc8369c9630>
cocoapods-imy-bin 插件
- 开始处理 AliPlayerSDK_iOS 5.4.0 组件.
cocoapods-imy-bin 插件
- 开始处理 AliPlayerSDK_iOS/AliPlayerSDK 5.4.0 组件.
cocoapods-imy-bin 插件
- 开始处理 AlipaySDK-iOS 15.7.9 组件.
cocoapods-imy-bin 插件
- 开始处理 Bugly 2.5.90 组件.
........
#<Pod::Resolver::ResolverSpecification:0x00007fc8370b0f48>
【AliPlayerSDK_iOS | 5.4.0】组件无对应二进制版本 , 将采用源码依赖.
【AliPlayerSDK_iOS/AliPlayerSDK | 5.4.0】组件无对应二进制版本 , 将采用源码依赖.
【AlipaySDK-iOS | 15.7.9】组件无对应二进制版本 , 将采用源码依赖.
【Bugly | 2.5.90】组件无对应二进制版本 , 将采用源码依赖.
【CocoaAsyncSocket | 7.6.5】组件无对应二进制版本 , 将采用源码依赖.
【GTSDK | 2.5.5.0】组件无对应二进制版本 , 将采用源码依赖.
......
```
最后查看`xcode`中的`pod`文件夹，从源码切换成了`framework`
![](https://cdn.zcx.info/008i3skNly1gukw1ce7iej60kq0fmq3x02.jpg)
如果没有出现`framework`的话可以尝试再更新一次`pod repo `和`执行 pod install`

`clean` 一下进行全量编译可以看到变化，优化前编译需要500s

![](https://cdn.zcx.info/008i3skNly1gukw4a4ri8j61tc0lijvv02.jpg)

优化后`tasks`减少到2500左右

![](https://cdn.zcx.info/008i3skNly1gukw3brvajj60x0038gly02.jpg)

编译时间减少到300s

![](https://cdn.zcx.info/008i3skNly1gukw38z5bdj60nu05eq3w02.jpg)

#### 可能存在的问题

暂时没有测试ci打包机上的命令修改和真正realse发包过程。如果要上生产环境的话需要进行大面积的覆盖测试。切记谨慎行事。

### 拓展与思考

组件库的编译时间减少较为可观，这也许是大家推行项目组件化的原因。随着业务的发展，项目会越来越大，业务拓展后也可能会划分更多的部门。

每个部门做自己的业务，不关注其他部门的代码。所以如果指定一定的代码规范，制作比如网络请求组件、路由组件等公用组件的基础上，每个业务部门输出自身的业务组件，使用`cocoapods`进行二进制化管理。代码整体的编译上就可以节省不少时间，提升编译效率，团队间合作也会降低一些成本。

未来我们的项目也可以考虑分割各个组件，总体做一个壳工程，采用组件化的方案进行代码维护。但是组件化任重而道远，还得得根据自身的实际情况来选择技术方案。组件化和其他设计模式一样，都是为了解决实际问题，不要为了设计而设计。

当然一些前瞻性的思考还是不能缺少的，未雨绸缪总好过于亡羊补牢！