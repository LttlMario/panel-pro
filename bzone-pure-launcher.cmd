@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SERVER=cfx.re/join/zjv8ko4"
set "INSTALL_DIR=%LocalAppData%\BZonePureLauncher"
set "INSTALLED_LAUNCHER=%INSTALL_DIR%\bzone-pure-launcher.cmd"
set "PROTOCOL_KEY=HKCU\Software\Classes\bzonepure"
set "FROM_DOWNLOADED_FILE=0"

rem The Dashboard can request a safe uninstall through the local protocol.
if /I "%~1"=="bzonepure://uninstall" goto :uninstall
if /I "%~1"=="uninstall" goto :uninstall

rem The downloaded file is only the installer. It never starts FiveM.
if /I not "%~f0"=="%INSTALLED_LAUNCHER%" set "FROM_DOWNLOADED_FILE=1"

if /I not "%~f0"=="%INSTALLED_LAUNCHER%" (
    if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1
    copy /Y "%~f0" "%INSTALLED_LAUNCHER%" >nul 2>&1
)

if exist "%INSTALLED_LAUNCHER%" (
    set "HANDLER=%INSTALLED_LAUNCHER%"
) else (
    set "HANDLER=%~f0"
)

rem Register the local protocol used by the Dashboard button.
reg add "%PROTOCOL_KEY%" /ve /d "URL:B-Zone Pure Mode Launcher" /f >nul 2>&1
reg add "%PROTOCOL_KEY%" /v "URL Protocol" /d "" /f >nul 2>&1
reg add "%PROTOCOL_KEY%\shell\open\command" /ve /d "\"%HANDLER%\" \"%%1\"" /f >nul 2>&1

if "%FROM_DOWNLOADED_FILE%"=="1" (
    rem Create the desktop shortcut during installation when FiveM is already present.
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$relative=@('FiveM\FiveM.exe','FiveM\FiveM.app\FiveM.exe','FiveM.app\FiveM.exe'); $roots=@($env:LOCALAPPDATA,$env:APPDATA,$env:PROGRAMFILES,$env:USERPROFILE) | Where-Object { $_ }; $found=$null; foreach ($root in $roots) { foreach ($item in $relative) { $candidate=Join-Path $root $item; if (Test-Path -LiteralPath $candidate -PathType Leaf) { $found=Get-Item -LiteralPath $candidate; break } }; if ($found) { break } }; if (-not $found) { $driveRoots=@(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Z]:\\$' } | Select-Object -ExpandProperty Root); foreach ($root in $driveRoots) { $found=Get-ChildItem -LiteralPath $root -Filter 'FiveM.exe' -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '\\FiveM(\.app)?\\FiveM\.exe$' } | Sort-Object @{Expression={ if ($_.FullName -match '\\FiveM\\FiveM\.exe$') { 0 } else { 1 } }} | Select-Object -First 1; if ($found) { break } } }; if ($found) { $targets=@(Join-Path $env:LOCALAPPDATA 'BZonePureLauncher\B-Zone Pure Mode 1.lnk'); $desktop=[Environment]::GetFolderPath('Desktop'); if ($desktop) { $targets += Join-Path $desktop 'B-Zone Pure Mode 1.lnk' }; $shell=New-Object -ComObject WScript.Shell; foreach ($target in $targets) { $parent=Split-Path $target -Parent; New-Item -ItemType Directory -Path $parent -Force | Out-Null; $shortcut=$shell.CreateShortcut($target); $shortcut.TargetPath=$found.FullName; $shortcut.Arguments='-pure_1 +connect cfx.re/join/zjv8ko4'; $shortcut.WorkingDirectory=$found.DirectoryName; $shortcut.IconLocation=($found.FullName+',0'); $shortcut.Description='B-Zone - FiveM Pure Mode 1'; $shortcut.Save() } }" >nul 2>&1
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$I=[char]0x00ce; $i=[char]0x00ee; $a=[char]0x0103; $s=[char]0x0219; $m='Launcherul B-Zone Pure Mode 1 a fost instalat. '+$I+'nchide FiveM complet, apoi revino '+$i+'n Panel '+$s+'i apas'+$a+'. Intr'+$a+' pe B-Zone pentru conectarea cu Pure 1.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Information')" >nul 2>&1
    exit /b 0
)

