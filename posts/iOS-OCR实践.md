---
title: iOS-OCR实践
date: 2021.08.31
group: iOS
slug: ios-ocr
summary: 免费 OCR 方案调研:Apple Vision 等方案的识别效果与接入成本对比。
---

## 需求背景

近期老板提出了某些需求可能需要借助OCR能力来进行图片到文本的转换。

以下几种方案是对当前可用的免费的OCR的调研。

## Vision

> Vision 是 Apple 在 WWDC 2017 推出的图像识别框架，它基于 Core ML，所以可以理解成 Apple 的工程师设计了一种算法模型，然后利用 Core ML 训练，最后整合成一个新的框架，相比开源模型然后让开发者自己整合起来，这种方式更安全也更方便我们使用。



### Overview
> The Vision framework performs face and face landmark detection, text detection, barcode recognition, image registration, and general feature tracking. Vision also allows the use of custom Core ML models for tasks like classification or object detection.

从官方文档中可以得到Vision框架能做的事情


|                                |                  |
|:--|---|
| Face Detection and Recognition  | 面部检测          |
| Machine Learning Image Analysis | 机器学习图像分析  |
| Barcode Detection               | 矩阵码/条形码检测 |
| Image Alignment Analysis        | 图像对齐分析      |
| Text Detection                  | 文字检测          |
| Horizon Detection               | 水平面检测        |
| Object Detection and Tracking   | 物体检测和追踪    |

### Demo

对于我们需要的OCR功能，Text Detection就可以满足我们的需求，至于别的功能有兴趣的可以试一下。

Demo中的代码也比较简单就实现了功能

1. 创建一个`VNImageRequestHandler`来持有传入的图片
2. 创建一个`VNRecognizeTextRequest`请求/请求队列
3. 创建一个`VNRequestCompletionHandler`函数指针/block处理识别成功的回调
4. Perform the text-recognition request. 执行请求

```swift
//public typealias VNRequestCompletionHandler = (VNRequest, Error?) -> Void

/// 苹果原生识别 准确率高 速度快
@objc private func ocrAction() {
    guard let path = self.path, let img = UIImage(contentsOfFile: path) else { return }
    guard let cgImage = img.cgImage else { return }
    // 需要注意的写法
    let requestHandler = VNImageRequestHandler(cgImage: cgImage)
    // 参数是一个函数指针/block
    let request = VNRecognizeTextRequest(completionHandler: recognizeTextHandler)
    // 只有ios14以上支持中文识别
    request.recognitionLanguages = ["zh-Hans","zh-Hant","en-US"]
    do {
        // Perform the text-recognition request.
        try requestHandler.perform([request])
    } catch {
        print("Unable to perform the requests: \(error).")
    }
}

/// 识别成功的回调 
func recognizeTextHandler(request: VNRequest, error: Error?) {
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        return
    }
    let recognizedStrings = observations.compactMap { observation in
        // Return the string of the top VNRecognizedText instance.
        return observation.topCandidates(1).first?.string
    }
    // Process the recognized strings.
 	 	var res = ""
    for str in recognizedStrings {
        res  = "\(res)\(str)"
    }
    resultLabel.text = res
}
```

### 优缺点

优点：

1. iOS系统内置的API，无需引入多余文件直接调用。
2. API使用比较简单，不用考虑多线程切换，成功回调已经全部回到了主线程。
3. 实测识别准确度还是比较高的。

缺点：

只有iOS14以上的系统版本支持设置识别中文。

可以使用这个方法来判断这个API所支持识别的语言。`request.recognitionLanguages`属性支持设置ISO标准语言代码。

```swift
/**
     @brief Returns all the supported languages for a given text recognition level. Note that a language supported in one recognition level might not be available in another.
     */
    open class func supportedRecognitionLanguages(for recognitionLevel: VNRequestTextRecognitionLevel, revision requestRevision: Int) throws -> [String]
```

