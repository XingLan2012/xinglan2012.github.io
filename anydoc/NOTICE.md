# anydoc（本站汉化版）

本目录是 [firecrawl/anydoc](https://github.com/firecrawl/anydoc) 官方在线演示页
（https://firecrawl.github.io/anydoc/ ，MIT 许可）的**中文化镜像**。

- **本站地址**：https://xinglan2012.github.io/anydoc/
- **是什么**：纯浏览器端文档转换器 —— 把 doc / docx / odt / rtf / epub / pdf / 演示文稿 / 表格 / csv
  转成 GitHub 风格 Markdown。核心是 Rust 编译的 WebAssembly（约 6.7 MB），**文件不上传、全在本机转换**。
- **本站改动**：仅把界面文案译成简体中文（标题、副标题、说明、按钮、拖拽提示、错误提示、`<html lang>`、meta 描述），
  并把页脚/首屏的品牌署名改成中文表述。**未改动任何 JS 逻辑与 wasm**（`pkg/anydoc_wasm_bg.wasm` 原样保留），
  因此 wasm 内部抛出的错误信息仍是英文。
- **文件构成**：`index.html`（单页应用）＋ `assets/`（logo 与两款字体）＋ `pkg/`（wasm-pack 产物）。
  共 12 个文件、约 6.6 MB。
- **依赖**：无需后端；页面只引用自身资源（字体、logo、wasm），不请求第三方接口。
- 版权归 Firecrawl 所有，MIT 许可下可自由分发与修改。