rem Pure Mode is applied at startup. Do not take over an existing FiveM instance.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -like 'FiveM*' }).Count -gt 0) { exit 1 } else { exit 0 }" >nul 2>&1
if errorlevel 1 (
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$I=[char]0x00ce; $i=[char]0x00ee; $a=[char]0x0103; $s=[char]0x0219; $m='FiveM este deja pornit pe Pure 0. '+$I+'nchide FiveM complet '+$s+'i apas'+$a+' din nou Intr'+$a+' pe B-Zone pentru a porni direct cu Pure 1.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Warning')" >nul 2>&1
    exit /b 0
)

rem Find FiveM, create a Windows shortcut with Pure 1 and direct server connect, then launch the shortcut via Explorer.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$relative=@('FiveM\FiveM.exe','FiveM\FiveM.app\FiveM.exe','FiveM.app\FiveM.exe'); $roots=@($env:LOCALAPPDATA,$env:APPDATA,$env:PROGRAMFILES,$env:USERPROFILE) | Where-Object { $_ }; $found=$null; foreach ($root in $roots) { foreach ($item in $relative) { $candidate=Join-Path $root $item; if (Test-Path -LiteralPath $candidate -PathType Leaf) { $found=Get-Item -LiteralPath $candidate; break } }; if ($found) { break } }; if (-not $found) { $driveRoots=@(Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root -match '^[A-Z]:\\$' } | Select-Object -ExpandProperty Root); foreach ($root in $driveRoots) { $found=Get-ChildItem -LiteralPath $root -Filter 'FiveM.exe' -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match '\\FiveM(\.app)?\\FiveM\.exe$' } | Sort-Object @{Expression={ if ($_.FullName -match '\\FiveM\\FiveM\.exe$') { 0 } else { 1 } }} | Select-Object -First 1; if ($found) { break } } }; if ($found) { try { $link=Join-Path $env:LOCALAPPDATA 'BZonePureLauncher\B-Zone Pure Mode 1.lnk'; $shell=New-Object -ComObject WScript.Shell; $shortcut=$shell.CreateShortcut($link); $shortcut.TargetPath=$found.FullName; $shortcut.Arguments='-pure_1 +connect cfx.re/join/zjv8ko4'; $shortcut.WorkingDirectory=$found.DirectoryName; $shortcut.Description='B-Zone - FiveM Pure Mode 1'; $shortcut.Save(); if (-not (Test-Path -LiteralPath $link -PathType Leaf)) { throw 'shortcut-not-created' }; Start-Process -FilePath 'explorer.exe' -ArgumentList @($link) -ErrorAction Stop; exit 0 } catch { $m='FiveM nu a putut fi pornit prin launcherul Pure 1. Verific'+([char]0x0103)+' instalarea FiveM.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Error'); exit 1 } }; $a=[char]0x0103; $i=[char]0x00ee; $s=[char]0x0219; $t=[char]0x021b; $m='FiveM nu a fost g'+$a+'sit. Am c'+$a+'utat '+$i+'n loca'+$t+'iile uzuale '+$s+'i pe discurile locale. Verific'+$a+' instalarea FiveM, apoi '+$i+'ncearc'+$a+' din nou.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Warning'); exit 1" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$source=Join-Path $env:LOCALAPPDATA 'BZonePureLauncher\B-Zone Pure Mode 1.lnk'; if (Test-Path -LiteralPath $source -PathType Leaf) { $desktop=[Environment]::GetFolderPath('Desktop'); if ($desktop) { Copy-Item -LiteralPath $source -Destination (Join-Path $desktop 'B-Zone Pure Mode 1.lnk') -Force } }" >nul 2>&1
exit /b %errorlevel%

:uninstall
rem Only the installed copy may remove the launcher installation.
if /I not "%~f0"=="%INSTALLED_LAUNCHER%" exit /b 0
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$key='Registry::'+$env:PROTOCOL_KEY; Remove-Item -LiteralPath $key -Recurse -Force -ErrorAction SilentlyContinue; $dir=$env:INSTALL_DIR; Remove-Item -LiteralPath (Join-Path $dir 'B-Zone Pure Mode 1.lnk') -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue; $a=[char]0x0103; $m='Launcherul B-Zone Pure Mode 1 a fost dezinstalat. '+$a+'ncearc'+$a+' din nou conectarea normal'+$a+' din Dashboard.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Information')" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); if ($desktop) { Remove-Item -LiteralPath (Join-Path $desktop 'B-Zone Pure Mode 1.lnk') -Force -ErrorAction SilentlyContinue }" >nul 2>&1
exit /b 0
