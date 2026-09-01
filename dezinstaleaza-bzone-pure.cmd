@echo off
setlocal EnableExtensions

set "INSTALL_DIR=%LocalAppData%\BZonePureLauncher"
set "PROTOCOL_KEY=HKCU\Software\Classes\bzonepure"
set "SELF=%~f0"

rem Remove only the files and registry key created by B-Zone Pure Mode 1.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$key='Registry::'+$env:PROTOCOL_KEY; Remove-Item -LiteralPath $key -Recurse -Force -ErrorAction SilentlyContinue; $dir=$env:INSTALL_DIR; Remove-Item -LiteralPath (Join-Path $dir 'B-Zone Pure Mode 1.lnk') -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue; $a=[char]0x0103; $m='Launcherul B-Zone Pure Mode 1 a fost dezinstalat. '+$a+'ncearc'+$a+' din nou conectarea normal'+$a+' din Dashboard.'; Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show($m, 'B-Zone Pure Mode 1', 'OK', 'Information')" >nul 2>&1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$desktop=[Environment]::GetFolderPath('Desktop'); if ($desktop) { Remove-Item -LiteralPath (Join-Path $desktop 'B-Zone Pure Mode 1.lnk') -Force -ErrorAction SilentlyContinue }" >nul 2>&1

rem Delete this downloaded helper after it finishes.
del /f /q "%SELF%" >nul 2>&1
exit /b 0
