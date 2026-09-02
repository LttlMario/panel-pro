param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef,

    [Parameter(Mandatory = $true)]
    [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$resolvedEnvFile = (Resolve-Path -LiteralPath $EnvFile).Path

Write-Host 'Se aplică secretele Edge Functions...'
supabase secrets set --project-ref $ProjectRef --env-file $resolvedEnvFile
Write-Host 'Secretele au fost aplicate. Șterge sau păstrează în siguranță fișierul completat.'
