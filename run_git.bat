@echo off
chcp 65001 >nul
cd /d "C:\Users\何梓熠\Documents\code\xinglan2012.github.io"
echo === git add -A ===
git add -A
echo === git status ===
git status
echo === git commit ===
git commit -m "refactor: welcome.html纯黑背景，index.html进入正页后还原为dark主题默认bg逻辑"
echo === git push ===
git push
echo === DONE ===
pause
