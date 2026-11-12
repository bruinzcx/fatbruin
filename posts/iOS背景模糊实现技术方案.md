---
title: AI作业背景模糊实现技术方案
date: 2024.11.29
group: iOS
slug: portrait-blur
summary: 录制 AI 作业时的背景虚化:高斯模糊背景 + 人像分割合成,保护用户隐私。
---

## 需求背景

晖致日本提出很多代表在家里录制AI作业，希望可以将背景模糊，保护代表隐私。

类似于腾讯会议的背景虚化功能，录制视频作业 的时候将背景模糊化，只保留用户人像区域。

## 技术方案

业界对这个需求的实现方案基本一致。

首先录制过程中将视频帧做高斯模糊形成背景模糊中”背景"部分。

然后在实时的将每一帧图像中包含人像的部分“扣"出来形成一张黑白分明的灰度图（mask）。一般是人像区域为白色，非人像区域为黑色。

最后使用自定义三输入的滤镜，分别传入模糊后的背景视频帧+灰度mask图+原始视频帧，通过片元着色器对每一个像素点进行遴选。根据灰度图的颜色，白色取原始视频帧，黑色取模糊视频帧。

这样就形成了背景区域是模糊的，人像区域是正常的视频，达到要求。

在视频帧处理这方面我们采用项目中已经引入的GPUImage库来实现。

### 人像分割

这个抠图的技术我们称为人像分割，人像分割算法有很多种，常见的包括：基于颜色和纹理的方法、基于边缘检测的方法、基于深度学习的方法、基于图割的方法等。

目前这一步交由AI组伙伴提供基于TensorFlowLiteObjC的深度学习人像分割模型来实现。

### 自研模型

#### 实现细节

目前chaochao提供了2个模型。

128x128_fp32.tflite 支持输入128*128像素的图片

256x144_fp32.tflite 支持输入256*144像素的图片

核心识别代码如下：

