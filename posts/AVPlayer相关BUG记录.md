---
title: AVPlayer相关BUG记录
date: 2021.08.25
group: Notes
slug: avplayer-bugs
summary: AVPlayer 倍速被重置等问题的排查记录:缓冲恢复时手动 play() 带来的副作用。
---

Bug：音频列表顺序播放过程中偶尔出现设置的1.5倍速重置为1

原因：音频流卡顿暂停并缓冲到了足够可以继续播放的buffer长度后响应`playbackLikelyToKeepUp` 事件中 手动调用了 `player.play()` 方法播放音频



```swift
if keyPath == "currentItem.playbackLikelyToKeepUp" {
  if let item = currentItem, item.isPlaybackLikelyToKeepUp, playStatus == .loading, isPlayerActive {
    playStatus = .playing
    player.play()
    // 播放之后需增加设置rate的步骤
    rate = CGFloat(UserDefaultManager.manager.getAudioRateValue()) 
  }
}
```

查看文档可以看到`play`方法等同于 `player.rate = 1`，故而导致音频的速率变成了1

```swift
/*!
 @method		play
 @abstract		Signals the desire to begin playback at the current item's natural rate.
 @discussion	Equivalent to setting the value of rate to 1.0.
 */
- (void)play;
```

总结：api的使用还是需要多看文档不要仅仅看名字就想当然(play = 以当前速率进行继续播放)，简单的api名称并不代表着简单的功能！
