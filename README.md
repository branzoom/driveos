# DriveOS 车机界面模拟器 / DriveOS In-Car UI Simulator

[中文](#中文) · [English](#english)

> **非官方粉丝作品 / Unofficial fan project, not affiliated with Tesla, Inc.**
> Tesla 及相关商标、车型名称归 Tesla, Inc. 所有。本项目仅为个人学习与交流用的界面模拟，不连接真实车辆，也未获得 Tesla 的授权或认可。
> Tesla and related marks belong to Tesla, Inc. This is a UI simulation for learning and fun only; it does not connect to any real vehicle and is neither authorised nor endorsed by Tesla.

---

## 中文

### 这是什么

一个纯静态 HTML / JavaScript 的可交互 Tesla 风格车机界面模拟器（并附带 Apple CarPlay 风格皮肤）：3D 车辆、驾驶模拟、真实地图导航、空调、媒体、倒车影像、玩具箱等。没有构建步骤，没有后端依赖，浏览器打开即用。

### 功能

- 3D 车辆（Three.js）：Model 3 与 Cybertruck 真实车模，其他车身为程序化生成；车漆 / 车衣质感与颜色、尾灯样式、车门 / 前后备箱 / 充电口动画
- 驾驶模拟：档位、转向灯、Autopilot 与自动并道、红绿灯与路口、周围车辆、紧急车道与靠边停车、电量与超充站
- 导航：真实地图（MapLibre + OpenFreeMap + OSRM + Nominatim，无需 Key），也可切换为离线的程序化城市地图
- 倒车影像（`?rev=1`）、空调、媒体 / 网易云、日历、能耗、行车记录仪、玩具箱、小游戏
- Tesla / CarPlay 两套界面皮肤，深色 / 浅色主题
- 中文 / English / 日本語 实时切换
- WebAudio 实时合成的音效与生成式音乐（可用自己的录音覆盖，见 [sounds/README.md](sounds/README.md)）

### 运行

需要 Python 3（只用标准库）和一个现代浏览器：

```bash
python3 serve.py          # 默认 http://localhost:5173
python3 serve.py 8080     # 指定端口
```

然后打开 <http://localhost:5173>。也可以用 `python3 -m http.server 5173`，区别是无法展开网易云 163cn.tv 短链接。直接双击 `index.html` 也能打开，但浏览器不允许读取本地 GLB，车模会退回程序化车身。

首次打开需要联网，从 CDN 加载 three.js、MapLibre、字体和地图瓦片；地图 / 路线服务不可用时会自动降级为离线示意地图与模拟路线。

### 键盘快捷键

`P R N D` 换挡 · 按住 `↑` 加速 / `↓` 减速 · `← →` 打灯变道 · `A` Autopilot · `空格` 急刹 · 按住 `H` 鸣笛 · `Z` 双闪 · `O` 靠边停车 · `L` 锁车 · `M` 播放 / 暂停 · `- =` 音量 · `Esc` 收起车辆展开视图

### 语言切换

页面顶部工具条的「中文 | EN | 日本語」可实时切换，选择保存在浏览器 localStorage（`driveos.lang`）。词典在 `js/i18n/en.js`、`js/i18n/ja.js`，key 就是中文原文；新增语言：复制 `en.js` 翻译右侧的值，并在 `index.html` 里加一行 `<script src="js/i18n/xx.js">`。

### 网易云音乐

- **默认（无需任何设置）**：媒体 › 网易云里粘贴歌单 / 专辑 / 单曲分享链接，使用网易云官方外链播放器，不读取任何账号信息。
- **登录态（可选，仅自用）**：`netease-api/` 是一个只监听 `127.0.0.1` 的小服务（基于第三方的非官方库 NeteaseCloudMusicApi，接口可能随时失效）。想用的话在该目录运行 `npm install`，重启 `python3 serve.py`，在界面里用网易云 App 扫码登录。
- **登录 cookie 由你在本机自己产生**，只保存在你自己电脑上的 `~/.driveos/netease-cookie.json`（权限 600），不在项目目录里。**请不要把任何 cookie / 登录信息提交到仓库或发给别人**（`.gitignore` 已忽略 `*cookie*.json`）。本仓库不含也不提供任何账号数据。

### 手机访问

电脑运行 `python3 serve.py`，手机与电脑连同一个 Wi-Fi，在手机浏览器打开 `http://<电脑局域网 IP>:5173`（macOS：`ipconfig getifaddr en0`）。横屏使用，1920×1200 画面等比缩放；网易云登录态只允许本机访问。预览手机布局：地址后加 `?phone=1`。

### 项目结构

| 文件 | 内容 |
| --- | --- |
| `index.html` | 页面骨架（设计画布 1920×1200，按窗口等比缩放） |
| `css/style.css` | Tesla 与 CarPlay 两套样式，浅色 / 深色主题 |
| `js/app.js` | Tesla 界面：档位、驾驶模拟、导航、Dock、控制面板、各个应用 |
| `js/carplay.js` | CarPlay 皮肤 |
| `js/car3d.js` | 3D 车辆（真实车模 + 程序化车身）与驾驶可视化 |
| `js/map.js` / `js/simmap.js` | 真实地图 / 离线模拟地图 |
| `js/rearcam.js` | 倒车影像 |
| `js/sound.js` | 合成音效与生成式音乐，支持自定义音效包 |
| `js/i18n.js`、`js/i18n/` | 多语言 |
| `serve.py` | 本地服务器：静态文件 + 网易云短链接展开 + 登录态转发 |
| `netease-api/` | 可选的网易云登录态本地服务 |
| `models/` | 3D 车模与 [CREDITS.md](models/CREDITS.md) |

### 车模与许可

- **代码**：[MIT](LICENSE)。
- **3D 车模不在 MIT 范围内**，沿用原作者许可，详见 [models/CREDITS.md](models/CREDITS.md)：
  - Model 3：“Tesla White car.” by aarajesh / “Tesla Model 3 (Realistic Graphics)” by ChoochooLi，CC BY 4.0
  - Cybertruck：“Tesla Cybertruck 2025” by Nieve5677，CC BY 4.0（本项目拆分了材质，属于改编，见 CREDITS）
- **Model Y 车模未包含**（原作 CC BY-NC 4.0，禁止商业使用）。如需启用，请自行下载并放到 `models/tesla-model-y.glb`（仅限个人非商业使用，已被 `.gitignore` 忽略）；没有该文件时 SUV 车身自动使用程序化外形。
- 其他第三方：three.js（MIT）、MapLibre GL（BSD-3-Clause）、Draco（Apache-2.0）、OpenStreetMap 数据（ODbL）、OpenFreeMap、OSRM / Nominatim 公共服务（请遵守其使用政策）。
- 提示音为合成近似音；请不要提交车厂原厂录音或其他无权分发的音频。

---

## English

### What is it

A static HTML/JavaScript interactive simulator of a Tesla-style in-car touchscreen UI, plus an Apple CarPlay-style skin: 3D car, driving simulation, real-map navigation, climate, media, rear camera, toybox and more. No build step, no backend required — just open it in a browser.

### Features

- 3D car (Three.js): real models for Model 3 and Cybertruck, procedural bodies for the rest; paint/wrap finishes and colours, tail-light styles, door/frunk/trunk/charge-port animations
- Driving simulation: gears, turn signals, Autopilot with automatic lane merge, traffic lights and junctions, surrounding traffic, emergency lane / pull-over, battery and Superchargers
- Navigation: real map (MapLibre + OpenFreeMap + OSRM + Nominatim, no API key) or an offline procedural city map
- Rear camera (`?rev=1`), climate, media / NetEase Cloud Music, calendar, energy, dashcam, toybox, mini games
- Tesla and CarPlay skins, dark/light themes
- Live language switch: 中文 / English / 日本語
- WebAudio-synthesised sounds and generative music (can be overridden with your own recordings, see [sounds/README.md](sounds/README.md))

### Run

Needs Python 3 (standard library only) and a modern browser:

```bash
python3 serve.py          # http://localhost:5173 by default
python3 serve.py 8080     # custom port
```

Then open <http://localhost:5173>. `python3 -m http.server 5173` works too, but cannot expand NetEase `163cn.tv` short links. Opening `index.html` directly also works, but browsers refuse to read local GLB files that way, so the car falls back to the procedural body.

The first load needs internet access (three.js, MapLibre, fonts and map tiles come from CDNs); if the map/route services are unreachable the app degrades to an offline schematic map and simulated routes.

### Keyboard shortcuts

`P R N D` shift gear · hold `↑` accelerate / `↓` brake · `← →` signal & change lane · `A` Autopilot · `Space` emergency brake · hold `H` horn · `Z` hazards · `O` pull over · `L` lock · `M` play/pause · `- =` volume · `Esc` collapse the expanded car view

### Language switch

Use the "中文 | EN | 日本語" switch in the top toolbar; the choice is stored in localStorage (`driveos.lang`). Dictionaries live in `js/i18n/en.js` and `js/i18n/ja.js` (keys are the original Chinese strings). To add a language, copy `en.js`, translate the values, and add a `<script src="js/i18n/xx.js">` line to `index.html`.

### NetEase Cloud Music setup

- **Default (no setup)**: paste a playlist/album/song share link in Media › NetEase. It uses NetEase's official embed player and reads no account data.
- **Login (optional, personal use only)**: `netease-api/` is a small service listening on `127.0.0.1` only, built on the third-party unofficial NeteaseCloudMusicApi library (may break at any time). To use it, run `npm install` in that folder, restart `python3 serve.py`, then scan the QR code with the NetEase app.
- **You generate your own login cookie, locally.** It is stored only on your machine at `~/.driveos/netease-cookie.json` (mode 600), outside the project folder. **Never commit or share any cookie/login data** (`*cookie*.json` is git-ignored). This repository contains no account data.

### Phone access

Run `python3 serve.py` on your computer, put the phone on the same Wi-Fi, and open `http://<computer LAN IP>:5173` (macOS: `ipconfig getifaddr en0`). Use landscape; the 1920×1200 canvas scales to fit. NetEase login is local-only. Preview the phone layout with `?phone=1`.

### Layout

| Path | Purpose |
| --- | --- |
| `index.html` | Page skeleton (1920×1200 design canvas scaled to the window) |
| `css/style.css` | Tesla and CarPlay styles, light/dark themes |
| `js/app.js` | Tesla UI: gears, driving sim, navigation, dock, control panel, apps |
| `js/carplay.js` | CarPlay skin |
| `js/car3d.js` | 3D car (real models + procedural bodies) and driving visualisation |
| `js/map.js`, `js/simmap.js` | Real map / offline simulated map |
| `js/rearcam.js` | Rear camera |
| `js/sound.js` | Synthesised sounds & generative music, custom sound packs |
| `js/i18n.js`, `js/i18n/` | Internationalisation |
| `serve.py` | Local server: static files + NetEase short-link expansion + login proxy |
| `netease-api/` | Optional local NetEase login service |
| `models/` | 3D models and [CREDITS.md](models/CREDITS.md) |

### Models & licences

- **Code**: [MIT](LICENSE).
- **The 3D models are NOT covered by MIT**; they keep their authors' licences — see [models/CREDITS.md](models/CREDITS.md):
  - Model 3: "Tesla White car." by aarajesh / "Tesla Model 3 (Realistic Graphics)" by ChoochooLi, CC BY 4.0
  - Cybertruck: "Tesla Cybertruck 2025" by Nieve5677, CC BY 4.0 (materials split for this project — a modification, see CREDITS)
- **The Model Y model is not included** (original is CC BY-NC 4.0, non-commercial only). To enable it, download it yourself and put it at `models/tesla-model-y.glb` (personal non-commercial use only; git-ignored). Without it, the SUV body is generated procedurally.
- Other third parties: three.js (MIT), MapLibre GL (BSD-3-Clause), Draco (Apache-2.0), OpenStreetMap data (ODbL), OpenFreeMap, OSRM / Nominatim public services (follow their usage policies).
- Sounds are synthesised approximations. Do not commit OEM recordings or any audio you have no right to distribute.

### Disclaimer

**非官方粉丝作品 / Unofficial fan project, not affiliated with Tesla, Inc.; Tesla and related marks belong to Tesla.**
