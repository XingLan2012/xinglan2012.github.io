@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
git add -A
git commit -m "feat: 冰晶吊坠+下拉导航面板，全局左上角冰晶图标"
git push
echo ✅ 完成
pause
