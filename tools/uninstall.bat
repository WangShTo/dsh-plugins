@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set P=%USERPROFILE%\.dsh\profiles\desktop

echo [1/3] 恢复 package.json ...
for /f "delims=" %%f in ('dir /b /o-d "%P%\package.json.bak-*" 2^>nul') do (
  copy /y "%P%\%%f" "%P%\package.json" >nul && echo   用 %%f && goto :deps
)
echo   没找到备份，跳过
:deps

echo [2/3] 恢复 cordis.patch.yml ...
for /f "delims=" %%f in ('dir /b /o-d "%P%\cordis.patch.yml.bak-*" 2^>nul') do (
  copy /y "%P%\%%f" "%P%\cordis.patch.yml" >nul && echo   用 %%f && goto :link
)
echo   没找到备份，跳过
:link

echo [3/3] 删掉软链 ...
if exist "%P%\node_modules\dsh-prompt-doctor" (
  rmdir "%P%\node_modules\dsh-prompt-doctor" 2>nul || del /q "%P%\node_modules\dsh-prompt-doctor"
  echo   已删除
) else (
  echo   不存在，跳过
)

echo.
echo 完成。重新打开 DeepSeek Harness 即可。
pause
