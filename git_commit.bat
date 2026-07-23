@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
git add -A
git commit -m "refactor: 冰晶吊坠→碎星之列，金色碎星SVG图标+金色主题"
git push
echo ✅ 完成
pause
