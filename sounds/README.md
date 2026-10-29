# 自定义音效包

默认所有声音都由 `js/sound.js` 用 WebAudio 实时合成。想要更接近真车，可以把**自己录的**声音放进这个文件夹，
然后在 `pack.json` 里登记，例如：

```json
{
  "signalOn": "signal-tick.wav",
  "signalOff": "signal-tock.wav",
  "apOn": "autopilot-on.m4a",
  "horn": "horn.wav"
}
```

刷新页面即可生效。没有登记的音效继续使用合成音。需要用 `python3 serve.py` 打开（直接双击 `index.html` 时浏览器不允许读取本地文件）。

注意：车厂的原厂提示音受版权保护，请只使用你自己录制或有权使用的音频，不要把它们提交到公开仓库。

## 音效名

| 名称 | 触发时机 |
| --- | --- |
| `signalOn` / `signalOff` | 转向灯“嗒”/“哒”（交替播放，也用于双闪） |
| `gear` / `gearP` | 挂入 R / N / D，挂入 P |
| `apOn` / `apOff` / `apUnavailable` | Autopilot 启用 / 退出 / 不可用 |
| `lock` / `unlock` | 锁车 / 解锁 |
| `chime` | 通用提示（充电完成、靠边停车完成等） |
| `nav` / `navArrive` | 开始导航 / 到达目的地 |
| `warn` / `error` | 预警（盲区、碰撞预警）/ 操作不可用 |
| `charge` | 开始充电 |
| `door` / `frunk` | 关门 / 前备箱、后备箱 |
| `open` / `close` | 打开 / 关闭面板 |
| `tap` / `toggle` | 触屏点击 / 开关 |
| `ring` / `hangup` / `keypad` | 来电 / 挂断 / 拨号键 |
| `crash` | 碰撞 |
| `horn` | 喇叭（按住时循环播放，建议录一段 1 秒左右可循环的音） |
| `fart` / `lightshow` | 玩具箱 |
