---
title: iOS字符串安全截取及任意位置插入
date: 2021.04.22
group: iOS
slug: ios-grapheme-clusters
summary: 一个 emoji 引发的光标错位:Unicode、UTF-16 与字素簇的区别。
---

## 一个小问题引起的思考

最近做一个输入框粘贴插入文字的需求时遇到了一个问题：

输入框中输入了文字和表情符😃😃😃（emoji）计算出的光标location和实际感官上的字符个数不一致，最后导致文字插入的位置不对。

这是为什么呢？

查阅资料发现是Unicode编码和UTF-16编码的设计特点导致的此现象。

## 字符和字素簇定义说明

>Characters and Grapheme Clusters

> It's common to think of a string as a sequence of characters, but when working with `NSString` objects, or with Unicode strings in general, in most cases it is better to deal with substrings rather than with individual characters. The reason for this is that what the user perceives as a character in text may in many cases be represented by multiple characters in the string. `NSString` has a large inventory of methods for properly handling Unicode strings, which in general make Unicode compliance easy, but there are a few precautions you should observe.

我们通常将`String`视为`Characters`序列，用户能看到的文本中的`String`可能由字符串中的多个`Characters`表示，所以在处理`NSString`对象或一般的`Unicode`字符串时，处理子字符串大多数情况下比处理单个字符更好。尽管`NSString`有大量正确处理`Unicode`字符串的方法清单，但是仍有一些你需要注意的预防措施。



---

> `NSString` objects are conceptually UTF-16 with platform endianness. That doesn't necessarily imply anything about their internal storage mechanism; what it means is that `NSString` lengths, character indexes, and ranges are expressed in terms of UTF-16 units, and that the term “character” in `NSString` method names refers to 16-bit platform-endian UTF-16 units. This is a common convention for string objects. In most cases, clients don't need to be overly concerned with this; as long as you are dealing with substrings, the precise interpretation of the range indexes is not necessarily significant.

从概念上讲`NSString`是`UTF-16`平台字节序编码,但这并不一定意味着其内部存储机制。这意味着**`NSString`长度，字符索引和范围以`UTF-16`单位表示**，`NSString`方法名称中的`“character”`一词是指16位平台字节序的`UTF-16`单位。这是字符串对象的通用约定。在大多数情况下不必对此太在意，只要您正在处理子字符串，范围索引的精确解释就不一定很重要。(精确索引常用在处理emoji相关，常规一个字符型对应的长度是1，emoji不同的表情对应的是2或3)

---

> The vast majority of Unicode code points used for writing living languages are represented by single UTF-16 units. However, some less common Unicode code points are represented in UTF-16 by surrogate pairs. A surrogate pair is a sequence of two UTF-16 units, taken from specific reserved ranges, that together represent a single Unicode code point. CFString has functions for converting between surrogate pairs and the UTF-32 representation of the corresponding Unicode code point. When dealing with `NSString` objects, one constraint is that substring boundaries usually should not separate the two halves of a surrogate pair. This is generally automatic for ranges returned from most Cocoa methods, but if you are constructing substring ranges yourself you should keep this in mind. However, this is not the only constraint you should consider.

