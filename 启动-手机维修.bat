@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ===== 手机维修管理系统（不是顺丰打单）=====
echo 将打开浏览器: http://127.0.0.1:5288
echo 若失败请确认 Cursor 已打开文件夹: %CD%
echo.
start "" "http://127.0.0.1:5288"
call npm run dev
