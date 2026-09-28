# 诗云 · Poetry Cloud（部署说明）

本目录把 [Cohenjikan/shiyun](https://github.com/Cohenjikan/shiyun) 作为本站的一个独立页面接入。

- **本站地址**：https://xinglan2012.github.io/shiyun/
- **上游项目**：https://github.com/Cohenjikan/shiyun · 官方站 https://shiyun.cohenjikan.com
- **作品简介**：把中国三千年的诗放进一片可漫游的三维星系 —— 每位诗人是一颗星，每首诗都有自己的坐标，
  星与星之间的虚空是「一切可能的诗」。灵感来自刘慈欣《诗云》与博尔赫斯《巴别图书馆》。
  32,657 位诗人 / 933,857 首诗，纯静态（索引运算与渲染全在浏览器里完成）。
- **接入方式**：页面以全屏内嵌（iframe）官方站的方式呈现，顶栏保留「在新标签页打开官方站」入口。
  **为什么不做完整离线镜像**：诗云的语料体量极大 —— 逐首诗全文 `data/poems/` ≈ 279 MB、
  诗句检索 `data/lines/` ≈ 323 MB、寻诗前缀索引 `data/search/` ≈ 41 MB（合计约 640 MB，
  另加 `linesf/` 异文索引约 4.4 GB）。这远超本站（GitHub Pages）适宜的仓库/发布体积，
  因此这里不复制语料，改为嵌入上游官方站，既保证功能完整，也永远跟随上游最新版本。
  上游的静态资源在 `data/poems/*.json` 上依赖 HTTP Range 取片，GitHub Pages 亦支持（已验证 206），
  若日后要改为本地镜像，可直接沿用本目录的页面结构。
- **许可**：上游代码以 **PolyForm Noncommercial 1.0.0**（源码公开、仅限非商业使用）发布，
  诗歌语料各自保留上游许可，现当代诗歌文本版权归原作者。此处仅作个人站点的**非商业**展示与跳转，
  版权归原作者 [@Cohenjikan](https://github.com/Cohenjikan) 所有；若原作者要求撤下，会立即删除。
