---
title: iOS 如何做一个九宫格GIF播放器
date: 2021.12.06
group: iOS
slug: feed-gif-carousel
summary: 九宫格 GIF 轮播播放器:多图循环播放与信息流内优先级调度的实现。
---

## 需求背景

APP V9.4.0版本上线了类似朋友圈的动态，包含文字及最多9张图片。

动态2期内容中九宫格图片内追加了GIF格式的图片，并要求多张GIF图片在九宫格内循环播放，且优先播放信息流内第一个动态中包含的GIF图片。可参考微博信息流内GIF组的播放表现。

## 技术实现

### GIF播放

GIF图是包含若干帧图片的图片组，由于阿里云存储或者其他存储容器中的文件特征，许多图片路径并不带.gif或.GIF的后缀，所以不能仅通过比对文件名来识别GIF图。而通过**二进制数据**中来标记其文件类型的固定的**位特征**来区分较为准确。

目前我们项目中集成了优秀的开源网络图片框架 `'Kingfisher'`，其中包含的 `AnimatedImageView`类能有效识别GIF文件类型和实现精细的播放控制，且使用方便，仅需要给图片view设置网络图片的URL。

### 图片对齐方式

需求中同时需要支持图片设置顶部对齐裁剪和左部对齐裁剪，1期项目中 `KrShortContentImageView`类已使用 `UIImageViewAlignmentMask`来实现此需求。

`UIImageViewAlignmentMask`的实现原理为要显示的图片View的外层嵌套一个"相框"容器View，图片View根据原图的比例来进行等比例缩放，再根据对齐方式使用“相框”来裁剪，从而做到顶部对齐或者左部对齐的视觉效果。

GIF图片同时满足此对齐方式的需求，所以只要把内部的图片View替换为支持GIF播放的 `AnimatedImageView`即可。

### 播放控制

#### 顺序播放与循环播放

`AnimatedImageView`默认自动播放GIF，与我们的需求不符合，所以这里需要关闭其自动播放功能改为手动控制播放列表的顺序播放和整体循环播放。

```swift
private lazy var realImageView = AnimatedImageView().then { img in
    img.autoPlayAnimatedImage = false
    img.contentMode = .scaleAspectFill
}
```

顺其自然的我们创建一个 `KrShortContentImageView`数组作为播放列表，数组中保存的每一个view都可以视为一个播放器来使用。

每次获取可以播放的view数组后我们从第一个view开始播放，在第一个view的GIF播放完毕后通过代理回到列表中调用下一个view的播放，且当播放的是最后一个view的时候回到数组头进行循环即可。

这里我们实现 `AnimatedImageView`的代理 `AnimatedImageViewDelegate`方法来监控每一个GIF的播放结束。

```swift
func animatedImageView(_ imageView: AnimatedImageView, didPlayAnimationLoops count: UInt) {
  ///每一个AnimatedImageView播放完毕后会调用这里的代理方法来播放下一个
}
```

同样顺其自然的我们创建了一个来集中处理播放逻辑和向外提供服务方法的单例类和传递GIF播放和加载事件的代理协议。

```swift
/// 三个方法分别处理图片加载成功、图片加载失败、GIF播放完毕
protocol KrShortContentImageViewDelegate: AnyObject {
    func krShortContentImageViewLoadImageDidSuccess(imageView: KrShortContentImageView)
    func krShortContentImageViewLoadImageFailure(imageView: KrShortContentImageView)
    func krShortContentImageViewDidFinishAnimation(imageView: KrShortContentImageView, gifView: AnimatedImageView)
}

/// 动态列表播放器管理类
class ShortContentGifListPlayer {
    static let `default` = ShortContentGifListPlayer()
    private init() {}
}
```

#### 网络加载数据控制

鉴于网络状态的波动，不能保证每一个GIF的加载都能很快完成，我们在 `KrShortContentImageView`类中增加了 `UIActivityIndicatorView`转动小菊花来表示此GIF图片正在加载中。

