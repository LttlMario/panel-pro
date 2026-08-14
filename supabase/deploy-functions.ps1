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
    'send-weekly-shift-report',
    'manage-admin-center',
    'manage-organizations',
    'manage-owned-organization',
    'status-live-sync',
    'create-voucher-organization',
    'get-organization-status',
    'finalize-organization',
    'manage-draft-organization',
    'discover-draft-roles',
    'save-draft-roles',
    'touch-panel-session',
    'mark-tutorial-read',
    'link-discord-account',
    'link-email-discord-guild',
    'list-email-discord-guilds',
    'manage-email-account',
    'update-user-account-settings',
    'username-login'
)

foreach ($functionName in $functions) {
    Write-Host "Deploy: $functionName"
    Invoke-SupabaseCli functions deploy $functionName --project-ref $ProjectRef --use-api
}

Write-Host 'Funcțiile au fost publicate. Configurează acum secretele din Supabase Dashboard.'
