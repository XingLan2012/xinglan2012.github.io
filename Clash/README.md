# Clash 配置（加密存放）

本目录对外只提供**加密后**的配置，明文不再入库。

- 解密页面：https://xinglan2012.github.io/Clash/
- 加密文件：`Clash/config.enc.json`（约 78 KB）
- 本地明文（不提交）：`~/clash/config.yaml`，即本机 Clash 实际运行的配置

## 加密方案

`gzip` 压缩 → **AES-256-GCM**（128 位认证标签）加密，密钥由 **PBKDF2-HMAC-SHA256**（600 000 次迭代）
从密码派生，盐值与 IV 每次重新生成。文件中**不含明文密码**，只存一份同为 PBKDF2-SHA256 派生的
校验值（`check`）用于即时判断密码对错；完整性由 GCM 认证标签保证。解密全部在浏览器本地用 WebCrypto 完成。

## 更新配置

```bash
# 1. 本地改完 ~/clash/config.yaml 后重新加密（口令从环境变量传入，不写入仓库）
CLASH_PW='你的密码' node _clash_crypt.mjs encrypt ~/clash/config.yaml Clash/config.enc.json

# 2. 提交推送
git add Clash/config.enc.json && git commit -m "chore(clash): update the encrypted config" && git push
```

其他子命令：`decrypt <加密文件> <输出>` 解回明文；`check <加密文件>` 只验证密码是否正确。

## 注意

- 不要把 `config.yaml` 明文提交回仓库（`.gitignore` 已忽略本地工具 `_*.mjs`，明文本身请留在仓库外）。
- 解密页面通过 `noindex` 与不公开的链接降低曝光，但**加密文件本身是公开可下载的**；
  安全性完全取决于密码强度与 600 000 次 PBKDF2 迭代。