同时我们需要一个状态变量标识GIF资源的加载状态，以及简单的变化逻辑。

```swift
/// 图片加载状态机
var imageLoadState: LoadingState = .initial 

/// 图片加载过程
private func setRealImage(withUrl url: URL?) {
  self.imageLoadState = .loading
  realImageView.kf.setImage(with: url, placeholder: UIImage(color: KrColor.Fill.placeHolder), options: [], progressBlock: nil) { [weak self] (result) in
      guard let `self` = self else { return }
      switch result {
      case .success(_):
          self.imageLoadState = .success
          // 通知代理GIF加载成功可以播放GIF
          self.loadingImageDelegate?.krShortContentImageViewLoadImageDidSuccess(imageView: self)
          self.updateRealImageLayout()
      case .failure(_):
          self.imageLoadState = .fail(msg: "图片加载失败", image: "")
          // 通知代理GIF加载失败可以播放下一个GIF
          self.loadingImageDelegate?.krShortContentImageViewLoadImageFailure(imageView: self)
      }
  }
}
```

#### 弱网或者超时处理

弱网和超时暂时没有做自定义的超时时间，使用了kf框架内部的超时时间。在播放GIF时如果发现当前的图片正在加载中就把loadingView展示出来等待其加载，当kf.setImage方法回调失败时通过代理告诉管理器去播放下一个。

```swift
switch gifContent.imageLoadState {
  case .success:
      gifContent.hideLoading()// 收起loading层
      gifContent.startAnimating()// 开始播放GIF
  case .loading:
      gifContent.showLoading()// 展示loading层
  case .fail(let err, _):
      playNextGif()// 播放下一个
      SwiftyBeaver.error("播放GIF出错,\(err)", context: nil)
  default:
      playNextGif()
      SwiftyBeaver.error("播放GIF出错,GIF未初始化成功", context: nil)
}
```

### 滚动结束后获取播放列表

推荐信息流、关注信息流、动态流中均包含动态图片九宫格。滚动停止后如何取出可以播放的 `KrShortContentImageView`列表成为了关键问题。

为了达到较好的播放效果这里我们定义一个概念：

> 如果GIF图在屏幕上渲染出并显示了超出一半的范围，则视为此图是可以播放的。

介于每个GIF图拥有自身的显示标准（宽高），这里需要计算自身高度的50%来和信息流显示区域进行对比。需要我们把每个GIF图的 `Frame`计算出来，然后逐层转换坐标系到信息流的主显示层进行可展示区域的**交集计算**，如果和可展示区域相交则判断此GIF图是可以播放的。

以推荐信息流为例：

```swift
/// 播放Gif列表
private func playShortContentGifList() {
    var indexPaths: [IndexPath] = []
    let cells = tableView.visibleCells
    for index in 0 ..< cells.count {
        if let indexPath = tableView.indexPath(for: cells[index]) {
            indexPaths.append(indexPath)
        }
    }
    var needsPlayGifList: [KrShortContentImageView] = []
    /// 这里逻辑是可优化的 之所以先遍历cell取indexPath是为了保证indexPath是从小到大排列的，本来这里还有一个indexPath数组的排序
    /// 重构过程中认识到visibleCells取出时就是有序的，只是把排序方法删掉了，当时没有改canDisplayGifViews的参数，后来忘记了...
    /// 遍历第一个包含可播放的GIF列表的Cell进行播放
    for index in 0 ..< indexPaths.count  {
        let imageList = canDisplayGifViews(indexPath: indexPaths[index])
        if !imageList.isEmpty {
            needsPlayGifList.append(contentsOf: imageList)
            break
        }
    }
    ShortContentGifListPlayer.default.setNeedsPlayGifList(gifList: needsPlayGifList)
}

// 图片动态内部满足可播的gif列表
private func canDisplayGifViews(indexPath: IndexPath) -> [KrShortContentImageView] {
    guard let cell = self.tableView.cellForRow(at: indexPath), let provider = cell as? ShortContentGifListProvider else { return [] }
    /// 获取GIF列表
    let list = provider.provideGifViewList()
    let rectInTableView = tableView.rectForRow(at: indexPath)
    var showList: [KrShortContentImageView] = []
    for index in 0 ..< list.count {
        let imageFrame = list[index].frame
        guard let superView = list[index].superview else { continue }//注意cell内层结构
        /// 坐标系转换
        let imageFrameInCell = superView.convert(imageFrame, to: cell)
        let imageFrameInTable = CGRect(x: rectInTableView.origin.x + imageFrameInCell.origin.x,
                                       y: rectInTableView.origin.y + imageFrameInCell.origin.y,
                                       width: imageFrame.size.width, height: imageFrame.size.height)
        let reactInMainView = tableView.convert(imageFrameInTable, to: self.view)
        /// 计算可播区域
        let safeShownGifArea = CGRect(x: 0, y: ceil(imageFrame.size.height / 2), 
                                      width: view.bounds.size.width, 
                                      height: view.bounds.height - imageFrame.size.height))
        /// 交集计算
        if safeShownGifArea.intersects(reactInMainView) {
            showList.append(list[index])
        }
    }
    return showList
}
```

