# 安装 / 卸载 DSH 崩溃自愈守卫
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File install-guard.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File install-guard.ps1 -Uninstall
#
# 为什么不用计划任务：`schtasks /Create /SC ONLOGON` 要管理员权限，实测被拒（Access is denied）。
# 改成「启动」文件夹里放一个隐藏启动器，等效、免提权，而且能在
# Windows「设置 → 应用 → 启动」里看到并随时关掉。
#
# 落地物（全部在 ASCII 路径下，避免中文路径在 cmd/vbs 里被编码搞坏）：
#   %LOCALAPPDATA%\dsh-guard\crash-guard.ps1   守卫本体（从仓库复制）
#   %LOCALAPPDATA%\dsh-guard\start.cmd         隐藏窗口调用守卫
#   %APPDATA%\...\Startup\DSH 崩溃自愈.vbs      开机拉起 start.cmd
#
# 内存：不开机常驻。登录时跑一次，约 30 秒后自己退出（实测 22:03:11 → 22:03:41）。
param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$state = Join-Path $env:LOCALAPPDATA 'dsh-guard'
$guard = Join-Path $PSScriptRoot 'crash-guard.ps1'
$startup = [Environment]::GetFolderPath('Startup')
$vbs = Join-Path $startup 'DSH 崩溃自愈.vbs'

if ($Uninstall) {
  if (Test-Path $vbs) { Remove-Item $vbs -Force; Write-Host "已移除开机启动：$vbs" }
  schtasks /Delete /TN 'DSH 崩溃自愈' /F 2>$null | Out-Null
  Write-Host '守卫已停用（备与日志保留在 %LOCALAPPDATA%\dsh-guard）'
  exit 0
}

if (-not (Test-Path $guard)) { throw "找不到 $guard" }
New-Item -ItemType Directory -Force -Path $state | Out-Null

Copy-Item $guard (Join-Path $state 'crash-guard.ps1') -Force

$cmdBody = "@echo off`r`npowershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"%~dp0crash-guard.ps1`" -Mode watch`r`n"
[System.IO.File]::WriteAllText((Join-Path $state 'start.cmd'), $cmdBody, [System.Text.Encoding]::ASCII)

$vbsBody = "' DSH crash guard launcher`r`nSet sh = CreateObject(""WScript.Shell"")`r`nsh.Run sh.ExpandEnvironmentStrings(""%LOCALAPPDATA%\dsh-guard\start.cmd""), 0, False`r`n"
[System.IO.File]::WriteAllText($vbs, $vbsBody, [System.Text.Encoding]::ASCII)

# 现在能开，就先存一份「可用状态」，守卫还原时用它
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $state 'crash-guard.ps1') -Mode snapshot

Write-Host "已安装：$vbs"
Write-Host '它出现在「设置 → 应用 → 启动」里，可随时关闭。'
Write-Host "日志：$state\guard.log"
Write-Host "可用状态备份：$state\good\"
