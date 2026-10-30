@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo 没找到 node，请手动把 profile 的 package.json 从 .bak 备份还原 & pause & exit /b 1)
echo 正在把 prompt-doctor 从 DSH profile 里摘除...
node tools\profile.mjs uninstall "C:\Users\wst21\.dsh\profiles\desktop"
echo.
echo 完成。重新打开 DeepSeek Harness 即可。
pause
