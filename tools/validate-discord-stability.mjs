import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['central Discord registry migration', read('supabase/migrations/20260929000100_discord_delivery_registry.sql'), [
    'CREATE TABLE IF NOT EXISTS public.discord_message_registry',
    'CREATE TABLE IF NOT EXISTS public.discord_delivery_attempts',
    'CREATE TABLE IF NOT EXISTS public.discord_delivery_queue',
    'CREATE TABLE IF NOT EXISTS public.discord_embed_versions',
    'discord_delivery_queue_one_open_per_message_idx',
    'retry-discord-delivery',
    'check-discord-routes',
    'process-wheel-timers',
    'invoke-weekly-contract-export',
    'invoke-weekly-action-report',
    'invoke-organization-event-reminders',
    'invoke-close-expired-shifts',
    'GRANT USAGE, SELECT ON SEQUENCE public.discord_embed_versions_id_seq TO service_role',
  ]],
  ['delivery recorder', read('supabase/functions/_shared/discord-delivery.ts'), [
    'export async function recordDiscordDeliveryEvent',
    "from('discord_delivery_attempts')",
    "from('discord_delivery_queue')",
    'if (!response.ok && response.status === 404 && attemptedMessageId)',
    'nu creăm un mesaj nou',
  ]],
  ['delivery retry worker', read('supabase/functions/discord-delivery-retry/index.ts'), [
    "eq('status', 'pending')",
    "status: 'processing'",
    'recordDiscordDeliveryEvent',
    'permanentlyFailed',
  ]],
  ['route health worker', read('supabase/functions/discord-route-health/index.ts'), [
    'x-cron-secret',
    'last_discord_check_status',
    'discord_channel_routes',
  ]],
  ['wheel legacy compatibility', read('supabase/functions/discord-interactions/index.ts'), [
    'wheel_timer',
    'event_reminders',
    'log_event_reminders',
    'Acest canal nu este configurat pentru embedul Roată.',
  ]],
  ['wheel single notification delivery', `${read('supabase/functions/wheel-timer/index.ts')}\n${read('supabase/migrations/20260929000200_wheel_timer_single_delivery.sql')}`, [
    'notification_claimed_at',
    'notification_next_attempt_at',
    "notification_attempts || 0) >= 3",
    "notification_claimed_at.lt",
    'wheel_timer_id: timer.id',
  ]],
  ['admin delivery controls', read('supabase/functions/manage-organizations/index.ts'), [
    "body.action==='delivery_health'",
    "body.action==='delivery_requeue'",
    "body.action==='delivery_versions'",
    "body.action==='delivery_restore'",
    "body.action==='delivery_verify_all'",
    "body.action==='delivery_repair_missing'",
  ]],
  ['module publication history', read('supabase/functions/manage-panel-modules/index.ts'), [
    "action === 'publication_history'",
    'module_definition: module.definition',
  ]],
  ['module builder portability', read('js/administrare-module.js'), [
    'data-module-export',
    'data-module-import',
    'data-module-duplicate',
    "action:'save_module'",
  ]],
  ['deployment parity', `${read('supabase/config.toml')}\n${read('supabase/deploy-functions.ps1')}`, [
    'discord-delivery-retry',
    'discord-route-health',
  ]],
  ['page builder lifecycle', `${read('supabase/functions/manage-platform-pages/index.ts')}\n${read('js/platform-assistant-workbench.js')}`, [
    "action === 'save_page'",
    "action === 'history'",
    "action === 'restore_page'",
    "action === 'restore_module'",
    "action === 'set_page_state'",
    "action === 'list_submissions'",
    'publish_at',
    'expires_at',
    'recurrence_until',
    'approval_required',
    'organization_ids',
    'role_ids',
    'preview_token',
    'duplicateCurrentDraft',
    'applyBulkState',
    'data-page-history',
  ]],
  ['page builder portability and preview', read('js/platform-assistant-workbench.js'), [
    'platform-page-import',
    'platform-page-export',
    'data-preview-open-route',
    'data-responsive-preset',
    'previewAudience',
    'Ctrl+K',
    'Ctrl+S',
  ]],
];

const failures = [];
for (const [name, content, needles] of checks) {
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${name}: lipsește ${needle}`);
  }
}

if (failures.length) {
  console.error('Validarea de stabilitate Discord a eșuat:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validarea de stabilitate Discord a trecut (${checks.length} contracte).`);
