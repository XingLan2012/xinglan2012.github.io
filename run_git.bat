@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
echo === git add ===
git add -A
echo === git commit ===
git commit -m "fix: 全局bg-slideshow z-index从-1改为0，修复背景不可见问题；welcome.html去掉html透明覆盖"
echo === git push ===
git push
echo === DONE ===
pause
