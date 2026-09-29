# 诗云 · Poetry Cloud（部署说明）

本目录是 [Cohenjikan/shiyun](https://github.com/Cohenjikan/shiyun) 的**静态构建镜像**，
由上游源码在本机构建后放入本站，作为一个独立页面发布。

- **本站地址**：https://xinglan2012.github.io/shiyun/
- **上游项目**：https://github.com/Cohenjikan/shiyun · 官方站 https://shiyun.cohenjikan.com
- **作品简介**：把中国三千年的诗放进一片可漫游的三维星系 —— 每位诗人是一颗星，每首诗都有自己的坐标，
  星与星之间的虚空是「一切可能的诗」。灵感来自刘慈欣《诗云》与博尔赫斯《巴别图书馆》，
  纯静态（索引运算与渲染全部在浏览器里完成）。

## 构建方式

```bash
# 上游源码（main 分支），Node 20+
npm ci
npm run build -- --base=/shiyun/     # 产物挂在本站子路径 /shiyun/ 下
# .env.local:
#   VITE_DATA_BASE=/shiyun/data      ← 语料分片的取数基址
#   VITE_SITE_ORIGIN=https://xinglan2012.github.io/shiyun
```

- 对上游源码只做了**两处路径适配**（其余零改动）：`src/gesture/GestureControls.tsx` 里的
  `gesture-worker.js` / `mediapipe-wasm` / `gesture_recognizer.task` 由根绝对路径改为
  `import.meta.env.BASE_URL` 前缀，否则挂在 `/shiyun/` 下时手势控制会 404。
- 产物为本目录：`index.html` + `assets/`（js/css，约 1 MB）+ `data/`（语料）+ 手势模型与 wasm。
- **配色统一（本站改动）**：上游把 15 个朝代各配了一个颜色（青→绿→金→薄荷→紫→粉→橙→洋红，
  星野因此是一片彩虹）。本站把 `src/data/dynasties.ts` 里这 15 个颜色**全部改为同一个金色
  `#ffd27a`**（即界面本身的金），于是星野、诗人星、诗轨、赠诗弧线、诗人标签、朝代筛选圆点
  全部统一为同一色系；朝代身份仍由同心壳层、筛选开关与文字标签体现，功能不受影响
  （朝代筛选改的是星点尺寸，不依赖颜色）。

## 数据范围（重要）

| 目录 | 内容 | 大小 | 本站是否收录 |
|---|---|---|---|
| `data/poems/` | 逐位诗人的诗篇分片（256 桶 + `.idx.json` 侧车，Range 取片） | ≈ 253 MB | ✅ 全量 |
| `data/search/` | 寻诗 / 诗名前缀索引（256 桶） | ≈ 125 MB | ✅ 全量 |
| `data/lines/` | 诗句全文检索索引（256 桶） | ≈ 323 MB | ❌ 未收录 |
| `data/linesf/` | 异文模糊检索索引 | ≈ 4.4 GB | ❌ 未收录（上游线上亦未部署） |

因此：**星系漫游、诗人列表、点星读诗、赠诗网络、探诗（编号 ↔ 诗）、永久链接、
本地「认领」全部可用**；「寻诗 · 逐句搜索」只有单字 / 半句的前缀增量检索可用，
整句内容检索（依赖未收录的 `lines/`）不可用。需要完整功能请走官方站。

> 说明：语料分片在 GitHub Pages 上同样以 206 Range 返回（已实测），
> 因此点开一位诗人只需取回该诗人在桶内的一小段字节，而不是整个 1 MB 分片。

## 许可

上游代码以 **PolyForm Noncommercial 1.0.0**（源码公开、**仅限非商业**使用）发布；
诗云自有的整理性元数据以 CC BY-NC 4.0 提供；诗歌语料各自保留上游许可，
现 / 当代诗歌文本版权归原作者。此处仅作个人站点的**非商业**展示与镜像，
版权归原作者 [@Cohenjikan](https://github.com/Cohenjikan) 所有；若原作者要求撤下，会立即删除。