```objectivec
#import <Foundation/Foundation.h>
#import "UGPortraitTFliteProcessor.h"

@interface UGPortraitTFliteProcessor()

@property (nonatomic, assign) cv::Mat cachedMat; // 缓存的一帧

@property (nonatomic, strong) NSDictionary *cachedOutput; //缓存的一帧计算结果

@end

@implementation UGPortraitTFliteProcessor

- (NSArray< NSNumber * > *)getTensorShape {
CGSize modelSize = self.model.modelSize;
NSNumber *dimNum1 = [NSNumber numberWithInt:modelSize.width];
NSNumber *dimNum2 = [NSNumber numberWithInt:modelSize.height];
NSArray< NSNumber * > *shape = @[ @1, dimNum2, dimNum1, @3 ];
return shape;
}

+ (UGPortraitTFliteProcessor *)processor {
// CGSize kTFliteModelSize = CGSizeMake(128, 128);
CGSize kTFliteModelSize = CGSizeMake(256, 144);
NSBundle *targetBundle = [NSBundle bundleForClass:NSClassFromString(@"UGPortraitTFliteProcessor")];
NSURL *bundleUrl = [targetBundle URLForResource:@"Detection" withExtension:@"bundle"];
NSBundle *finalBundle = [NSBundle bundleWithURL:bundleUrl];
// NSString *filePath = [finalBundle pathForResource:@"128x128_fp32" ofType:@"tflite"];
NSString *filePath = [finalBundle pathForResource:@"256x144_fp32" ofType:@"tflite"];
UGTFliteModel *model = [UGTFliteModel modelWithPath:filePath size:kTFliteModelSize];
UGPortraitTFliteProcessor *processor = [UGPortraitTFliteProcessor processorWithModel:model];
return processor;
}

// 执行推理
- (NSDictionary *)detectWithSampleBuffer:(CMSampleBufferRef)sampleBuffer orientation:(UIInterfaceOrientation)orientation isMirror:(BOOL)isMirror {

// 转成mat
cv::Mat matOrigin = [UGTFliteUtil matFromCVPixelBuffer:CMSampleBufferGetImageBuffer(sampleBuffer)];

// 差值优化 如果两帧画面相差小于3% 则直接使用上一帧的结果(这里保持缓存的data和mat是成对的)
if([self isCacheAvailable] && [UGTFliteUtil isChangeMinimalWithCurrentFrame:matOrigin lastFrame:_cachedMat threshold:0.035]) {
return self.cachedOutput;
}

// 计算原始size
CGSize sizeOrigin = orientation == UIInterfaceOrientationLandscapeRight ? CGSizeMake(matOrigin.cols, matOrigin.rows) : CGSizeMake(matOrigin.rows, matOrigin.cols);

// 镜像和orientation翻转
cv::Mat matProcess = [UGTFliteUtil processMatWithOrientation:orientation isMirror:isMirror originMat:matOrigin];

// 缩放到模型接收的size， chaochao说这个模型不用等比缩放，可以拉伸变形进行推理，推理结果再反向拉伸获取即可
cv::Mat mat;
cv::resize(matProcess, mat, cv::Size(self.model.modelSize.width, self.model.modelSize.height));

// 注意模型需求输入的是归一化二进制数据
NSData *imageData = [UGTFliteUtil normalizedFloat32ImageDataFromCVMat:mat]; // 归一化处理

// 模型开始执行推理
NSError *error;
[self.interpreter resizeInputTensorAtIndex:0 toShape:[self getTensorShape] error:&error];
TFLTensor *inputTensor = [self.interpreter inputTensorAtIndex:0 error:&error];
[inputTensor copyData:imageData error:&error];
[self.interpreter invokeWithError:&error];
TFLTensor *outputTensor = [self.interpreter outputTensorAtIndex:0 error:&error];
NSData *outputData = [outputTensor dataWithError:&error];

// 后续解析数据
NSDictionary *resultDict = [self detectWithTensorOutputData:outputData imageSize:sizeOrigin];

if (error) {
NSLog(@"Error++: %@", error);
} else {
self.cachedOutput = resultDict;
self.cachedMat = matOrigin;
}

return resultDict;
}

/// 解析推理数据
- (NSDictionary *)detectWithTensorOutputData:(NSData *)outputData imageSize:(CGSize)imageSize {

// 计算像素总数
int inputWidth = self.model.modelSize.width;

int inputHeight = self.model.modelSize.height;

int num_pixels = inputHeight * inputWidth;

// 注意OpenCV 里面Mat的初始化是 高 * 宽 * 通道数
cv::Mat out_mask(inputHeight, inputWidth, CV_8UC1);

const float *output = (const float *)outputData.bytes;

// 遍历每个像素并填充 out_mask 这个计算有问题的 实际是会有不同概率分布的数据 不是非0即1
for (int i = 0; i < num_pixels; i++) {
out_mask.data[i] = (output[2 * i + 1] > 0.1f) ? 255 : 0;
}

// 腐蚀 这个优化改为交给GPUImage处理 不再使用cv
// cv::Mat element = cv::getStructuringElement(cv::MORPH_RECT, cv::Size(3, 3));
// cv::erode(outputMat, outputMat, element);

// 高斯模糊 进行边缘优化 这个优化改为交给GPUImage处理 不再使用cv
// cv::GaussianBlur(out_mask, out_mask, cv::Size(3, 3), 0, 0);

// mask图再放大
cv::Mat outputMat;
cv::resize(out_mask, outputMat, cv::Size(imageSize.width, imageSize.height));

UIImage *outputImage = [UGTFliteUtil imageFromCVMat:outputMat];

return @{@"image":outputImage, @"imageWidth":@(imageSize.width),@"imageHeight":@(imageSize.height)};
}

- (BOOL)isCacheAvailable {
return !self.cachedMat.empty() && self.cachedOutput;
}

@end
```

核心渲染代码如下

