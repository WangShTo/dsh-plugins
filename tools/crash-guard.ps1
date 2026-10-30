# DSH 崩溃自愈守卫（单文件、随用随退、无常驻进程）
#
# 为什么需要它：DSH 启动失败时会把 profile 的 bundles 从 21 个缩到 2 个，
# 越重启越残。这个脚本在开机（或手动）时做一件事：
#   启动应用 → 等 30 秒 → 有新的 web-boot 崩溃日志就把 profile 还原成「上次能开的样子」→ 再启动一次 → 退出。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File crash-guard.ps1 -Mode snapshot   # 记录当前可用状态
#   powershell ... -File crash-guard.ps1 -Mode watch                                    # 启动并自愈
#   powershell ... -File crash-guard.ps1 -Mode check -DryRun                            # 只诊断不动手
param(
  [ValidateSet('snapshot', 'watch', 'check')] [string]$Mode = 'check',
  [switch]$DryRun
)

$ErrorActionPreference = 'SilentlyContinue'
$exe = 'G:\deepseek harness\DeepSeek Harness.exe'
$profileDir = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'
$logsDir = Join-Path $env:APPDATA '@deepseek-ai\dsh-desktop\logs'
$stateDir = Join-Path $env:LOCALAPPDATA 'dsh-guard'
$goodDir = Join-Path $stateDir 'good'
$logFile = Join-Path $stateDir 'guard.log'

New-Item -ItemType Directory -Force -Path $stateDir, $goodDir | Out-Null

function Write-GuardLog([string]$msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $logFile -Value $line -Encoding utf8
  Write-Host $line
}

function Save-Good {
  Copy-Item (Join-Path $profileDir 'package.json') (Join-Path $goodDir 'package.json') -Force
  Copy-Item (Join-Path $profileDir 'cordis.patch.yml') (Join-Path $goodDir 'cordis.patch.yml') -Force
  $bundles = (Get-Content (Join-Path $goodDir 'package.json') -Raw | ConvertFrom-Json).dsh.profile.bundles.Count
  Write-GuardLog "snapshot: bundles=$bundles -> $goodDir"
}

function Test-GoodBackup {
  $f = Join-Path $goodDir 'package.json'
  if (-not (Test-Path $f)) { return $false }
  $raw = [System.IO.File]::ReadAllBytes($f)
  if ($raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF) { return $false } # BOM 会让宿主 fatal
  try { $null = [System.IO.File]::ReadAllText($f) | ConvertFrom-Json } catch { return $false }
  return $true
}

function Restore-Good {
  if (-not (Test-GoodBackup)) { Write-GuardLog 'restore: 备份不可用，跳过'; return $false }
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item (Join-Path $profileDir 'package.json') (Join-Path $stateDir "package.broken-$stamp.json") -Force
  Copy-Item (Join-Path $profileDir 'cordis.patch.yml') (Join-Path $stateDir "patch.broken-$stamp.yml") -Force
  Copy-Item (Join-Path $goodDir 'package.json') (Join-Path $profileDir 'package.json') -Force
  Copy-Item (Join-Path $goodDir 'cordis.patch.yml') (Join-Path $profileDir 'cordis.patch.yml') -Force
  Write-GuardLog "restore: 已还原到 $stamp 之前的可用状态"
  return $true
}

function Get-NewCrash([datetime]$since) {
  Get-ChildItem $logsDir -Filter 'crash-*.log' -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $since -and $_.Length -gt 0 }
}

function Get-AppProcess {
  Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue
}

function Start-App {
  if ($DryRun) { Write-GuardLog 'dry-run: 不启动应用'; return }
  Start-Process -FilePath $exe | Out-Null
}

function Test-BootBroken([datetime]$since) {
  $crashes = Get-NewCrash $since
  if (-not $crashes) { return $null }
  $webBoot = $crashes | Where-Object { $_.Name -like '*web-boot*' -and (Select-String -Path $_.FullName -Pattern 'did not activate' -Quiet) }
  if ($webBoot) { return 'web-boot: entries did not activate' }
  $any = $crashes | Select-Object -First 1
  return "crash: $($any.Name)"
}

function Show-Check {
  $bundles = (Get-Content (Join-Path $profileDir 'package.json') -Raw | ConvertFrom-Json).dsh.profile.bundles.Count
  $patchBytes = (Get-Item (Join-Path $profileDir 'cordis.patch.yml')).Length
  $raw = [System.IO.File]::ReadAllBytes((Join-Path $profileDir 'package.json'))
  $bom = $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF
  Write-GuardLog "check: bundles=$bundles patch=$patchBytes bytes bom=$bom backup_ok=$(Test-GoodBackup) running=$((Get-AppProcess).Count)"
}

switch ($Mode) {
  'snapshot' { Show-Check; Save-Good }
  'check'    { Show-Check }
  'watch'    {
    $since = Get-Date
    Write-GuardLog "watch: start (dryRun=$DryRun)"
    if (-not (Get-AppProcess)) { Start-App }
    Start-Sleep -Seconds 30
    $reason = Test-BootBroken $since
    if ($reason) {
      Write-GuardLog "watch: 检测到启动失败（$reason）"
      if (-not $DryRun) {
        Restore-Good
        Get-AppProcess | Stop-Process -Force
        Start-Sleep -Seconds 3
        Start-App
        Start-Sleep -Seconds 20
      }
      $after = Test-BootBroken (Get-Date).AddSeconds(-25)
      if ($after) { Write-GuardLog "watch: 还原后仍异常（$after），需要人工" } else { Write-GuardLog 'watch: 还原后启动正常' }
    } else {
      Write-GuardLog "watch: 无新崩溃日志，运行中进程=$((Get-AppProcess).Count)"
      if (-not (Test-GoodBackup)) { Save-Good } # 第一次跑起来顺手存一份可用状态
    }
    Write-GuardLog 'watch: done'
  }
}
