@echo off
chcp 65001 >nul
git add -A
git commit -m "fix: 心念-抽取满10张+修复拖拽闭包bug+网格坐标IIFE修复"
git push
echo ✅
pause
