---
title: Xcode代码块云同步+本地安装脚本
date: 2021.08.25
group: Tools
slug: xcode-snippets-sync
summary: 把常用 Xcode 代码块放进私有仓库,用脚本一键下载合并,多机同步。
---

今天整理了最近半年内使用频率高的一些代码，做了一些代码块 `codesnippet`使用，并在github上创建了一个私有仓库用来云端维护和同步，写了一个脚本进行代码块下载和合并。

创建方式：

1. 选中要创建的代码块，右键选择Create Code Snippte

   ![](https://cdn.zcx.info/008i3skNly1gtt9tybj9gj611y0q8djc02.jpg)
2. 右上角 `+`框快速查看系统和自定义代码块

   ![](https://cdn.zcx.info/008i3skNly1gtt9ty5ejxj61gj0u043502.jpg)
3. 填写代码块描述，以及快捷方式，修改代码块

![](https://cdn.zcx.info/008i3skNly1gtt9txvjapj61c50u00wu02.jpg)

xcode中用户自定义的 代码块保存在~/Library/Developer/Xcode/UserData/CodeSnippets路径下，每个代码块都是一个.codesnippet格式的配置文件。

```ruby
~/Library/Developer/Xcode/UserData/CodeSnippets$: ls -l
total 72
-rw-r--r--  1 zcx  staff  1008 Aug 25 19:36 1BF011CF-9292-4B72-9D44-F7C3BC89AFE0.codesnippet
-rw-r--r--  1 zcx  staff  1036 Aug 25 16:03 28DDA843-AD69-4A09-87C4-3D1DB320EDB5.codesnippet
-rw-r--r--  1 zcx  staff   864 Aug 25 16:37 8BEF45E5-0B98-4CC5-9CB8-86203CA29A69.codesnippet
-rw-r--r--  1 zcx  staff  1699 Aug 25 19:37 B42EC618-1BF8-4E30-AC73-12E1282FEAFC.codesnippet
-rw-r--r--  1 zcx  staff   994 Aug 25 17:48 BA1B105B-F02A-4925-A7FD-B7E6081438E2.codesnippet
-rw-r--r--  1 zcx  staff  1099 Aug 25 15:30 BB31C5F1-D74A-4CD4-968D-F707DADF07C1.codesnippet
-rw-r--r--  1 zcx  staff  1144 Aug 25 17:48 DDA53283-7F1F-49EC-9D76-87D876EA67FC.codesnippet
-rw-r--r--  1 zcx  staff  1557 Aug 25 17:48 E12D24FC-2098-413F-B12E-CBB79181EBDA.codesnippet
-rw-r--r--  1 zcx  staff  1085 Aug 25 17:48 E7CFEE5D-D2F0-42D7-AD6E-258BC0A67D75.codesnippet
```

所以对个人的代码块的维护方式也显而易见变成了对此文件夹内的文件的维护。

---

[创建私有库用来保存创建的代码块](https://github.com/zcx4u/XCode_CodeSnippet)

每次下载过文件之后再手动批量向本地复制粘贴挺麻烦（主要是懒...）所以通过脚本命令进行合并再好不过了！

```ruby
#!/bin/bash
# GitHub: https://github.com/zcx4u/XCode_CodeSnippet
# 将代码块到本地并安装到xcode

SRC_HOME=`pwd`
echo "备份旧代码块~/Library/Developer/Xcode/UserData/CodeSnippets_Backup.zip"
cd ~/Library/Developer/Xcode/UserData
zip -r CodeSnippets_Backup.zip CodeSnippets
echo "合并代码块"
ditto -V ${SRC_HOME}/CodeSnippets ~/Library/Developer/Xcode/UserData/CodeSnippets
echo "done"
```

 记得先备份旧的文件夹以防不测😄

以前也零零碎碎的增加过代码块，但是换工作换电脑后就清空了，客户端业务变化较大重复性的编码还是比较多。

积累一些使用的顺手的工具和方法能有效提升效率，高效完成coding早点homing可以gaming还能shopping，岂不美哉！
