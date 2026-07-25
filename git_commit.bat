@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
git add -A
git commit -m "refactor: ioer页面行内marked渲染md→html，删副标题，加学习免责声明"
git push
echo ✅ 完成
pause
