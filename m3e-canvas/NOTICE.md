# M3E Canvas（部署说明）

本目录是 [lnkiai/m3e-canvas](https://github.com/lnkiai/m3e-canvas) 的**静态产物镜像**。

- **上游**：https://github.com/lnkiai/m3e-canvas · 原站 https://lnkiai.github.io/m3e-canvas/ · MIT 许可
- **本站地址**：https://xinglan2012.github.io/m3e-canvas/
- **是什么**：在浏览器里画 Material 3 Expressive 界面草图，并把画好的稿子转成给 AI 用的 vibe-coding 提示词。Next.js 静态导出，界面支持多语言。
- **改动**：无代码改动。按原站逐文件取回构建产物（HTML / `_next` 分块 / 图标 / 清单），共 19 个文件、约 1.4 MB。
- **为什么路径必须叫 `m3e-canvas`**：Next.js 导出时资源写的是绝对路径 `/m3e-canvas/_next/...`，因此本站必须放在同名目录下，否则所有静态资源都会 404。
- **外链说明**：页面会加载 Google 的字体/图标 CDN；上游若接入自带的模型接口，也会直接请求对应第三方服务，这些都不经过本站。
- 版权归原作者所有，此处仅作静态镜像展示；MIT 许可下可自由分发。
