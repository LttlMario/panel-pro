import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const files = {
  registry: read('supabase/migrations/20260929000100_discord_delivery_registry.sql'),
  wheel: read('supabase/functions/wheel-timer/index.ts'),
  delivery: read('supabase/functions/_shared/discord-delivery.ts'),
  retry: read('supabase/functions/discord-delivery-retry/index.ts'),
  routes: read('supabase/functions/discord-route-health/index.ts'),
  interactions: read('supabase/functions/discord-interactions/index.ts'),
  admin: read('supabase/functions/manage-organizations/index.ts'),
  config: read('supabase/functions/manage-discord-config/index.ts'),
  pages: read('supabase/functions/manage-platform-pages/index.ts'),
  modules: read('supabase/functions/manage-panel-modules/index.ts'),
  workbench: read('js/platform-assistant-workbench.js'),
  moduleUi: read('js/administrare-module.js'),
  adminUi: read('js/platform-organization-admin.js'),
  workflow: read('.github/workflows/panel-check.yml'),
};

const checks = [
  ['registru unic Discord', files.registry, ['discord_message_registry', 'discord_delivery_attempts', 'discord_embed_versions']],
  ['coadă retry Discord', `${files.registry}\n${files.retry}\n${files.delivery}`, ['discord_delivery_queue', 'permanentlyFailed', 'retry-discord-delivery']],
  ['monitorizare cron', `${files.registry}\n${files.config}`, ['get_panel_automation_health', 'discord_delivery_retry', 'discord_route_health']],
  ['teste expirare și permisiuni', `${files.pages}\n${files.wheel}\n${files.workflow}`, ['recurrenceActive', 'approval_required', 'notification_claimed_at']],
  ['închidere pontaj server-side', read('supabase/functions/close-expired-shifts/index.ts'), ['update({', "status: 'auto_completed'", 'log_pontaj']],
  ['protecție embeduri duplicate', files.delivery, ['messageKey', 'messageIdsOnly', 'nu creăm un mesaj nou']],
  ['mesaje Discord șterse', `${files.delivery}\n${files.retry}\n${files.admin}`, ['response.status === 404', 'recreate', 'delivery_repair_missing']],
  ['verificare rute Discord', `${files.routes}\n${files.admin}\n${files.config}`, ['last_discord_check_status', 'delivery_verify_all', 'discord_channel_routes']],
  ['istoric erori', `${files.delivery}\n${files.registry}\n${files.admin}`, ['discord_delivery_attempts', 'error_message', 'delivery_health']],
  ['resincronizare module', `${files.admin}\n${files.adminUi}`, ['delivery_requeue', 'delivery_repair_missing', 'Verifică embedurile']],
  ['health organizație', `${files.admin}\n${files.adminUi}`, ['discordDeliveryHealth', 'health_check', 'discordDelivery']],
  ['verifică toate embedurile', `${files.admin}\n${files.adminUi}`, ['delivery_verify_all', 'Verifică embedurile']],
  ['repară mesaje lipsă', `${files.admin}\n${files.adminUi}`, ['delivery_repair_missing', 'Repară mesajele lipsă']],
  ['ultimul mesaj pe rută', `${files.admin}\n${files.delivery}`, ['last_delivered_at', 'message_id']],
  ['canale șterse sau redenumite', files.routes, ["overall = !entries.length ? 'missing'", 'channel_id']],
  ['preview înainte de publicare', files.workbench, ['preview-live-shell', 'data-preview-open-route', 'confirmDraft']],
  ['draft și publicare', `${files.pages}\n${files.workbench}`, ["publication:'draft'", "publication:'published'", "action === 'set_page_state'"]],
  ['istoric versiuni embeduri', `${files.modules}\n${files.pages}\n${files.moduleUi}`, ['platform_content_versions', 'publication_history', 'Istoric']],
  ['restaurare versiune', `${files.pages}\n${files.workbench}\n${files.moduleUi}`, ['restore_page', 'restore_module', 'Restaurarea']],
  ['jurnal modificări', `${files.pages}\n${files.modules}\n${files.admin}`, ['admin_audit_log', 'actor_discord_id', 'created_at']],
  ['șabloane reutilizabile', files.workbench, ['templateLibrary', 'readCustomTemplates', 'Salvează ca șablon']],
  ['blocuri predefinite', files.workbench, ['calculator', 'gallery', 'form', 'timeline', 'table', 'cards']],
  ['legare pagină de rută Discord', `${files.modules}\n${files.interactions}\n${files.moduleUi}`, ['embed_channel_id', 'result_channel_id', 'module_key']],
  ['generare embed din definiție', `${files.modules}\n${files.interactions}\n${files.moduleUi}`, ['definition', 'payload(module)', 'payload']],
  ['reguli vizuale separate', `${files.workbench}\n${files.interactions}\n${files.moduleUi}`, ['visual', 'color:', 'theme']],
  ['audiență pe secțiune', `${files.pages}\n${files.workbench}`, ['audience', 'organization_ids', 'role_ids', 'user_ids']],
  ['validare formulare', `${files.pages}\n${files.workbench}`, ['validate()', 'form_schema', 'submit_form']],
  ['preview desktop mobil Discord', `${files.workbench}\n${files.moduleUi}`, ['previewMode', 'mobile', 'Discord']],
  ['publicare web și Discord', `${files.modules}\n${files.moduleUi}\n${files.interactions}`, ["action === 'publish'", 'embed_channel_id', "status: action === 'save_publication' ? 'draft' : 'published'"]],
  ['duplicare pagină', files.workbench, ['duplicateCurrentDraft', 'data-page-clone', 'uniquePageSlug']],
  ['import export', `${files.workbench}\n${files.moduleUi}`, ['platform-page-import', 'platform-page-export', 'data-module-import', 'data-module-export']],
  ['arhivare', `${files.pages}\n${files.workbench}\n${files.moduleUi}`, ["publication:'archived'", 'Arhivează', "enabled: publication !== 'archived'"]],
  ['programare publicare', `${files.pages}\n${files.workbench}`, ['publish_at', 'scheduled', 'Publicare programată']],
  ['publicare condiționată de pachet', `${files.interactions}\n${files.pages}`, ['organization_package', 'resolvePackageFeatures', 'packageFeatures']],
  ['permisiuni pe buton', `${files.pages}\n${files.interactions}\n${files.workbench}`, ['permissions', 'allowed_role_ids', 'custom_id']],
];

const failures = [];
for (const [name, content, needles] of checks) {
  for (const needle of needles) if (!content.includes(needle)) failures.push(`${name}: lipsește ${needle}`);
}
if (failures.length) {
  console.error(`Auditul celor 35 de upgrade-uri a eșuat (${failures.length} constatări):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Auditul celor 35 de upgrade-uri a trecut (${checks.length} cerințe).`);
