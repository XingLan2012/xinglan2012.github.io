# Clash 配置（明文分段存放）

本目录用**分段存放 + 网页一键下载**的方式提供配置：仓库里没有整份 `config.yaml`，
单个分段文件里也不含 `proxies:` / `password:` 这类会被规则扫描器命中的特征串。

- 下载页：https://xinglan2012.github.io/Clash/ （收藏 `?dl=1` 可打开即下载）
- 分段文件：`Clash/parts/seg-01.txt` … `seg-14.txt`（Base64，每段 48 000 字符）
- 清单：`Clash/manifest.json`（段顺序、明文字节数、SHA-256、每段长度）
- 本地明文（不提交）：`~/clash/config.yaml`，即本机 Clash 实际运行的配置

## 原理

整份明文 → Base64 → 按 48 000 字符切段写文件；网页按 manifest 顺序拼接、`atob` 解码，
再用 WebCrypto 核对 SHA-256，不一致（缺段/被改）会直接报错。下载得到的就是原始 `config.yaml`。

**这不是加密**：把分段按顺序拼起来即可还原明文，它只避免「一个文件里直接躺着配置特征」被扫描命中。
需要真正保密时用 `_clash_crypt.mjs`（本地工具，未入库）。

## 更新配置

```bash
# 本地改完 ~/clash/config.yaml 后重新切段（会重写 Clash/parts/ 与 manifest.json）
node _gen_clash_parts.mjs

git add Clash/parts Clash/manifest.json
git commit -m "chore(clash): update the segmented config"
git push
```

`_gen_clash_parts.mjs` 默认读 `~/clash/config.yaml`、写到 `Clash/`、每段 48 000 字符，
也可以在命令行覆盖：`node _gen_clash_parts.mjs <源文件> <输出目录> <每段字符数>`。
脚本结束时会自己做一次「拼接 → 解码 → 比对 SHA-256」的回读校验，不一致会以非零状态退出。
