---
title: module importing failed invalid pathname 问题解决
date: 2021.09.09
group: Tools
slug: xcode-module-importing-failed
summary: Xcode 控制台 "module importing failed: invalid pathname" 报错的原因与解法。
---

最近Xcode编译完成后在命令行框里第一行总会报一个错误：
>error: module importing failed: invalid pathname

不论是`clean`还是删除`support文件`还是`重启Xcode`都无法解决这个问题。

于是去google了一番：

[把target的scheme中的debug executable的选项取消掉就不报这个错了](https://stackoverflow.com/questions/59800936/Xcode-11-shows-a-missing-module-error-when-compiling-python-3-8)

![关闭调试器](https://raw.githubusercontent.com/zcx4u/images/master/Hexo/Xcode/008i3skNly1guaiuljmlhj60qi0gmwfh02.jpg)

试了一下，有效！但是这个选项不能去掉啊，去掉了这个选项就不能打断点进行调试了。😂

---

Realm删除残留导致的问题？](https://stackoverflow.com/questions/59090655/removed-realm-but-still-getting-this-error-module-importing-failed-invalid-to/59094519#59094519?newreg=5c6ce4372354468b9449dfc34406e472)

看到朋友们删除Realm之后会出现这个问题，但是我又没有安装过Realm，为何也有这个问题呢。

回答中提到解决这个问题需要去编辑`~/.lldbinit`文件，看的我一脸懵逼，对于这种没见过的配置文件我可不敢去乱删乱改。又想起来被错改配置文件支配的恐惧，吃一堑长一智...

仔细看`lldbinit`文件命名，好像在哪见过，是LLDB调试器初始化的配置文件，于是在mac根目录下去找了找这个文件。
```
这个文件的全部内容
### Reveal LLDB commands support - DO NOT MODIFY
    command script import /Applications/Reveal.app/Contents/SharedSupport/Scripts/RevealServerCommands.py
###
```
当我看到`Reveal.app`这个东西的时候便明白是什么问题了，我这台mac之前下载过破解版的Reveal软件用来调试界面。

`Reveal`的插件需要在LLDB启动的时候加载用来获取UI栈信息，后来改用了`Lookin`就把`Reveal`给卸载了，但是`.lldbinit`中的命令没有改掉。LLDB启动的时候找不到`Reveal插件`便会报`module importing failed: invalid pathname`错误。

![](https://raw.githubusercontent.com/zcx4u/images/master/Hexo/Xcode/008i3skNly1guaium1xjzj60n805q74o02.jpg)

同时这也验证了为什么在Xcode中关闭调试就不报这个错了(那肯定是Xcode在debug模式下运行时自动启动了内置的LLDB调试器啦)。

为了验证是LLDB的问题我把Xcode关闭，打开了终端，输入LLDB命令，然后终端中也报出了相同的错误提示。为了更加理解这个文件的作用，我便又去搜索了一番.lldbinit的作用。

> ~/.lldbinit是每次LLDB启动时会加载的文件。所以一些初始化的事儿，我们可以写入其中中，比如给命令定义别名等。但是由于这时候程序还没有真正运行，也有部分操作无法在里面玩，比如设置断点。

到此我解决了Xcode中每次启动都报错的问题，也明白了这个问题出现的原因，同时也了解到了LLDB相关的新知识。所以当看到一些莫名其妙的报错的时候不要着急也不要焦虑，一定是在你不熟悉的地方出现了异常，当你慢慢理解那些内容的时候，这些报错也许只是一个很小很小的问题。