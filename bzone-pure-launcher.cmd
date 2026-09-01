@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SERVER=cfx.re/join/zjv8ko4"
set "INSTALL_DIR=%LocalAppData%\BZonePureLauncher"
set "INSTALLED_LAUNCHER=%INSTALL_DIR%\bzone-pure-launcher.cmd"
set "PROTOCOL_KEY=HKCU\Software\Classes\bzonepure"
set "FROM_DOWNLOADED_FILE=0"

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
exit /b %errorlevel%
