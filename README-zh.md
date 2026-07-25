# ✦ 星澜之境 — 致彼岸的乌托邦

[![GitHub Pages](https://img.shields.io/badge/blog-星澜之境-ffd700?style=flat-square)](https://xinglan2012.github.io)
[![license](https://img.shields.io/github/license/XingLan2012/xinglan2012.github.io?style=flat-square)](LICENSE)

**星澜之境**，一个属于星澜的小世界。在这里有代码、算法、Minecraft 的故事，也有深夜写下的诗和远方。

> 遇见你，刹那惊鸿，如夏花点燃生命的火。  
> 别离后，静美归途，似秋叶铺满来时的路。

---

## ✦ 站点功能

| 功能 | 说明 |
|------|------|
| 📝 **博客** | OI 算法笔记、生活随笔、Minecraft 故事 |
| ⌨ **OIer 专项** | 算法学习笔记归档 `/ioer/` |
| 🎴 **时运签** | 每日一签，大吉到大凶，配签诗解读 |
| 🎵 **音乐盒** | 65 首 C418 风格 ogg，右下角全局播放 |
| 🤖 **AI 小助手** | 接入 AgnesAPI，智能对话 |
| ☁ **云盘** | `/pan/` 目录文件分享，多镜像节点 |
| ❄ **碎星之列** | 左侧导航面板，快捷跳转 |

### 特色交互

- **星空粒子** — 首页动态星空 + 流星划过
- **冰晶吊坠** — 左上角「碎星之列」导航
- **点击特效** — ✦✧⋆ 点击溅射 + 鼠标轨迹
- **启动动画** — 每日首次加载星澜之境标题动画
- **动态背景** — bg1~bg3 轮播背景

---

## ✦ 技术栈

| 技术 | 用途 |
|------|------|
| [Jekyll](https://jekyllrb.com/) + [TeXt Theme](https://github.com/kitian616/jekyll-TeXt-theme) | 静态博客框架 |
| GitHub Pages | 托管部署 |
| [Agnes API](https://apihub.agnes-ai.com) | AI 对话 |
| HTML / CSS / JavaScript | 前端交互特效 |
| LocalStorage | 时运签每日记录、音乐偏好、文件缓存 |

---

## ✦ 目录结构

```
├── _includes/          # 全局组件（bg轮播、音乐盒、碎星导航等）
├── _layouts/           # 页面布局
├── _data/              # 导航配置
├── _posts/             # 博客文章
├── assets/             # 静态资源（图片、CSS）
├── music/              # 65 首 ogg 音乐
├── pan/                # 云盘文件
├── ioer/               # OIer 算法笔记
├── index.html          # 首页（星空 + AI 聊天）
├── welcome.html        # 欢迎页
├── gacha.html          # 时运签
├── ioer.html           # OIer 专项
├── pan.html            # 云盘
└── archive.html        # 归档
```

---

## ✦ 本地运行

```bash
# 安装依赖
gem install jekyll bundler
bundle install

# 启动本地服务器
bundle exec jekyll serve

# 访问 http://localhost:4000
```

---

## ✦ 协议

本博客内容采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 协议。  
音乐版权归 C418 / Mojang Studios 所有，仅供个人欣赏，非商业用途。

---

<div align="center">
  
✦ 循此苦旅，终抵繁星 ✦

</div>
