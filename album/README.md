# 云相册

本目录是博客云相册页面（`/album.html`）的照片来源。

## 使用方法

- **子文件夹 = 一个相册**：例如 `album/旅行/`、`album/日常/`
- 直接把图片放进文件夹即可，页面通过 GitHub API 自动列出，**无需修改页面代码**
- 图片命名建议用英文或数字（中文名也可以，页面已做 URL 编码处理）

## 上传方式

### 方式一：页面内直传（/album.html）

相册页点「⬆ 上传」选择图片即可上传到当前所在相册。

- 首次使用点「🔑」按钮粘贴 GitHub Token（Fine-grained token，仓库权限只需 Contents: Read and write）
- Token 只保存在浏览器本机 cookie 中，不上传服务器
- ⚠ 注意：Token 存于浏览器，任何访问者都能读到，务必使用仅限本仓库的最小权限 Token

### 方式二：本地脚本（推荐）

仓库根目录运行（需要本机已配置 GitHub git 凭证）：

```bash
python3 _upload_album.py 照片1.jpg 照片2.png          # 上传到 album/ 根目录
python3 _upload_album.py 照片.jpg --album 旅行        # 上传到 album/旅行/
python3 _upload_album.py 整个文件夹/ --album 日常      # 文件夹所有图片
```

脚本会自动复制图片到 `album/`、git 提交并推送，安全且不暴露 Token。

## 支持格式

`jpg` / `jpeg` / `png` / `gif` / `webp` / `svg` / `bmp` / `avif` / `jfif`

## 注意事项

- 本 README 不会显示在相册页中（只识别图片文件）
- 图片建议压缩后再上传（GitHub 仓库有大小限制，单文件超过 100MB 无法上传）
- 上传后等 GitHub Pages 重新构建完成即可看到（一般 1~2 分钟）
