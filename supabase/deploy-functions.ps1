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
    'discord-interactions',
    'discover-discord-channels',
    'manage-community-posts',
    'manage-public-feedback',
    'manage-stash',
    'send-discord-notification',
    'close-expired-shifts',
    'send-weekly-shift-report',
    'send-weekly-contract-export',
    'send-weekly-action-report',
    'send-organization-expiry-notifications',
    'send-organization-event-reminders',
    'manage-organization-events',
    'manage-admin-center',
    'manage-platform-secrets',
    'manage-platform-settings',
    'manage-organizations',
    'manage-owned-organization',
    'manage-contracts',
    'redeem-organization-voucher',
    'status-live-sync',
    'fivem-status',
    'assistant-live',
    'assistant-feedback',
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
    'manage-discord-account',
    'update-user-account-settings',
    'username-login'
)

foreach ($functionName in $functions) {
    Write-Host "Deploy: $functionName"
    Invoke-SupabaseCli functions deploy $functionName --project-ref $ProjectRef --use-api
}

Write-Host 'Funcțiile au fost publicate. Configurează acum secretele din Supabase Dashboard.'