### 信息流刷新处理

开发过程中发现信息流经常会有reload的操作，导致动态九宫格刷新数据，同时刷新了GIF的View，此时TableView会从复用池中获取一个新的动态模板使用，也就是说此时显示的GIF虽然图片内容和刷新之前一样但是其实质已经是一个新的GIF了（指针值已经变化）。此时正在播放GIF的View从九宫格上移除，GIF的播放被中断。

如果刷新后再手动调一次播放方法，计算逻辑会重新计算需要播放的GIF，如果滚动位置没有变化会计算出和刷新之前相同的GIF图播放列表（GIF文件URL相同），然后从第一个开始播放。

这样的话存在两个问题：

1：GIF列表播放进度被重置。当前正在播放第三个GIF>触发刷新>重新计算>从头开始播放。

2：GIF播放帧进度被重置。当前正在播放第一个GIF（共60帧）且播放到第30帧图片>触发刷新>重新计算>从头开始播放>开始播放第一个GIF的第一帧。

当然，第一个问题我们尝试通过记录当前正在播放的GIF的URL来判断播放的位置的方法来解决，但是由于替换了承载GIF的View，播放帧被重置的问题是无法解决的。这样当弹起输入框、点赞等操作刷新动态Cell时无法做到无痕刷新，用户正在观看的GIF被中断，体验较差。

所以如果想解决问题2应**避免让GIF直接在信息流中播放**。

这里我们在 `ShortContentGifListPlayer`播放管理器中持有一个专门用来播放GIF的图片类 `gifContent`。然后将变化较大且较难控制的动态九宫格中的图片列表作为展示真正播放GIF的容器 `containerList`来管理，在信息流刷新时仅仅替换GIF容器，而不影响正在播放的GIF图片。

```swift
/// 真正播放的gif
private var gifContent = KrShortContentImageView()
/// 当前的gif载体superview
private var currentContainer: KrShortContentImageView?
/// 载体列表
private var containerList: [KrShortContentImageView] = []
```

每次触发信息流刷新时均重新计算GIF播放容器列表，对比正在播放的GIF的URL和容器的URL，把正在播放的GIF放到对应的容器中，做到视觉内无痕替换。

每次GIF播放完毕之后寻找下一个容器，从容器中获取GIF的图片URL进行加载。

如果播放完毕后找不到新的容器则界定为播放逻辑停止，整个播放器变为非活跃状态。

