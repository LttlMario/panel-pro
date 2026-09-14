import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const checks = [
  ['administrare-module.html', 'platform-assistant-workbench', 'constructorul de pagini există'],
  ['administrare-module.html', 'data-platform-mode="module"', 'constructorul Discord rămâne separat'],
  ['administrare-module.html', 'platform-page-manager', 'administratorul de pagini există'],
  ['js/platform-assistant-workbench.js', 'save_page', 'salvarea paginii este conectată'],
  ['js/platform-assistant-workbench.js', 'set_page_state', 'publicarea și arhivarea sunt conectate'],
  ['js/platform-assistant-workbench.js', 'data-block-index', 'editorul de blocuri există'],
  ['js/platform-assistant-workbench.js', 'intentFrom', 'asistentul detectează intenția'],
  ['js/platform-assistant-workbench.js', 'preferencesKey', 'preferințele asistentului sunt memorate'],
  ['js/platform-assistant-workbench.js', "type:'form'", 'constructorul poate genera formulare'],
  ['js/platform-assistant-workbench.js', "type:'gallery'", 'constructorul poate genera galerii'],
  ['js/platform-assistant-workbench.js', "type:'timeline'", 'constructorul poate genera timeline'],
  ['js/platform-assistant-workbench.js', "type:'calculator'", 'constructorul poate genera calculatoare'],
  ['js/platform-assistant-workbench.js', 'const undo', 'editorul are undo'],
  ['js/platform-assistant-workbench.js', 'const redo', 'editorul are redo'],
  ['js/platform-assistant-workbench.js', 'reusableKey', 'blocurile reutilizabile sunt memorate'],
  ['supabase/functions/manage-platform-pages/index.ts', "'accordion'", 'backendul acceptă blocuri avansate'],
  ['js/platform-assistant-workbench.js', 'platform-page-publish-at', 'editorul are programare și expirare'],
  ['supabase/functions/manage-platform-pages/index.ts', 'publish_at', 'backendul filtrează publicarea programată'],
  ['js/platform-assistant-workbench.js', 'link invalid la blocul', 'verificarea pre-publicare validează conținutul'],
  ['js/platform-assistant-workbench.js', 'previewAudience', 'preview-ul poate simula audiențe'],
  ['js/custom-page.js', 'data-calculator-field', 'pagina publicată redă calculatorul'],
  ['js/custom-page.js', 'data-page-form', 'pagina publicată redă formularele'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPageHref', 'linkurile cardurilor sunt curățate server-side'],
  ['js/platform-assistant-workbench.js', 'previewMode', 'preview desktop/mobil există'],
  ['administrare-module.html', 'preview-live-frame.tablet', 'preview tabletă există'],
  ['js/platform-assistant-workbench.js', 'panel_custom_page_published', 'sincronizarea între taburi există'],
  ['js/custom-page.js', 'action:listAction', 'pagina publicată folosește ruta de citire corectă'],
  ['organizatii.html', 'refreshCustomOrganizationPages', 'organizatii.html poate reîncărca selectorii'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'public_list'", 'lista publică este disponibilă'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'set_page_state'", 'starea de publicare este controlată server-side'],
  ['supabase/functions/manage-organizations/index.ts', 'platform_custom_pages', 'permisiunile acceptă pagini custom'],
  ['tools/validate-panel.mjs', 'function walk', 'validatorul general este disponibil']
];

const failures = [];
for (const [file, marker, description] of checks) {
  const content = read(file);
  if (!content.includes(marker)) failures.push(`${file}: ${description}`);
}
if (failures.length) {
  console.error('Page Studio validation failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Page Studio validation passed (${checks.length} checks).`);
