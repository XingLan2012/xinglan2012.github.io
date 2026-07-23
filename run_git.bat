@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
echo === git add ===
git add -A
echo === git commit ===
git commit -m "feat: 全局bg1~bg3动态背景轮播，welcome.html半透明衬底，index.html隐藏轮播保留星空"
echo === git push ===
git push
echo === DONE ===
pause