![示意图](https://cdn.zcx.info/202302221018159.jpg)

---

解决上述问题2后，问题1的解决方案也获得了优化。

鉴于我们动态流九宫格图片组经常会从推荐频道进入动态流然后从动态流再进入动态详情页，这三处位置的GIF都需要播放，每次进入后新页面都需要重新计算播放列表，而这种翻页的操作又携带相同（按照图片URL计算）的GIF组。

这样的场景就需要我们把不同位置的相同GIF列表记忆播放进度，即接力播放。

所以我们定义一个接力播放的规则：

> 新GIF列表包含正在播放的GIF且新列表是当前播放的GIF列表的子集视为可以接力播放

例如当前正在播放 `[A,B,C,D,E,F,G]`列表且正在播放 `GIF_C`，这个时候某个操作计算出了新的播放列表 `[A,B,C,D,E]`。我们发现新的播放列表是旧的播放列表的**子集**，且新列表**包含**了正在播放的 `GIF_C`，这个时候我们需要把正在播放的 `GIF_C`移动到新列表的 `容器C`上且设置播放进度为C，而不是重新加载A的URL进行GIF播放。

这样操作减少了GIF图重新播放的次数，降低了图片数据IO次数和GPU重新渲染的次数，将翻页的GIF图平滑过渡到新的播放列表。

## 功能拓展

综上所述，如果将GIF变为视频或者实况照片或者其他任何可以控制开始和结束的功能模块，均可套用此逻辑进行交互。

## 总结与优化

### 信息流图片缩略

由于GIF列表使用了固定的专门用来播放的承载器 `gifContent`,信息流中不再承担播放GIF图的责任，所以信息流中可以完全舍弃加载GIF，而改用加载GIF图的缩略图。缩略图的内存占用更小，加载速度更快，更加适合多图片信息流的展示。

当点击图片需要加载大图或者滚动停止需要播放GIF的时候再去加载真正的原图以获得较好的显示效果。这样图片原图以懒加载（用时加载）的方式来渲染能够提升信息流中大量图片的加载速度，降低内存消耗。

移动设备可视区域比较小，九宫格中显示的图片尺寸更小，所以使用缩略图（合适的压缩率）代替原图在视觉效果上不会产生特别大的损失。

### 代码逻辑收敛

当前的代码实现比较散乱，特别是每个GIF转换坐标系时的计算以及和信息流可播区域进行的交集计算。坐标系转换逻辑的复杂度随着GIFView的层级复杂度的提示而显著提升。探索是否存在一种方法判断任意两个VIew是否存在交集（支持设置忽略EdgeInset），以通用的计算方法来代替包含业务View的计算，从而大量降低耦合度，同时减少了复杂度。

将必要的逻辑抽象为协议，以方便此功能移植到其他频道或者列表。

随着迭代增加功能，信息流Controller中的事件越来越多，提供内容（比如这次的GIF）的Cell可以考虑自身来计算可执行条件，实现或者调用功能，或者使用VM来降低Controller的臃肿。Controller中仅控制Tableview的代理事件监听然后调用符合条件的Cell内部的功能实现。这样每次有新的功能时仅仅增加新的Cell注册和新协议的调用，避开大量修改臃肿的Controller代码以降低出错的概率。

## 优化

### 坐标系转换简化

带着疑问研究了一下坐标系转换的方法，发现他是 `UICoordinateSpace`协议，只包含几个和坐标转换相关的方法。

```swift
public protocol UICoordinateSpace : NSObjectProtocol {

    @available(iOS 8.0, *)
    func convert(_ point: CGPoint, to coordinateSpace: UICoordinateSpace) -> CGPoint

    @available(iOS 8.0, *)
    func convert(_ point: CGPoint, from coordinateSpace: UICoordinateSpace) -> CGPoint

    @available(iOS 8.0, *)
    func convert(_ rect: CGRect, to coordinateSpace: UICoordinateSpace) -> CGRect

    @available(iOS 8.0, *)
    func convert(_ rect: CGRect, from coordinateSpace: UICoordinateSpace) -> CGRect

    @available(iOS 8.0, *)
    var bounds: CGRect { get }
}
```

而 `UIView`是实现这个协议的，所以，在父view的层级内肯定是可以将深层嵌套的子view转换到自身坐标系下的。这样一来我们就不必关心view到底是什么，无论是tableView还是collectionView，可以跨层级将cell上加载的图片的frame计算到上层的。

所以我们可以将这个方案合并为一个通用的扩展，用一个方法就可以把GIF位置是否满足播放条件给计算出来。

```swift
extension UIView {
    /// 递归查询是否是自己的subview/多级subview
    /// - Parameter subview: 子view或者深层子view
    /// - Returns: Bool
    func isMySubview(subview: UIView) -> Bool {
        guard subview != self, let subviewSuper = subview.superview else { return false }
        if subviewSuper == self {
            return true
        } else {
            return isMySubview(subview: subviewSuper)
        }
    }

    /// 判断任意一子view或者嵌套深层子view是否显示在了父视图特定的可见区域内
    /// - Parameter subview: 子view或者深层子view
    /// - Returns: Bool
    func isSubviewIntersectInAimRect(subview: UIView, inset: UIEdgeInsets) -> Bool {
        guard let subviewSuper = subview.superview, isMySubview(subview: subview) else { return false }
        let subviewFrameInSuper = convert(subview.frame, from: subviewSuper)
        if subviewFrameInSuper == .zero || subviewFrameInSuper.isNull { return false }
        let safeShownArea = bounds.inset(by: inset)
        return safeShownArea.intersects(subviewFrameInSuper)
    }
}

```

使用了这个方法后，我们可以对比一下

旧计算过程：

```swift
// 图片动态内部满足可播的gif列表
private func canDisplayGifViews(indexPath: IndexPath) -> [KrShortContentImageView] {
    guard let cell = self.tableView.cellForRow(at: indexPath), let provider = cell as? ShortContentGifListProvider else { return [] }
    /// 获取GIF列表
    let list = provider.provideGifViewList()
    let rectInTableView = tableView.rectForRow(at: indexPath)
    var showList: [KrShortContentImageView] = []
    for index in 0 ..< list.count {
        let imageFrame = list[index].frame
        guard let superView = list[index].superview else { continue }//注意cell内层结构
        /// 坐标系转换
        let imageFrameInCell = superView.convert(imageFrame, to: cell)
        let imageFrameInTable = CGRect(x: rectInTableView.origin.x + imageFrameInCell.origin.x, y: rectInTableView.origin.y + imageFrameInCell.origin.y,  width: imageFrame.size.width, height: imageFrame.size.height)
        let reactInMainView = tableView.convert(imageFrameInTable, to: self.view)
        /// 计算可播区域
        let safeShownGifArea = CGRect(x: 0, y: ceil(imageFrame.size.height / 2), width: view.bounds.size.width, height: view.bounds.height - imageFrame.size.height)
        /// 交集计算
        if safeShownGifArea.intersects(reactInMainView) {
            showList.append(list[index])
        }
    }
    return showList
}
```

新计算过程：

```swift
// 每一个图片动态内部满足可播的gif列表
private func canDisplayGifViews(indexPath: IndexPath) -> [KrShortContentImageView] {
  guard let cell = self.tableView.cellForRow(at: indexPath),
  let provider = cell as? ShortContentGifListProvider else { return [] }
  let showList: [KrShortContentImageView] = provider.provideGifViewList().filter { [weak self] in
      guard let `self` = self else { return false }
      // tabbar是覆盖在流上方的，所以可播区域限制增加tabbar的高度
      let shownInset = UIEdgeInsets(top: $0.frame.height / 2, left: 0, bottom: $0.frame.height / 2 + BasicConst.Layout.tabBarHeight, right: 0)
      // 交集计算
      return self.tableView.isSubviewIntersectInAimRect(subview: $0, inset: shownInset)
  }
  return showList
}
```

成功将复杂的逐层转换布局变成了一个方法实现，代码变得十分简洁，看起来很爽。