```objectivec

// 背景模糊滤镜组

#import "GPUImage.h"
#import "GPUImageThreeInputFilter.h"
#import "UGImageBackgroundBlurFilter.h"

NSString *const kUGImagePortraitMaskBlendFragmentShaderString = SHADER_STRING
(
precision highp float;

varying highp vec2 textureCoordinate;
varying highp vec2 textureCoordinate2;
varying highp vec2 textureCoordinate3;

uniform sampler2D inputImageTexture;
uniform sampler2D inputImageTexture2;
uniform sampler2D inputImageTexture3;

void main() {
vec4 baseColor = texture2D(inputImageTexture, textureCoordinate);
vec4 blurredColor = texture2D(inputImageTexture2, textureCoordinate2);
vec4 maskColor = texture2D(inputImageTexture3, textureCoordinate3);

// 预乘Alpha
baseColor.rgb *= baseColor.a;
blurredColor.rgb *= blurredColor.a;

// 根据 maskColor 的灰度值计算混合的透明度通道
float maskValue = dot(maskColor.rgb, vec3(0.299, 0.587, 0.114));

// 平滑处理边界像素值
float smoothMaskValue = smoothstep(0.0, 1.0, maskValue);

// 混合颜色
vec4 mixedColor = mix(blurredColor, baseColor, smoothMaskValue);

// 解除预乘Alpha
if (mixedColor.a > 0.0) {
mixedColor.rgb /= mixedColor.a;
}

gl_FragColor = mixedColor;

}
);

@interface UGImagePortraitMaskBlendFilter : GPUImageThreeInputFilter

@end

@implementation UGImagePortraitMaskBlendFilter

- (instancetype)init {
self = [super initWithFragmentShaderFromString:kUGImagePortraitMaskBlendFragmentShaderString];
if (self) {
// 初始化滤镜
}
return self;
}

@end

@interface UGImageBackgroundBlurFilter()
@property (nonatomic, strong) GPUImageGaussianBlurFilter *blurFilter;
@property (nonatomic, strong) UGImagePortraitMaskBlendFilter *blendInputFilter;
@end

@implementation UGImageBackgroundBlurFilter

- (instancetype)init {
if (self = [super init]) {
// 初始化高斯模糊滤镜
self.blurFilter = [[GPUImageGaussianBlurFilter alloc] init];
self.blurFilter.blurRadiusInPixels = 31;
[self addFilter:self.blurFilter];

// 初始化混合三输入滤镜
self.blendInputFilter = [[UGImagePortraitMaskBlendFilter alloc] init];
[self addFilter:self.blendInputFilter];

// 设置滤镜链
[self.blurFilter addTarget:self.blendInputFilter atTextureLocation:1];
[self setInitialFilters:@[self.blurFilter, self.blendInputFilter]];
[self setTerminalFilter:self.blendInputFilter];
}
return self;
}

- (void)setMaskImage:(UIImage *)maskImage {
// 腐蚀 + 高斯模糊进行边缘优化
GPUImagePicture *maskImageSource = [[GPUImagePicture alloc] initWithImage:maskImage];
GPUImageErosionFilter *erosionFilter = [[GPUImageErosionFilter alloc] initWithRadius:3];
GPUImageGaussianBlurFilter *blurFilter = [[GPUImageGaussianBlurFilter alloc] init];
blurFilter.blurRadiusInPixels = 7;

[maskImageSource addTarget:erosionFilter];
[erosionFilter addTarget:blurFilter];
[blurFilter addTarget:self.blendInputFilter atTextureLocation:2];

[erosionFilter useNextFrameForImageCapture];
[blurFilter useNextFrameForImageCapture];
[maskImageSource processImage];
}

@end

```

#### 端侧优化

在实现的过程中发现一些问题，从APP侧做了一些优化。

##### 边缘优化

模型计算出来的mask图像的黑白分界比较明显（像素点非1即0），视觉效果上在背景和人像的分界处有较清晰的边界落差。

针对这个问题我们在使用推理出来的mask进入片元着色器遴选像素之前先过了一次7个像素的高斯模糊滤镜，将mask图的边缘的锋利区域抹平。

边缘高斯模糊后分界不再过于明显，人像周围会存在一圈透明和半透明交织的光圈。

光圈的半径大小取决于模型推理出来的mask图的尺寸，掩码图越大越精细，光圈越小越贴近真实的人像。（和小图片放大会变马赛克同样原理）

##### 边缘腐蚀

经过边缘优化人像区域分界点弱化后发现人像周围的透明光圈会漏出一些背景信息。

为了降低漏出的背景信息，我们在高斯模糊之前对掩码图做了一次3像素的腐蚀，将人像区域向内收缩。

##### 插值优化

结合我们的AI作业的录制场景，APP端对两帧之间变化不超过96.5%的不再执行推理，可以一定程度上提高录制的帧率。

该阈值经过一些测试得出，其效果为别的部位和背景不变，仅面部口型发生变化，其两帧之间的差距小于3.5%。

##### 帧缓存

推理模型存在报错的可能，每一帧推理成功完成后都会缓存该推理结果。

如果当前帧推理报错则会使用上一帧的结果，避免出现模糊失效暴露完整背景信息的情况。

#### 遗留问题

**向内腐蚀导致人像边缘缺失**

手指区域有时候会出现识别误差导致手指区域比较细小，因为向内腐蚀而出现手指被腐蚀掉的问题。

**帧率低**

端上录制的同时做了过多滤镜方面的工作，同时处理背景模糊和人脸美颜，性能较低。

不开背景模糊能跑满30pfs，开了背景模糊会降低到10-15fps。

**模型识别精度不足**

识别精度难以达到产品预期。当前模型尺寸较小，如果换高精度模型会进一步降低帧率，视频会卡。

### Vision 模型

Vision 是 Apple 在 WWDC 2017 推出的图像识别框架。Vision库里本身就已经自带了很多训练好的Core ML模型，人脸识别、条形码检测等等功能。

如果你要实现的功能刚好是Vision库本身就能实现的，那么你直接使用Vision库自带的一些类和方法就行，但是如果想要更强大的功能，那么还是需要结合其它Core ML模型。

