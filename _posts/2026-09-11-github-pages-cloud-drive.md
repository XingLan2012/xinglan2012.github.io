---
title: "用 GitHub 当免费云盘：Fork 一个属于你自己的文件站"
date: 2026-09-11 21:40:00 +0800
tags: [星澜, 技术, GitHub, 教程]
---

> 循此苦旅，终抵繁星。

---

博客左侧「碎星之列」里有一个叫**云盘**的入口。点进去是一张文件表：名字、大小、一个下载按钮。没有后端，没有服务器，没有一分钱开销 —— 它就是本仓库里一个叫 `pan/` 的目录。

这篇是写给别人的：**怎么用 GitHub 的静态托管，fork 出一个属于你自己的云盘。** 全部过程不需要买服务器、不需要域名，也不需要会写后端。

在线演示（这就是成品，点开就能用）：
<https://xinglan2012.github.io/tools/standalone-pan.html>

---

## 一、先搞清楚：为什么 GitHub 能当云盘

GitHub 提供三样东西，凑在一起正好够用：

| 能力 | 用途 | 限制 |
| --- | --- | --- |
| **仓库**（Git） | 存文件，还自带版本历史 | 单文件硬上限 100 MB，仓库建议 1 GB 内 |
| **GitHub Pages** | 把仓库当网站托管，全球 CDN | 免费、公开、只支持静态页面 |
| **REST API + Raw 直链** | 让页面能列出文件、能下载文件 | 未登录时每小时 60 次请求 |

关键在于：**「列出文件」和「下载文件」都不需要后端。** 列目录是一次 API 调用，下载是一条 `raw.githubusercontent.com` 直链。所以一个纯静态页面就能做出网盘的样子。

它的边界也很清楚，先说明白，免得你走弯路：

- **单个文件超过 100 MB 传不上去**（GitHub 硬限制，会直接拒绝推送）—— 我在自己站点上就遇到过：一个 101 MB 的安装包只能改用「跳转 Release 附件」的方式分发。
- **只适合公开文件**。仓库是公开的，任何拿到链接的人都能下载。**绝对不要放密码、密钥、个人证件之类的东西。**
- **私有仓库用不了这套**。页面是公开的，匿名调 API 读不到私有仓库的内容（要读就得把 Token 写进页面，那等于公开 Token）。
- **它不是一个「网盘」**，是「文件分发站」。放安装包、壁纸、电子书、自己做的小工具，都合适。

## 二、五分钟跑起来

### 第 1 步：Fork

打开本项目的仓库，点右上角 **Fork**，得到一份属于你的副本：

```
https://github.com/XingLan2012/xinglan2012.github.io
```

Fork 之后，仓库地址变成 `https://github.com/你的用户名/xinglan2012.github.io`。

> 如果你只想要云盘功能、不想要这一整套博客，也可以**新建一个空仓库**，把下面的文件放进去就行 —— 云盘页不依赖这套主题。

### 第 2 步：放文件

在你的仓库里新建一个目录，名字叫 `pan`，把要分享的文件传进去（网页上点 **Add file → Upload files** 就能传）。

```
你的仓库/
└── pan/
    ├── 工具包.zip
    ├── 说明书.pdf
    └── 我的照片.jpg
```

### 第 3 步：开启 Pages

仓库 **Settings → Pages**：

- **Source** 选 `Deploy from a branch`
- **Branch** 选你的默认分支（`main` 或 `master`），目录选 `/ (root)`
- 保存，等一两分钟

然后访问：

- 仓库名叫 `你的用户名.github.io` → 直接访问 `https://你的用户名.github.io/pan.html`
- 其他仓库名 → 访问 `https://你的用户名.github.io/仓库名/pan.html`

## 三、把云盘页放进去

