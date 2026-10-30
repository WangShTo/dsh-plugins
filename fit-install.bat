@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo 没找到 node & pause & exit /b 1)
echo 安装前自检...
node tools\profile.mjs verify "C:\Users\wst21\.dsh\profiles\desktop"
echo.
echo 正在安装到 DSH profile...
node tools\profile.mjs install "C:\Users\wst21\.dsh\profiles\desktop"
echo.
echo 完成。重启 DeepSeek Harness 生效。
pause