Apple 官方也提供了人像分割的模型VNGeneratePersonSegmentationRequest，需要iOS 15.0 以上系统可以使用该API。

#### 核心实现

```objectivec

if (@available(iOS 15.0, *)) {
CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
if (!pixelBuffer) {
return;
}

VNGeneratePersonSegmentationRequest *request = [[VNGeneratePersonSegmentationRequest alloc] init];
// 决定使用高质量的mask还是高速度的mask
request.qualityLevel = VNGeneratePersonSegmentationRequestQualityLevelAccurate;
request.outputPixelFormat = kCVPixelFormatType_OneComponent8;
// 推理产生mask
VNImageRequestHandler *requestHandler = [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer options:@{}];
NSError *error = nil;
[requestHandler performRequests:@[request] error:&error];
if (error) {
NSLog(@"Failed to perform segmentation request: %@", error);
return;
}

VNPixelBufferObservation *mask = (VNPixelBufferObservation *)request.results.firstObject;
if (mask) {
CIImage *ciImage = [CIImage imageWithCVPixelBuffer:mask.pixelBuffer];
CIContext *context = [CIContext context];
CGImageRef cgImage = [context createCGImage:ciImage fromRect:ciImage.extent];
UIImage *image = [UIImage imageWithCGImage:cgImage];
CGImageRelease(cgImage);

if(self.getDevicePostion == AVCaptureDevicePositionFront) {
image = [self flipImageVertically:image];
}
// 执行渲染
[self.filter setBlurBackgroundMaskImage:image];
}
} else {
NSLog(@"VNGeneratePersonSegmentationRequest is not available on this iOS version.");
}


```

我们项目支持到iOS 10.0 所以使用原生模型是有局限性的。

另外如果使用高精度模型VNGeneratePersonSegmentationRequestQualityLevelAccurate，其运行速度也比较慢。

如果使用精度和速度相平衡的模型则其识别效果未经过产品验证无法确定是否达到需求。

## 优化方向

### AI

AI考虑提升模型运算效率和推理精度，由AI团队调研和研发。

### APP

根据模型推理精度来决定是否移除掉腐蚀逻辑，保证人像区域完整。

检测多个滤镜链合并时候的效率，根据结果决定是否需要分离美颜和背景模糊滤镜。

使用帧采样做mask基准，尽量减少模型推理次数。

采样多个模型，根据帧率动态降级。

### 采用iOS Vision 推理框架 工程化优化

采用 VNGeneratePersonSegmentationRequestQualityLevelBalanced 档位的人像分割模型，效果可以接受。

测试机 iOS 15.2 iPhone 11

2024-11-29 15:53:32.273863+0800 [5274:3232793] 开始推理 1732866812.273805

2024-11-29 15:53:32.300939+0800 [5274:3232793] 推理完成 1732866812.300908

2024-11-29 15:53:32.309572+0800 [5274:3232793] 转图片完成 1732866812.309538

人像分割推理用时 27.1 ms  转图片用时 8.5 ms

当前FPS 为 15 每一帧视频用时 66.67ms

人像分割大概需要在原始耗时的基础上增加35 ms

不开人像分割可以达到设置的最佳帧率 30 FPS。

排查其他用时详情：

2024-11-29 16:54:07.306245+0800 [5358:3254717] 开始应用滤镜 1732870447.306170

2024-11-29 16:54:07.310206+0800 [5358:3254717] 应用滤镜完成 1732870447.310165

合成图像及边缘优化的滤镜用时 4ms 优化空间较小

主要优化方向还是在人像分割推理上

采用差值优化，帧相似度小于某个值才进行检测

差值计算带来额外的性能消耗，如果计算出来需要检测，则检测用时需要追加差值计算的时间消耗，如果计算出来不需要检测，就节省了一次推理时间。

如果差值计算消耗数量级远远小于人像分割推理 则效果比较明显。

2024-11-29 18:01:49.232560+0800 [5457:3292643] 开始计算差值 1732874509.232429

2024-11-29 18:01:49.237739+0800 [5457:3292643] 完成计算差值 1732874509.237706

计算差值需要 5ms

在差值2.5%的基准上，如果人像动作幅度较小则帧率提升到20-25左右。

插值基准越大，则帧率提升越明显，但是对人像分割的效果会有负面影响（**有残影**）。

## 参考资料

[OpenGL ES几个概念-顶点着色器、片元着色器、EG](https://blog.csdn.net/Jason_Lee155/article/details/121216691)

[OpenGL学习教程](https://learnopengl-cn.github.io/)

[人像分割技术有哪些？](https://www.nxrte.com/jishu/38561.html)

[Vision 图像识别框架](https://cloud.tencent.com/developer/article/1077019)
