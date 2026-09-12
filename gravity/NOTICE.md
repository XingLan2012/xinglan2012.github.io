# Gravity · Solar System Model — 部署与改动说明

本目录是 [qunabu/Gravity](https://github.com/qunabu/Gravity) 的构建产物，依 **GPL-3.0** 许可分发。
本站版本在原版基础上**增加了简体中文（zh）本地化**，因此属于**修改后的衍生版本**。

- **上游仓库**：https://github.com/qunabu/Gravity
- **上游版本**：`main` 分支 commit `06a39d19f87c1fe59f28984f7806298a1fd7f9b1`（2026-06-10）
- **官方在线版**：https://qunabu.github.io/Gravity/
- **许可全文**：同目录 `LICENSE`（GNU General Public License v3.0）
- **本站地址**：https://xinglan2012.github.io/gravity/

## 本站改动（相对上游）

构建基路径由 `/Gravity/` 调整为 `/gravity/`，并新增中文界面与中文讲解。改动清单：

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `src/i18n.ts` | 新增 | 语言状态（`en` / `pl` / `zh`）、语言探测与切换、界面文案表、天体中文名、速度单位格式化 |
| `src/ui/tour-zh.ts` | 新增 | 24 步引导讲解的中文译文（标题＋正文，数字、单位、日期与英文原版一致） |
| `src/ui/tour.ts` | 修改 | 语言按钮改为 EN / PL / 中文；文案取自 `i18n`；中文时旁白音频回退到英文；中文按字计时 |
| `src/ui/panel.ts` | 修改 | 控制面板文案、提示语、天体下拉列表随语言切换即时重建 |
| `src/scene/world.ts` | 修改 | 3D 标签（行星、卫星、引力影响球、旅行者号、水星近日点）随语言切换即时更新 |
| `src/style.css` | 修改 | 追加 `html[lang^='zh']` 排版规则：CJK 字体回退、更大行高、收紧字距 |

- **未改动**：`public/` 下的全部音频（48 个旁白片段 ＋ 1 首背景乐）、贴图（`earth_daymap.jpg`、`Moon-TomBrown.webp`）、
  3D 模型与物理代码。经逐一比对，上游 71 个文件（含全部音频与贴图）的 git blob 哈希与本站副本完全一致。
- **旁白音频**：上游只有英文（`.en.mp3`）与波兰文（`.pl.mp3`）。中文界面下讲解文字为中文、旁白播放英文音轨，
  不新增、不改动任何音频文件。
- **语言选择**：默认按浏览器语言自动选择（`zh*` → 中文，`pl*` → 波兰文，其余 → 英文）；
  可用 `?lang=zh`、`?lang=en`、`?lang=pl` 强制指定
  （例如 https://xinglan2012.github.io/gravity/?lang=zh#what-is-gravity ），
  界面右上角的语言按钮切换后会记住选择（localStorage）并同步写回 URL。

## 对应源码（Corresponding Source）

本站已随页面附带完整应用源码，位于本目录 `src/`：

- `src/`：本页面的完整源代码（与上游同名文件一一对应）
- `localization.patch`：相对上游 commit `06a39d19` 的统一 diff（4 个修改文件 ＋ 2 个新增文件），
  可在上游仓库根目录用 `patch -p1 < localization.patch` 或 `git apply localization.patch` 复现本站版本
- **构建命令**：`npm install && npx vite build --base=/gravity/`（依赖仅 `three@0.184`）

## 许可说明

本衍生版本整体仍为 **GPL-3.0**，源码随附于上。本站以**独立页面**形式提供该应用
（https://xinglan2012.github.io/gravity/），未与本站其他代码合并或链接，本站其余部分不因此受 GPL 约束。
内容与代码版权归上游作者所有；中文译文由本站补充，同样以 GPL-3.0 提供。
