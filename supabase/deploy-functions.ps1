param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRef
)

$ErrorActionPreference = 'Stop'

$supabaseCommand = Get-Command supabase -ErrorAction SilentlyContinue
function Invoke-SupabaseCli {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    if ($supabaseCommand) {
        & $supabaseCommand.Source @Arguments
    } else {
        & npx.cmd --yes supabase@latest @Arguments
    }
    if ($LASTEXITCODE -ne 0) { throw "Comanda Supabase CLI a eșuat (cod $LASTEXITCODE)." }
}

Write-Host "Proiect Supabase selectat: $ProjectRef"

Write-Host 'Se publică funcțiile Edge...'
$functions = @(
    'sync-discord-role',
    'manage-discord-config',
    'manage-community-posts',
    'send-discord-notification',
    'close-expired-shifts',
    'manage-admin-center',
    'manage-organizations'
)

foreach ($functionName in $functions) {
    Write-Host "Deploy: $functionName"
    Invoke-SupabaseCli functions deploy $functionName --project-ref $ProjectRef --no-verify-jwt --use-api
}

Write-Host 'Funcțiile au fost publicate. Configurează acum secretele din Supabase Dashboard.'
