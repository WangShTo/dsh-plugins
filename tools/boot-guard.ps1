# 启动守护：重启后 90 秒内如果出现新的崩溃日志，自动把插件摘掉并再重启一次。
# 目的：不要再出现「装完插件 → DSH 打不开 → 他没法自救」。
$ErrorActionPreference = 'SilentlyContinue'
$log = 'G:\提纯\plugin\.guard.log'
$exe = 'G:\deepseek harness\DeepSeek Harness.exe'
$logsDir = Join-Path $env:APPDATA '@deepseek-ai\dsh-desktop\logs'
$since = Get-Date
"$(Get-Date -Format 'HH:mm:ss') guard start" | Out-File $log -Append -Encoding utf8
Start-Sleep -Seconds 90
$bad = Get-ChildItem $logsDir -Filter 'crash-*.log' | Where-Object { $_.LastWriteTime -ge $since }
if ($bad) {
  "$(Get-Date -Format 'HH:mm:ss') 发现新崩溃日志: $($bad.Name -join ', ')" | Out-File $log -Append -Encoding utf8
  Set-Location 'G:\提纯\plugin'
  & node tools/profile.mjs uninstall 'C:\Users\wst21\.dsh\profiles\desktop' *>> $log
  Get-Process -Name 'DeepSeek Harness' | Stop-Process -Force
  Start-Sleep -Seconds 3
  Start-Process -FilePath $exe
  "$(Get-Date -Format 'HH:mm:ss') 已回滚并重启" | Out-File $log -Append -Encoding utf8
} else {
  "$(Get-Date -Format 'HH:mm:ss') 无新崩溃，保留插件" | Out-File $log -Append -Encoding utf8
}