> 名词解释
>
> **surrogate pairs: 代理对**
>
> UTF-16是早期Unicode遗留下的历史产物，原本被设计成具有固定宽度的16位编码格式。为支持超过U+FFFF的增补字符，设立了代理机制
>
> 在BMP内的字符，仍然按照[UTF-16](https://baike.baidu.com/item/UTF-16)的编码规则，使用两个字符来表示。 [1] （注：BMP内的字符编码，不包含从U+D800到U+DFFF的预留码位。这些预留码位就恰好用于扩展字符编码）
>
> 增补字符的编码值已经超过了BMP的编码范围，所以，需要使用一对UTF-16字符来表示一个字符。UTF-16编码以16位无符号整数为单位。我们把Unicode编码记作U。编码规则如下：
>
> - 如果U<0x10000，U的UTF-16编码就是U对应的16位无符号整数。
>
> - 如果U≥0x10000，
>
> - - 我们先计算U’=U-0x10000，
>   - 然后将U’写成二进制形式：yyyy yyyy yyxx xxxx xxxx，
>   - U的UTF-16编码（二进制）就是：110110yyyyyyyyyy 110111xxxxxxxxxx。
>
> 这两个字符就称为surrogate pair（代理对）。第一个代理字符为16位编码，范围为U+D800到U+DFFF，第二个代理字符也是一个16位编码，范围为U+DC00 to U+DFFF。

世界上存在的语言中绝大多数的`Unicode `编码都由单个`UTF-16`单元表示，但是仍然有少部分`Unicode`编码是使用代理对`surrogate pairs`来表示。代理对是从特定保留范围中提取的两个`UTF-16`单元的序列，它们一起代表一个`Unicode`代码点。`CFString`具有在代理对和相应`Unicode`代码点的`UTF-32`表示之间进行转换的功能。处理`NSString`时，子字符串边界不应将代理对的两半分开，**大多数`Cocoa `方法会自动返回正确的`Range`**，但是如果您自己构造子字符串范围，则应牢记这一点。但是，这不是您应该考虑的唯一约束。

---

> In many writing systems, a single character may be composed of a base letter plus an accent or other decoration. The number of possible letters and accents precludes Unicode from representing each combination as a single code point, so in general such combinations are represented by a base character followed by one or more combining marks. For compatibility reasons, Unicode does have single code points for a number of the most common combinations; these are referred to as precomposed forms, and Unicode normalization transformations can be used to convert between precomposed and decomposed representations. However, even if a string is fully precomposed, there are still many combinations that must be represented using a base character and combining marks. For most text processing, substring ranges should be arranged so that their boundaries do not separate a base character from its associated combining marks.

在许多书写系统中，单个字符可以由一个基本字母加上一个重音符号或其他装饰组成。可能的字母和重音的数量使Unicode无法将每个组合表示为单个代码点，因此，通常，此类组合用基本字符表示，后跟一个或多个组合标记。出于兼容性原因，Unicode确实为许多最常见的组合提供了单个代码点。这些被称为预组合形式，并且Unicode规范化转换可用于在预组合和分解表示之间进行转换。但是，即使完全预先组成了字符串，对于大多数文本处理，**也应该使子字符串范围的边界不会将基字符与其相关的组合标记分开**。

---

> In addition, there are writing systems in which characters represent a combination of parts that are more complicated than accent marks. In Korean, for example, a single Hangul syllable can be composed of two or three subparts known as jamo. In the Indic and Indic-influenced writing systems common throughout South and Southeast Asia, single written characters often represent combinations of consonants, vowels, and marks such as viramas, and the Unicode representations of these writing systems often use code points for these individual parts, so that a single character may be composed of multiple code points. For most text processing, substring ranges should also be arranged so that their boundaries do not separate the jamo in a single Hangul syllable, or the components of an Indic consonant cluster.

此外，有些书写系统中，字符代表的是比重音符号更复杂的部分的组合。例如，在韩语中，一个单字音节可以由两个或三个被称为jamo的子音节组成。在遍及南亚和东南亚的印度语和受印度语影响的书写系统中，单个书写字符通常代表辅音、元音和诸如viramas等标记的组合，而这些书写系统的Unicode表示通常使用代码点来表示这些单独的部分，使单个字符可以由多个代码点组成。对于大多数文本处理，还应该使子字符串范围的边界不会将jamo分隔在单个韩文音节中，也不会将印度语辅音集群的组成部分分开。**（相对于重音符号还有更复杂的编码结构，例如韩文和印度文，对于这些更复杂的结构也应该保持代理对不能被拆分）**

---

In general, these combinations—surrogate pairs, base characters plus combining marks, Hangul jamo, and Indic consonant clusters—are referred to as grapheme clusters. In order to take them into account, you can use `NSString`’s `rangeOfComposedCharacterSequencesForRange:` or `rangeOfComposedCharacterSequenceAtIndex:` methods, or `CFStringGetRangeOfComposedCharactersAtIndex`. These can be used to adjust string indexes or substring ranges so that they fall on grapheme cluster boundaries, taking into account all of the constraints mentioned above. These methods should be the default choice for programmatically determining the boundaries of user-perceived characters.:

通常，这些组合（代理对，基本字符加组合标记，Hangul jamo和印度辅音簇）被称为字素簇。为了将它们考虑在内，您可以使用`NSString`的[`rangeOfComposedCharacterSequencesForRange:`](https://developer.apple.com/documentation/foundation/nsstring/1410993-rangeofcomposedcharactersequence)或`rangeOfComposedCharacterSequenceAtIndex:`方法，或`CFStringGetRangeOfComposedCharactersAtIndex`。考虑到上述所有约束，这些可用于调整字符串索引或子字符串范围，使它们落在字素簇边界上。这些方法应该是通过编程确定用户感知字符边界的默认选择。

---

> In some cases, Unicode algorithms deal with multiple characters in ways that go beyond even grapheme cluster boundaries. Unicode casing algorithms may convert a single character into multiple characters when going from lowercase to uppercase; for example, the standard uppercase equivalent of the German character “ß” is the two-letter sequence “SS”. Localized collation algorithms in many languages consider multiple-character sequences as single units; for example, the sequence “ch” is treated as a single letter for sorting purposes in some European languages. In order to deal properly with cases like these, it is important to use standard `NSString` methods for such operations as casing, sorting, and searching, and to use them on the entire string to which they are to apply. Use `NSString` methods such as `lowercaseString`, `uppercaseString`, `capitalizedString`, `compare:` and its variants, `rangeOfString:` and its variants, and `rangeOfCharacterFromSet:` and its variants, or their CFString equivalents. These all take into account the complexities of Unicode string processing, and the searching and sorting methods in particular have many options to control the types of equivalences they are to recognize.

在某些情况下，Unicode算法以甚至超出字素簇边界的方式处理多个字符。从小写变为大写时，Unicode大小写算法可以将单个字符转换为多个字符。例如，德语字符“ß”的标准大写字母等同于两个字母的序列“ SS”。

许多语言中的本地化排序规则算法将多字符序列视为单个单元。例如在某些欧洲语言中，出于排序目的，序列“ ch”被视为单个字母。

在整个字符串上使用标准`NSString`方法进行诸如大小写，排序和搜索之类的操作可以正确处理此类情况。使用`NSString`方法，如`lowercaseString`，`uppercaseString`，`capitalizedString`，`compare:`和其变体，`rangeOfString:`和其变体，和`rangeOfCharacterFromSet:`其变体，或它们的等价CFString字符串方法。

所有这些都考虑到了Unicode字符串处理的复杂性，特别是搜索和排序方法具有许多选项来控制它们要识别的等价类型。

---

>In some less common cases, it may be necessary to tailor the definition of grapheme clusters to a particular need. The issues involved in determining and tailoring grapheme cluster boundaries are covered in detail in [Unicode Standard Annex #29](http://unicode.org/reports/tr29/), which gives a number of examples and some algorithms. The Unicode standard in general is the best source for information about Unicode algorithms and the considerations involved in processing Unicode strings.
>
>If you are interested in grapheme cluster boundaries from the point of view of cursor movement and insertion point positioning, and you are using the Cocoa text system, you should know that on OS X v10.5 and later, `NSLayoutManager` has API support for determining insertion point positions within a line of text as it is laid out. Note that insertion point boundaries are not identical to glyph boundaries; a ligature glyph in some cases, such as an “fi” ligature in Latin script, may require an internal insertion point on a user-perceived character boundary. See *[Cocoa Text Architecture Guide](https://developer.apple.com/library/archive/documentation/TextFonts/Conceptual/CocoaTextArchitecture/Introduction/Introduction.html#//apple_ref/doc/uid/TP40009459)* for more information.

在一些不太常见的情况下，可能有必要根据特定需要定制字素簇的定义。[Unicode标准附件＃29](http://unicode.org/reports/tr29/)中详细介绍了确定和调整字素簇边界的问题，该[附件](http://unicode.org/reports/tr29/)提供了许多示例和一些算法。通常，Unicode标准是有关Unicode算法以及处理Unicode字符串所涉及的注意事项的最佳信息来源。

如果您从光标移动和插入点定位的角度对字形簇边界感兴趣，并且您正在使用Cocoa文本系统，则应该知道在OS X v10.5和更高版本中，`NSLayoutManager`API支持确定插入点布置在一行文本中的位置。请注意，插入点边界与字形边界不同；在某些情况下，连字字形（例如拉丁语脚本中的“ fi”连字）可能需要在用户感知的字符边界上的内部插入点。有关更多信息，请参见《*[Cocoa文本体系结构指南》](https://developer.apple.com/library/archive/documentation/TextFonts/Conceptual/CocoaTextArchitecture/Introduction/Introduction.html#//apple_ref/doc/uid/TP40009459)*。

## 一种安全截取的方法

由上文可知 String 提供系统方法来识别完整的可见字符

```swift
rangeOfComposedCharacterSequencesForRange:
rangeOfComposedCharacterSequenceAtIndex:
这两个方法返回了给定range内包含的完整字符的索引地址
给定初始 range = 0 0（location = 0， length = 0）
“hello” 返回 0 1 截取为 “h”
“😀hello” 返回 0 2 截取为 “😀”
```

**字符串截取或者在光标处插入字符应默认使用这两个方法来获取可视字符边界来避免代理对被拆开导致的显示bug**

```swift
/// 在字符串中光标位置插入子字符串的方法 
/// - Parameters:
///   - baseString: 被插入的字符串
///   - location: 光标位置 selectedRange.location
///   - insertString: 要插入的字符串
/// - Returns: 插入后完整字符串
func insertStringTo(baseString: String, location: Int, insertString: String) -> String {
        var leadingString = ""
        var trailingString = ""
        var range = NSRange(location: 0, length: 0)
        while range.length < baseString.count {
            let r = baseString.rangeOfComposedCharacterSequence(at: baseString.index(baseString.startIndex,
                                                                                     offsetBy: range.length))
            leadingString = String(baseString[..<r.upperBound])
            trailingString = String(baseString[r.upperBound...])  
            if location <= leftString.count {
                return "\(leadingString)\(insertString)\(trailingString)"
            }
            range = NSRange(location: 0, length: leadingString.unicodeScalars.count)
        }
        return ""
    }
```

## 相关链接及资料

[原文链接字符和字素簇](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/Strings/Articles/stringsClusters.html)

[字符串编程指南](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/Strings/introStrings.html#//apple_ref/doc/uid/10000035-SW1)