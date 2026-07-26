@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
git add -A
git commit -m "fix: 心念5x5网格+悬停整块高亮+点击卸下+每日签到EXP"
git push
echo ✅
pause
