$ErrorActionPreference = "SilentlyContinue"
$log = "G:\提纯\plugin\.restart-probe.log"
$exe = "G:\deepseek harness\DeepSeek Harness.exe"
$logsDir = Join-Path $env:APPDATA "@deepseek-ai\dsh-desktop\logs"
$since = Get-Date
"$(Get-Date -Format "HH:mm:ss") restart requested" | Out-File $log -Encoding utf8
Get-Process -Name "DeepSeek Harness" | Stop-Process -Force
Start-Sleep -Seconds 4
Start-Process -FilePath $exe
Start-Sleep -Seconds 30
$procs = Get-Process -Name "DeepSeek Harness"
$crash = Get-ChildItem $logsDir -Filter "crash-*.log" | Where-Object { $_.LastWriteTime -ge $since }
"$(Get-Date -Format "HH:mm:ss") procs=$($procs.Count) window=$([bool]($procs | Where-Object { $_.MainWindowTitle }))" | Out-File $log -Append -Encoding utf8
if ($crash) { foreach ($c in $crash) { "CRASH $($c.Name)" | Out-File $log -Append -Encoding utf8; Get-Content $c.FullName -TotalCount 20 | Out-File $log -Append -Encoding utf8 } } else { "no new crash log" | Out-File $log -Append -Encoding utf8 }