[更多Vision识别文字相关文档可参考：Recognizing Text in Images](https://developer.apple.com/documentation/vision/recognizing_text_in_images)

## Tesseract 

> Tesseract 是一个 OCR 库,目前由 Google 赞助(Google 也是一家以 OCR 和机器学习技术闻名于世的公司)。Tesseract 是目前公认最优秀、最精确的开源 OCR 系统，除了极高的精确度，Tesseract 也具有很高的灵活性。它可以通过训练识别出任何字体，也可以识别出任何 Unicode 字符。Tesseract OCR 该软件包包含一个 OCR 引擎 – libtesseract 和一个命令行程序 – tesseract。 Tesseract 4 增加了一个基于 OCR 引擎的新神经网络（LSTM），该引擎专注于线路识别，但仍然支持 Tesseract 3 的传统 Tesseract OCR 引擎，该引擎通过识别字符模式来工作。通过使用 Legacy OCR Engine 模式（–oem 0）启用与 Tesseract 3 的兼容性。它还需要训练有素的数据文件，这些文件支持传统引擎，例如来自 tessdata 存储库的文件。
>
> [GitHub Address](https://github.com/tesseract-ocr/tesseract)

### Tesseract-OCR-iOS

> Tesseract-OCR-iOS 是由`gali8`使用`Objective-C`封装的基于`Tesseract 3.03-rc1`的iOS版本库。
> [GitHub Address](https://github.com/gali8/Tesseract-OCR-iOS)


### Useage

1. 通过`cocopods`可以直接引入此库。

```ruby
#PodFile
pod 'TesseractOCRiOS'
```

2. 桌面创建一个`tessdata`文件夹

3. 将训练好的中文语言文字数据集`chi_sim.traineddata`放入`tessdata`文件夹

4. 将tessdata文件夹拖到项目根目录，`Added folders` 选择 `Create folder references`创建索引关系

   > 之所以创建索引，是因为Tesseract内部是使用静态路径访问的语言资源文件

5. 使用中文语言创建`G8Tesseract`

6. 设置`G8Tesseract`需要识别的`image`

7. 调用`recognize()`方法，同步方法，会阻塞进程

8. 读取`recognizedText`属性字段

```swift
// google Tesseract识别
@objc private func ocrActionTesseract() {
    guard let path = self.path, let img = UIImage(contentsOfFile: path) else { return }
    let g8Rec = G8Tesseract(language: "chi_sim")
    g8Rec?.image = img
    g8Rec?.engineMode = .tesseractOnly
    g8Rec?.pageSegmentationMode = .autoOnly
    g8Rec?.recognize()
    resultLabel.text = g8Rec?.recognizedText
}
```

集成过程中可能遇到的问题：

1. `actual_tessdata_num_entries_ <= TESSDATA_NUM_ENTRIES:Error: Assert failed: in file ..\..\ccutil\tes...`

   原因：训练数据和sdk版本号不一致
   解决方法：去 [v3.0.2版本训练数据](https://github.com/tesseract-ocr/tessdoc/blob/master/tess3/Data-Files.md#data-files-for-version-302)下载对应版本的训练数据

2. `setenv("TESSDATA_PREFIX", [_absoluteDataPath stringByAppendingString:@"/"].fileSystemRepresentation, 1);` 处崩溃

   原因：未知，可能是代码BUG
   解决方法：不使用作者提供的SwiftDemo中的`OperationQueue`直接使用`G8Tesseract`类

### 优缺点

优点：
1. Tesseract 可以支持自定义训练数据，可以根据自身的需求进行数据训练。可以实现手写字体或其他不规则字体的识别。
2. 识别准确率参照训练结果，在大量业务数据的支持下可能会达到较高的准确率。
3. 无iOS系统版本要求，或基本满足低版本要求

缺点：
1. `Tesseract-OCR-iOS` 库不再维护和更新，代码BUG无人解决，`Tesseract`版本依旧停留在3.0版本，限制使用3.0版本的训练数据集。若不自行训练，低版本训练数据比较难找。自行fork进行二次开发学习成本较高。
2. `Tesseract-OCR-iOS`库自行测试结果对简体中文的识别准确率稍低，可能是因为`Tesseract`版本过低。
3. 引入此三方库的成本过高，基本的简体中文训练数据集大小就为40+MB，引入工程内会显著增加IPA包体积大小，影响APP下载和分发

## OnLine OCR

服务商较多，也有免费试用版，可衡量业务与需求选择。

## 结论

如果OCR不是App的核心功能还是尽量选择`Vision`，`Apple`马上要更新`iOS15`版本，随着时间发展`iOS14`以上的用户数量会越来越多，相信系统版本限制不会永远是APP功能发展的瓶颈。

如果OCR是APP的核心功能或业务相关，建议自行对最新的`Tesseract` 进行c++接口封装或者对`Tesseract-OCR-iOS`库二次开发更新版本并进行维护。

或者选择使用收费在线业务，大部分场景下花钱都能解决技术问题。
