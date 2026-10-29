# 车模来源与许可 / 3D Model Credits

本目录里的 3D 车模**不属于**本项目的 MIT 许可，各自沿用原作者的许可（均为 CC BY 4.0，需署名）。再分发本项目时请保留本文件。
The 3D models in this folder are **not** covered by the project's MIT licence. Each keeps its own licence (both are CC BY 4.0 — attribution required). Keep this file when redistributing.

许可信息于 2026-10-29 通过 Sketchfab 公开 API（`api.sketchfab.com/v3/models/<uid>`）核对。/ Licences were checked against the public Sketchfab API on 2026-10-29.

| 文件 / File | 作品与作者 / Work & author | 许可 / Licence | 是否允许修改 / Modification |
| --- | --- | --- | --- |
| `tesla-model-3.glb` | “Tesla White car.” by **aarajesh** — <https://sketchfab.com/3d-models/tesla-white-car-2a4ee44439dc4b1b98f452a9ff427116>；再发布 / re-upload：“Tesla Model 3 (Realistic Graphics)” by **ChoochooLi Models** — <https://sketchfab.com/3d-models/tesla-model-3-realistic-graphics-4cf4fa457fbe4f32808348d7b8a13939> | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 允许，须注明改动 / Yes, changes must be indicated |
| `tesla-cybertruck.glb` | “Tesla Cybertruck 2025” by **Nieve5677** (@niev) — <https://sketchfab.com/3d-models/tesla-cybertruck-2025-0fe4980c8cbc441382bfb7d4cf9f092e> | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 允许，须注明改动 / Yes, changes must be indicated |

## tesla-model-3.glb

- 文件内嵌元数据署名 aarajesh（*Tesla White car.*）；分发方 TeslaHub 社区模型 `community-m3-rigged.glb` 署名 ChoochooLi（*Tesla Model 3 (Realistic Graphics)*）。两个 Sketchfab 页面均标注 CC BY 4.0，且三角面数相同（684.3k），ChoochooLi 的页面（2025-08-13）晚于 aarajesh 的页面（2023-02-02），很可能是同一模型的再上传，所以两位作者都保留署名。
  Both Sketchfab pages are CC BY 4.0 and have identical triangle counts (684.3k); ChoochooLi's page (2025‑08‑13) is later than aarajesh's (2023‑02‑02), so it is probably a re-upload. Both authors are credited.
- 分发方（TeslaHub）所做的修改：加入车门 / 前备箱 / 后备箱开合枢轴，使用 gltf-transform 优化（Draco 压缩），调整尺寸与朝向，重映射车漆材质。记录于 <https://github.com/Olrik-WP/TeslaHub>（`src/TeslaHub.Web/public/community-models/CREDITS.md`）。
  Changes by the distributor (TeslaHub): rigged door/hood/trunk pivots, optimised with gltf-transform (Draco), re-scaled/re-oriented, paint material remapped.
- 本文件取自 <https://github.com/ryanzeeee/Tesla-UI-prototype>（`public/models/tesla-model-3.glb`）；SHA-256：`a8c079bf8b2143389dcd8c1618ac39b121414c9f5dc9c3cd1f7003f722f39225`。
- 本项目**未修改 GLB 文件本身**。运行时的改动（代码里完成）：缩放与摆正、替换车漆 / 玻璃 / 灯光材质、隐藏位置不准的充电口盖板并另加充电口指示灯、车轮滚动与前后备箱开合动画。
  This project does **not** modify the GLB file itself; runtime adjustments (scale/orientation, material replacement, hidden charge-port cover, wheel and trunk animations) are done in code.

## tesla-cybertruck.glb

- 原作：“Tesla Cybertruck 2025” by Nieve5677，CC BY 4.0。
- 中间改编：<https://github.com/aditano/tesla-studio>（`public/models/cybertruck-import/`）把原始 FBX 转为 glTF：坐标轴归一化、长度缩放到 5.683 m、Meshopt 无损压缩。tesla-studio 在其 CREDITS 中同样记录原作许可为 CC BY 4.0。（tesla-studio 仓库的**代码**为 GPL-3.0，与本模型文件的许可无关，本项目没有使用其代码。）
  Intermediate adaptation by tesla-studio (axis normalisation, scaling to 5.683 m, lossless Meshopt compression). Its repository code is GPL-3.0 but that is unrelated to this model file; no tesla-studio code is used here.
- **本项目的本地改动（Modification notice）**：在 tesla-studio 版本的基础上，按网格中相连的零件把原先的单一钢材质拆成 `exterior_steel` / `glass` / `tire` / `rim` / `headlight` / `taillight` 六类材质（几何未改动），使玻璃、轮胎、轮辋和灯不随车衣变色；文件经重新打包（Meshopt）。本仓库中的文件即此改动版（内部开发时称 v7，已改名为 `tesla-cybertruck.glb`）。
  **Modified for this project**: starting from the tesla-studio file, the single steel material was split by connected mesh parts into six materials (geometry unchanged) so glass/tyres/rims/lights don't change with the wrap colour. The file in this repo is that modified version (internally "v7", renamed to `tesla-cybertruck.glb`).
- 运行时的改动：缩放到约 5.0 m、转向、车宽按 1.55 倍拉回真车比例、去掉车顶上方 3 个不属于车身的漂浮多面体、车漆按所选颜色着色。
- SHA-256：`7e9d36b82512ae6a09c4338d90aee0d8a6f4c5b2299316c71c99421d149af080`。

## 未随仓库提供：Model Y / Not included: Model Y

“2025 Tesla Model Y” by BloxBloger（<https://sketchfab.com/3d-models/2025-tesla-model-y-619601e7800d418da5922c4fa7833f74>）的许可是 **CC BY-NC 4.0（禁止商业使用）**，与面向任意用途的开源仓库不兼容，因此**不包含在本仓库中**。代码里保留了一个可选入口：如果你自己下载了该模型（个人非商业使用）并放到 `models/tesla-model-y.glb`，应用会自动启用；没有这个文件时，SUV 车身使用程序化生成的外形，不会报错。`.gitignore` 已忽略该文件，请不要把它提交或分发。
The Model Y is CC BY-NC 4.0 (non-commercial) and therefore **not included**. If you download it yourself for personal non-commercial use and place it at `models/tesla-model-y.glb`, the app will pick it up; otherwise the SUV body is generated procedurally. The file is git-ignored — do not commit or redistribute it.

## 商标 / Trademarks

“Tesla”、“Model 3”、“Model Y”、“Cybertruck”及相关标识归 Tesla, Inc. 所有。本项目为非官方粉丝作品，与 Tesla, Inc. 无关联。
Tesla, Model 3, Model Y, Cybertruck and related marks belong to Tesla, Inc. This is an unofficial fan project, not affiliated with Tesla, Inc.