本项目的云盘页是 [`pan.html`](https://github.com/XingLan2012/xinglan2012.github.io/blob/master/pan.html)，但它长在 Jekyll 主题里，直接抄过去还要装主题。

所以我单独写了一份**自包含版本**，一个文件、零依赖、复制即用：

📄 **源码**：<https://github.com/XingLan2012/xinglan2012.github.io/blob/master/tools/standalone-pan.html>
🔗 **在线演示**：<https://xinglan2012.github.io/tools/standalone-pan.html>

把它另存到你的仓库（比如就叫 `pan.html`），提交，访问即可。

### 它是怎么工作的

核心只有三段。**列出文件**：

```js
fetch('https://api.github.com/repos/' + repo + '/contents/pan')
  .then(r => r.json())
  .then(items => items.filter(i => i.type === 'file'))
```

拿回来的每一项都带着 `name` 和 `size`，直接渲染成表格。

**下载文件**：

```js
'https://raw.githubusercontent.com/' + repo + '/' + branch + '/pan/' + encodeURIComponent(name)
```

`raw.githubusercontent.com` 就是文件内容本身，浏览器会直接下载，不消耗 API 次数。

**少调接口**：列表缓存进 `localStorage`，五分钟内刷新页面不再请求（API 每小时只有 60 次，这个缓存是必需的，不是优化）。

### 有个坑，我替你踩过了

上面那段下载链接里有个 `branch`。**它必须和仓库的默认分支一致** —— 写错了，页面能列出文件，但每个下载按钮都是 404。

我的站点默认分支是 `master`，而代码里一开始写的是 `main`（GitHub 新建仓库的默认值），结果云盘的下载链接**坏了一段时间才被发现**。列出文件和下载走的是两套地址，所以前半截正常、后半截全错，很容易漏掉。

因此自包含版做了两件事：

1. **自动识别仓库**：从访问地址推断。`你的用户名.github.io` 是用户页，仓库名就是域名本身；`你的用户名.github.io/仓库名` 是项目页，取路径第一段。
2. **自动读取默认分支**：调一次 `GET /repos/{owner}/{repo}`，从 `default_branch` 拿到真实分支名，并缓存 24 小时。**这样无论你的默认分支叫 `main` 还是 `master`，都不用改代码。**

只有当你把它挂在 GitHub Pages 之外（Netlify、Vercel、自己电脑上）时，自动识别会失效 —— 那就把文件开头两行填上：

```js
var REPO = '你的用户名/你的仓库名';
var BRANCH = 'main';   // 或 master
```

## 四、其他几个值得知道的地方

**中文文件名**。可以用，但 URL 里必须编码。`encodeURIComponent('说明书.pdf')` 会变成一长串 `%E8%AF%B4...`，这是正常的，浏览器访问时还会显示成中文名。自包含版已经处理好了。

**超过 100 MB 的文件**。放不进仓库。做法是挂在 **Release** 上：仓库 → Releases → 新建一个 release → 把大文件作为附件上传，然后把附件链接手写进页面。我自己的云盘页底部就有这么一个「外部链接」区：

```html
<div class="ext-item">
  <a href="https://github.com/用户/仓库/releases/download/v1/big.zip">big.zip</a>
  <span>约 101 MB，跳转 Release 下载</span>
</div>
```

**想批量上传**。网页上传一次只能选一批，文件多了很烦。用 Git 命令更省事：

```bash
cp ~/下载/*.zip pan/          # 把文件复制进 pan 目录
git add pan && git commit -m "add files" && git push
```

**API 限流**。未登录时每个 IP 每小时 60 次列目录。有五分钟缓存，正常浏览不会碰到；但如果你的页面被很多人同时打开，可能会看到「请求次数超限」的提示 —— 页面会回退到缓存数据，不会白屏。

**更新有延迟**。提交之后 GitHub Pages 要重新构建，通常一到两分钟。刚传完文件打开页面看不到，等一会儿再刷新。

**路径问题**。如果你 Fork 的是整套博客并部署为**项目页**（`用户名.github.io/仓库名/`），那么主题里那些以 `/` 开头的绝对路径会全部失效 —— 这是这类静态博客搬到子路径下最常见的坑。只想要云盘功能的话，用自包含版最省事，它没有任何绝对路径。

## 五、最后

这套方案的边界，其实就是 GitHub 的边界：**公开、静态、单文件 100 MB 以内**。

在这个范围里，它几乎没有成本：不用买服务器，不用配数据库，不用管运维，还白得一份版本历史和全球 CDN。我这个站点的云盘里放着 Minecraft 模组和一个自己写的单文件小游戏 —— 都是「丢进去就不用管」的东西。

而它最让我满意的一点是：**整套东西就是几个文件，谁都能看懂**。没有魔法，没有黑箱，出了问题翻一遍源码就知道为什么。

如果哪天 GitHub 改了规则，改几行就是了。

循此苦旅，终抵繁星。
