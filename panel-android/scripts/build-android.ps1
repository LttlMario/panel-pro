param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Debug'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bundledJdk = Join-Path $projectRoot '.tools\jdk21'
$jdkRoot = if (Test-Path -LiteralPath $bundledJdk) {
    Get-ChildItem -LiteralPath $bundledJdk -Directory |
        Select-Object -First 1 -ExpandProperty FullName
} elseif ($env:JAVA_HOME -and (Test-Path -LiteralPath $env:JAVA_HOME)) {
    $env:JAVA_HOME
} else {
    Get-ChildItem -LiteralPath 'C:\Program Files\Microsoft' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not $jdkRoot) {
    throw 'JDK 21 lipsește din .tools\jdk21. Instalează JDK 21 sau setează JAVA_HOME.'
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

$gradle = Join-Path $projectRoot 'android\gradlew.bat'
$task = if ($Configuration -eq 'Release') { 'bundleRelease' } else { 'assembleDebug' }

$restoredKeystore = $false
$temporaryKeystore = Join-Path $projectRoot 'android\.release-signing.jks'
if ($Configuration -eq 'Release' -and $env:PANEL_RELEASE_KEYSTORE_BASE64 -and -not $env:PANEL_RELEASE_KEYSTORE) {
    [IO.File]::WriteAllBytes($temporaryKeystore, [Convert]::FromBase64String($env:PANEL_RELEASE_KEYSTORE_BASE64))
    $env:PANEL_RELEASE_KEYSTORE = $temporaryKeystore
    $restoredKeystore = $true
}

try {
    & $gradle -p (Join-Path $projectRoot 'android') $task
    if ($LASTEXITCODE -ne 0) {
        throw "Compilarea Android a eșuat cu codul $LASTEXITCODE."
    }
} finally {
    if ($restoredKeystore -and (Test-Path -LiteralPath $temporaryKeystore)) {
        Remove-Item -LiteralPath $temporaryKeystore -Force -ErrorAction SilentlyContinue
    }
}
