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
  ['js/platform-assistant-workbench.js', 'data-studio-suggestions', 'asistentul oferă sugestii rapide după generare'],
  ['js/platform-assistant-workbench.js', 'data-full-accessibility-audit', 'constructorul are audit accesibilitate complet'],
  ['js/platform-assistant-workbench.js', 'autoFixAccessibility', 'constructorul poate repara probleme simple de accesibilitate'],
  ['js/platform-assistant-workbench.js', 'accessibilityAutofix', 'repararea accesibilității este disponibilă direct în acțiuni'],
  ['js/platform-assistant-workbench.js', 'updateDraftProgress', 'constructorul afișează progresul de pregătire al paginii'],
  ['js/platform-assistant-workbench.js', "let node=actions.querySelector('[data-draft-progress]')", 'progresul draftului se recalculează în aceeași zonă'],
  ['js/platform-assistant-workbench.js', 'if(node.innerHTML!==html)node.innerHTML=html', 'actualizarea progresului evită buclele DOM'],
  ['js/platform-assistant-workbench.js', "state.draft.content.settings.access='public';state.syncState='local'", 'acțiunea rapidă publică marchează draftul local'],
  ['js/platform-assistant-workbench.js', "audience=settings.audience||{}", 'validarea verifică audiența draftului'],
  ['js/platform-assistant-workbench.js', "categoria este invalidă", 'importurile nu pot trece cu categorie neacceptată'],
  ['js/platform-assistant-workbench.js', "tema este invalidă", 'importurile nu pot trece cu temă neacceptată'],
  ['js/platform-assistant-workbench.js', "state.draft.sort_order=Math.min(9999,Math.max(0,Number(node.value)||0));state.syncState='local'", 'ordinea în meniu marchează draftul local'],
  ['js/platform-assistant-workbench.js', "state.draft.content.settings.preview_token=previewToken();state.syncState='local'", 'tokenul privat marchează draftul local'],
  ['js/platform-assistant-workbench.js', "settings.seo={...seo,title,description,noindex:seo.noindex===true};state.syncState='local'", 'repararea SEO marchează draftul local'],
  ['js/platform-assistant-workbench.js', 'if(!changed)return false;markDraftChanged()', 'editarea avansată prin asistent marchează draftul local'],
  ['js/platform-assistant-workbench.js', 'const markDraftChanged', 'modificările resetează aprobarea după editare'],
  ['js/platform-assistant-workbench.js', "state.syncState='synced'; manager.hidden=true", 'editarea unei pagini existente pornește sincronizată'],
  ['js/platform-assistant-workbench.js', "type:state.publishNow===true?'published':'saved'", 'salvările comunică actualizări între ferestre'],
  ['js/platform-assistant-workbench.js', "['published','saved'].includes(event?.data?.type)", 'constructorul reacționează la drafturi salvate extern'],
  ['js/platform-assistant-workbench.js', "draft.content.blocks.pop();state.syncState='local'", 'editarea conversațională marchează draftul local'],
  ['js/platform-assistant-workbench.js', 'data-draft-progress', 'progresul draftului este accesibil și actualizat automat'],
  ['js/platform-assistant-workbench.js', 'ensureDraftTransfer', 'constructorul poate exporta și importa draftul curent'],
  ['js/platform-assistant-workbench.js', 'data-draft-export', 'exportul draftului este disponibil în confirmare'],
  ['js/platform-assistant-workbench.js', 'ensureBulkExport', 'managerul poate exporta paginile selectate'],
  ['js/platform-assistant-workbench.js', 'data-bulk-export', 'exportul selectiv este disponibil în manager'],
  ['js/platform-assistant-workbench.js', 'enhanceAdditionalBlockInspector', 'inspectorul blocurilor are câmpuri simplificate pentru tabele și indicatori'],
  ['js/platform-assistant-workbench.js', 'data-friendly-advanced', 'inspectorul avansat are editare prietenoasă pentru blocuri numerice'],
  ['js/platform-assistant-workbench.js', 'sanitizeInspectorLinks', 'inspectorul neutralizează linkurile nesigure'],
  ['js/platform-assistant-workbench.js', 'inspectorSafetyBound', 'protecția inspectorului nu leagă evenimentul de mai multe ori'],
  ['js/platform-assistant-workbench.js', 'showExtendedAudit', 'constructorul are audit extins al draftului'],
  ['js/platform-assistant-workbench.js', 'data-extended-audit-button', 'auditul extins este disponibil în confirmare'],
  ['js/platform-assistant-workbench.js', 'extendedAuditExportObserver', 'auditul extins poate fi exportat local'],
  ['js/platform-assistant-workbench.js', 'data-extended-audit-export', 'exportul raportului de audit are control dedicat'],
  ['js/platform-assistant-workbench.js', 'draftTransferCopyObserver', 'draftul poate fi copiat direct în clipboard'],
  ['js/platform-assistant-workbench.js', 'data-draft-copy', 'copierea JSON-ului are control dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureQuickEditActions', 'constructorul oferă ajustări rapide în confirmare'],
  ['js/platform-assistant-workbench.js', 'data-quick-edit-actions', 'preseturile de editare rapidă sunt accesibile'],
  ['js/platform-assistant-workbench.js', 'ensureTemplateSearch', 'șabloanele pot fi căutate rapid'],
  ['js/platform-assistant-workbench.js', 'platform-template-search', 'căutarea șabloanelor are etichetă accesibilă'],
  ['js/platform-assistant-workbench.js', 'enhanceTemplateSearchControls', 'căutarea șabloanelor poate fi resetată rapid'],
  ['js/platform-assistant-workbench.js', 'templateSearchClear', 'resetarea căutării are control dedicat'],
  ['js/platform-assistant-workbench.js', "event.key.toLowerCase()==='e'", 'exportul draftului are scurtătură de tastatură'],
  ['js/platform-assistant-workbench.js', "event.key.toLowerCase()==='i'", 'importul draftului are scurtătură de tastatură'],
  ['js/platform-assistant-workbench.js', 'ensureShortcutHint', 'constructorul afișează scurtăturile disponibile'],
  ['js/platform-assistant-workbench.js', 'data-shortcut-hint', 'ajutorul pentru scurtături este identificabil'],
  ['js/platform-assistant-workbench.js', 'ensureTemplateSearchFeedback', 'căutarea șabloanelor afișează numărul de rezultate'],
  ['js/platform-assistant-workbench.js', 'templateSearchFeedback', 'căutarea șabloanelor comunică lipsa rezultatelor'],
  ['js/platform-assistant-workbench.js', 'bindLiveMetadataInputs', 'metadatele paginii actualizează preview-ul live'],
  ['js/platform-assistant-workbench.js', 'liveBound', 'actualizarea live nu leagă evenimentul de mai multe ori'],
  ['js/platform-assistant-workbench.js', 'ensureMenuOrderControl', 'constructorul permite ordonarea în meniul organizației'],
  ['js/platform-assistant-workbench.js', 'platform-page-sort-order', 'ordinea paginii are control dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureMenuOrderPresets', 'ordinea din meniu are preseturi rapide'],
  ['js/platform-assistant-workbench.js', 'menuOrderPreset', 'presetul de ordine este identificabil'],
  ['js/platform-assistant-workbench.js', 'previewPermissionSummaryObserver', 'preview-ul afișează rezumatul de acces'],
  ['js/platform-assistant-workbench.js', 'data-preview-permission-summary', 'rezumatul de acces din preview este identificabil'],
  ['js/platform-assistant-workbench.js', 'ensureAccessPresets', 'constructorul are preseturi rapide pentru acces'],
  ['js/platform-assistant-workbench.js', 'platform-page-access-presets', 'preseturile de acces au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureCategoryPresets', 'constructorul are preseturi rapide pentru categorie'],
  ['js/platform-assistant-workbench.js', 'platform-page-category-presets', 'preseturile de categorie au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureLayoutPresets', 'constructorul are preseturi rapide pentru layout'],
  ['js/platform-assistant-workbench.js', 'platform-page-layout-presets', 'preseturile de layout au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureThemePresets', 'constructorul are preseturi rapide pentru temă'],
  ['js/platform-assistant-workbench.js', 'platform-page-theme-presets', 'preseturile de temă au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureResponsivePresets', 'constructorul are preseturi rapide pentru responsive'],
  ['js/platform-assistant-workbench.js', 'platform-page-responsive-presets', 'preseturile responsive au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureDevicePresets', 'constructorul are preseturi rapide pentru dispozitiv'],
  ['js/platform-assistant-workbench.js', 'platform-page-device-presets', 'preseturile de dispozitiv au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureApprovalPresets', 'constructorul are preseturi rapide pentru aprobare'],
  ['js/platform-assistant-workbench.js', 'platform-page-approval-presets', 'preseturile de aprobare au container dedicat'],
  ['js/platform-assistant-workbench.js', 'ensureSchedulePresets', 'constructorul are preseturi rapide pentru programare'],
  ['js/platform-assistant-workbench.js', 'platform-page-schedule-presets', 'preseturile de programare au container dedicat'],
  ['supabase/functions/manage-platform-pages/index.ts', 'sort_order: Math.max(0, Math.min(9999', 'backendul limitează ordinea în meniu'],
  ['js/panel-layout.js', 'Number(a.sort_order||100)', 'navigația sortează paginile după ordinea configurată'],
  ['js/platform-assistant-workbench.js', 'autoFixDraftMetadata', 'datele de bază ale draftului pot fi completate automat'],
  ['js/platform-assistant-workbench.js', 'data-metadata-fix', 'repararea metadatelor este disponibilă în confirmare'],
  ['js/platform-assistant-workbench.js', 'autoFixSeoMetadata', 'datele SEO pot fi completate automat'],
  ['js/platform-assistant-workbench.js', 'data-seo-fix', 'completarea SEO este disponibilă în confirmare'],
  ['js/platform-assistant-workbench.js', 'preferencesKey', 'preferințele asistentului sunt memorate'],
  ['js/platform-assistant-workbench.js', 'memoryTtl', 'drafturile locale au expirare și versiune de memorie'],
  ['js/platform-assistant-workbench.js', 'new BroadcastChannel(\'panel-pro-pages\')', 'managerul se sincronizează live între taburi'],
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
  ['js/platform-assistant-workbench.js', 'Formular valid în preview', 'preview-ul poate testa formularele fără trimitere'],
  ['js/platform-assistant-workbench.js', 'querySelectorAll(\'input[type="number"]\')', 'preview-ul poate testa calculatoarele'],
  ['js/custom-page.js', 'data-calculator-field', 'pagina publicată redă calculatorul'],
  ['js/custom-page.js', 'data-page-form', 'pagina publicată redă formularele'],
  ['js/custom-page.js', "action:'submit_form'", 'formularele publicate trimit cereri reale'],
  ['js/custom-page.js', 'data-form-block-path', 'formularele grupate folosesc traseul corect'],
  ['js/custom-page.js', 'custom-page-honeypot', 'formularele au protecție anti-bot'],
  ['js/custom-page.js', 'custom-page-gallery', 'pagina publicată redă galeriile cu stil dedicat'],
  ['js/custom-page.js', "field.type==='textarea'", 'formularele publicate redau câmpuri textarea'],
  ['custom-page.html', 'custom-page-timeline li', 'timeline-ul publicat are stil responsive'],
  ['custom-page.html', 'custom-page-calculator output', 'calculatorul publicat are stil dedicat'],
  ['custom-page.html', 'viewport-fit=cover', 'pagina customă este pregătită pentru WebView și safe-area'],
  ['panel-ios/custom-page.html', 'viewport-fit=cover', 'varianta iOS include pagina customă pentru WebView'],
  ['panel-android/web-src/custom-page.html', 'viewport-fit=cover', 'varianta Android include pagina customă pentru WebView'],
  ['custom-page.html', 'prefers-reduced-motion', 'pagina publicată respectă preferința reduced motion'],
  ['administrare-module.html', 'prefers-reduced-motion', 'constructorul respectă preferința reduced motion'],
  ['custom-page.html', 'custom-page-honeypot', 'protecția anti-bot este ascunsă vizual'],
  ['js/platform-assistant-workbench.js', 'platform-page-accent', 'constructorul permite accent vizual'],
  ['js/platform-assistant-workbench.js', 'platform-page-spacing', 'constructorul permite spațiere vizuală'],
  ['js/platform-assistant-workbench.js', 'applyPreviewVisual', 'preview-ul aplică stilul vizual ales'],
  ['js/custom-page.js', 'visualStyle', 'pagina publicată aplică stilul vizual'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPageVisual', 'backendul validează stilul vizual'],
  ['js/platform-assistant-workbench.js', 'platform-page-seo-title', 'constructorul permite setări SEO'],
  ['js/custom-page.js', 'applySeo', 'pagina publicată aplică meta SEO'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPageSeo', 'backendul validează setările SEO'],
  ['supabase/functions/manage-platform-pages/index.ts', 'allowRequest', 'endpointul constructorului are rate-limit'],
  ['supabase/functions/manage-platform-pages/index.ts', 'pagePermissionAllows', 'backendul aplică permisiuni pe acțiunile de administrare'],
  ['supabase/functions/manage-platform-pages/index.ts', 'Conținutul conține markup sau cod nesigur', 'backendul scanează conținutul importat'],
  ['supabase/functions/manage-platform-pages/index.ts', 'Structura grupurilor este prea adâncă', 'backendul limitează adâncimea grupurilor'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'audit'", 'backendul expune auditul paginii'],
  ['js/platform-assistant-workbench.js', 'data-page-audit', 'managerul afișează auditul paginii'],
  ['supabase/functions/manage-platform-pages/index.ts', "body.publish === true ? 'publish'", 'publicarea folosește permisiunea publish'],
  ['js/platform-assistant-workbench.js', 'data-preview-token-generate', 'constructorul poate genera preview privat'],
  ['js/custom-page.js', 'preview_token', 'pagina publicată poate încărca preview privat'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPreviewToken', 'backendul validează tokenul de preview'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'health'", 'backendul expune starea paginii'],
  ['js/platform-assistant-workbench.js', 'data-page-health', 'managerul afișează starea paginii'],
  ['js/platform-assistant-workbench.js', 'historyEnhancer', 'managerul afișează istoricul versiunilor'],
  ['administrare-module.html', 'publication-test', 'constructorul Discord are testare de configurare'],
  ['js/administrare-module.js', "action:'test'", 'testarea Discord este conectată'],
  ['js/administrare-module.js', 'renderPublicationTestStatus', 'interfața afișează rezultatul testului Discord'],
  ['supabase/functions/manage-panel-modules/index.ts', "action === 'test'", 'backendul Discord are testare dry-run'],
  ['supabase/functions/manage-panel-modules/index.ts', 'channel_changed', 'testarea Discord detectează schimbarea canalului fără să promită editarea mesajului vechi'],
  ['supabase/functions/manage-panel-modules/index.ts', 'existingPublication?.message_id', 'publicarea Discord reutilizează mesajul existent'],
  ['supabase/functions/manage-panel-modules/index.ts', 'response.status === 404', 'republicarea creează mesaj nou doar după 404'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPageHref', 'linkurile cardurilor sunt curățate server-side'],
  ['supabase/functions/manage-platform-pages/index.ts', '(?!\\/)', 'sursele galeriei resping URL-urile protocol-relative'],
  ['js/platform-assistant-workbench.js', 'platform-page-pager', 'managerul are paginare'],
  ['js/platform-assistant-workbench.js', 'platform-page-sort', 'managerul are sortare'],
  ['js/platform-assistant-workbench.js', 'platform-page-category-filter', 'managerul poate filtra paginile după categorie'],
  ['js/platform-assistant-workbench.js', 'data-page-clone', 'managerul permite duplicarea rapidă a paginilor'],
  ['js/platform-assistant-workbench.js', 'uniquePageSlug', 'duplicarea generează sluguri unice'],
  ['js/platform-assistant-workbench.js', 'data-page-export-one', 'managerul permite exportul individual al paginii'],
  ['js/platform-assistant-workbench.js', 'platform-page-bulk-publish', 'managerul permite publicarea în lot'],
  ['js/platform-assistant-workbench.js', 'platform-page-select-visible', 'managerul poate selecta rapid paginile vizibile'],
  ['js/platform-assistant-workbench.js', 'platform-settings-visibility', 'constructorul poate afișa progresiv doar grupul de setări necesar'],
  ['js/platform-assistant-workbench.js', "'platform-settings-visibility'", 'bara setărilor avansate este ascunsă fără draft activ'],
  ['js/platform-assistant-workbench.js', 'dataset.auditFix', 'auditul oferă acțiuni directe pentru remedierea verificărilor'],
  ['js/platform-assistant-workbench.js', 'platform-draft-progress', 'constructorul afișează progresul draftului'],
  ['js/platform-assistant-workbench.js', 'saveMemory(); syncWorkbenchSections();', 'progresul draftului se actualizează imediat după schimbarea opțiunilor'],
  ['js/platform-assistant-workbench.js', 'state.publishNow===true){state.advancedOpen=true', 'publicarea blocată deschide automat auditul și setările'],
  ['js/platform-assistant-workbench.js', 'Există deja un șablon cu același conținut.', 'șabloanele duplicate sunt prevenite'],
  ['js/platform-assistant-workbench.js', 'data-open-live-page', 'publicarea oferă deschiderea directă a paginii live'],
  ['js/platform-assistant-workbench.js', 'index+1}/${slugs.length}', 'operațiile în lot afișează progresul curent'],
  ['js/platform-assistant-workbench.js', 'Deschide auditul draftului', 'progresul draftului deschide auditul la click'],
  ['js/platform-assistant-workbench.js', "state.mode='page'; state.viewStarted=true; state.advancedOpen=false; state.step='confirm';", 'editarea și duplicarea activează corect constructorul'],
  ['js/platform-assistant-workbench.js', 'data-page-metadata-badges', 'catalogul afișează categoria și accesul paginii'],
  ['js/platform-assistant-workbench.js', 'data-create-first-page', 'starea goală a catalogului oferă creare directă'],
  ['js/platform-assistant-workbench.js', 'platform-page-clear-search', 'catalogul permite ștergerea separată a căutării'],
  ['js/platform-assistant-workbench.js', 'platform-page-result-count', 'catalogul afișează numărul de rezultate'],
  ['js/platform-assistant-workbench.js', 'renderManagerSearchDebounced', 'căutarea din catalog este optimizată pentru liste mari'],
  ['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='f'", 'gestionarea are shortcut pentru căutare rapidă'],
  ['js/platform-assistant-workbench.js', "event.key==='Enter'", 'căutarea catalogului deschide primul rezultat cu Enter'],
  ['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='n'", 'constructorul are shortcut pentru draft nou'],
  ['js/platform-assistant-workbench.js', 'modificări locale nesalvate', 'shortcuturile protejează drafturile locale'],
  ['js/platform-assistant-workbench.js', 'PageDown', 'catalogul are navigare de paginare din tastatură'],
  ['js/platform-assistant-workbench.js', 'data-catalog-page', 'shortcuturile folosesc controalele reale de paginare'],
  ['js/platform-assistant-workbench.js', "event.key==='Home'||event.key==='End'", 'catalogul are salt la prima și ultima pagină'],
  ['js/platform-assistant-workbench.js', "input,textarea,select,[contenteditable=\"true\"]", 'shortcuturile de paginare nu afectează câmpurile de editare'],
  ['js/platform-assistant-workbench.js', 'Nu există rezultate pentru această căutare.', 'căutarea fără rezultate oferă feedback explicit'],
  ['js/platform-assistant-workbench.js', 'schedule-clarify', 'asistentul cere momentul pentru publicarea programată'],
  ['js/platform-assistant-workbench.js', 'scheduledIsoFrom', 'asistentul interpretează data și ora programării'],
  ['js/platform-assistant-workbench.js', 'calendar=value.match', 'asistentul acceptă date calendaristice exacte'],
  ['js/platform-assistant-workbench.js', 'data-preview-schedule', 'preview-ul afișează momentul publicării programate'],
  ['js/platform-assistant-workbench.js', 'data-quick-schedule', 'draftul are preseturi rapide pentru programare'],
  ['js/platform-assistant-workbench.js', 'Recuperezi acest backup?', 'recuperarea backupului confirmă înlocuirea draftului'],
  ['js/platform-assistant-workbench.js', 'applyScheduleEdit', 'asistentul poate modifica programarea unui draft existent'],
  ['js/platform-assistant-workbench.js', 'scheduledPublishConfirmObserver', 'publicarea programată cere confirmare explicită'],
  ['js/platform-assistant-workbench.js', 'state.pendingSaveIntent?', 'indicatorul de stare arată salvările în așteptare'],
  ['js/platform-assistant-workbench.js', 'data-slug-fix', 'constructorul repară automat rutele invalide sau duplicate'],
  ['js/platform-assistant-workbench.js', 'data-copy-page-design', 'constructorul poate copia stilul vizual al unei pagini'],
  ['js/platform-assistant-workbench.js', 'data-block-limit', 'editorul afișează și impune limita de blocuri'],
  ['js/platform-assistant-workbench.js', 'nested.push', 'editorul afișează limitele pentru grupurile imbricate'],
  ['js/platform-assistant-workbench.js', 'data-block-empty', 'editorul oferă ghidaj când pagina nu are blocuri'],
  ['js/platform-assistant-workbench.js', 'data-block-filter-feedback', 'filtrul blocurilor oferă feedback pentru rezultate'],
  ['js/platform-assistant-workbench.js', 'escapeClear', 'filtrul blocurilor poate fi resetat cu Escape'],
  ['js/platform-assistant-workbench.js', 'blockRecentKey', 'editorul memorează tipurile de bloc folosite recent'],
  ['js/platform-assistant-workbench.js', 'data-clear-recent-blocks', 'editorul permite curățarea listei de blocuri recente'],
  ['js/platform-assistant-workbench.js', 'templateRecentKey', 'constructorul memorează șabloanele folosite recent'],
  ['js/platform-assistant-workbench.js', 'data-clear-recent-templates', 'selectorul permite curățarea șabloanelor recente'],
  ['js/platform-assistant-workbench.js', 'templateSearchFeedback', 'căutarea șabloanelor are feedback accesibil și reset cu Escape'],
  ['js/platform-assistant-workbench.js', "event.key==='Enter'", 'căutarea șabloanelor încarcă primul rezultat cu Enter'],
  ['js/platform-assistant-workbench.js', 'platform-page-scheduled-filter', 'managerul filtrează rapid paginile programate'],
  ['js/platform-assistant-workbench.js', 'scheduledCatalogFilterPersistenceObserver', 'filtrul programat își păstrează preferința local'],
['js/platform-assistant-workbench.js', 'scheduledCatalogEmptyObserver', 'filtrul programat are stare goală și creare rapidă'],
['js/platform-assistant-workbench.js', 'data-scheduled-show-all', 'filtrul programat poate reveni rapid la toate paginile'],
['js/platform-assistant-workbench.js', 'removeBackup', 'backupurile locale pot fi șterse individual'],
['js/platform-assistant-workbench.js', 'Șterge toate backupurile', 'backupurile locale pot fi curățate complet cu confirmare'],
['js/platform-assistant-workbench.js', 'exportBackup', 'backupurile locale pot fi exportate individual'],
['js/platform-assistant-workbench.js', 'exportAllBackups', 'backupurile locale pot fi arhivate într-un singur fișier'],
['js/platform-assistant-workbench.js', 'Alege backupul de importat', 'importul arhivei permite alegerea backupului'],
['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='b'", 'backupurile pot fi deschise cu scurtătură'],
['js/platform-assistant-workbench.js', 'platform-backup-count', 'bara constructorului afișează numărul de backupuri'],
['js/platform-assistant-workbench.js', 'platform-page-filter-summary', 'managerul explică filtrele active'],
['js/platform-assistant-workbench.js', 'data-filter-summary-clear', 'managerul poate curăța filtrele din rezumat'],
['js/platform-assistant-workbench.js', 'platform-page-refresh', 'managerul permite reîmprospătarea manuală'],
['js/platform-assistant-workbench.js', 'backupIndicatorObserver.observe(actions', 'indicatorul de backup este inițializat după definirea observerului'],
['js/platform-assistant-workbench.js', 'event.key===backupKey', 'indicatorul de backup se sincronizează între taburi'],
['js/platform-assistant-workbench.js', 'Lista paginilor nu a putut fi reîmprospătată', 'reîmprospătarea managerului tratează erorile și reactivează butonul'],
['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='r'", 'managerul are scurtătură pentru reîmprospătare'],
['js/platform-assistant-workbench.js', "event.key!=='Escape'", 'managerul poate curăța filtrele cu Escape'],
['js/platform-assistant-workbench.js', 'platform-page-refresh-time', 'managerul afișează ora ultimei reîmprospătări'],
['js/platform-assistant-workbench.js', 'platform-page-share-filters', 'managerul poate copia un link cu filtrarea curentă'],
['js/platform-assistant-workbench.js', 'restoreManagerUrlFilters', 'managerul restaurează filtrele din link'],
['js/platform-assistant-workbench.js', 'restoreManagerUrlFilters();rememberManagerFilters()', 'filtrele din link sunt memorate local'],
['js/platform-assistant-workbench.js', 'platform-page-auto-refresh', 'managerul permite pauzarea auto-refreshului'],
['js/platform-assistant-workbench.js', 'panel_pro_page_auto_refresh_v1', 'preferința auto-refresh este memorată'],
['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='t'", 'auto-refreshul are scurtătură de tastatură'],
['js/platform-assistant-workbench.js', "event.key.toLowerCase()!=='l'", 'linkul de filtrare are scurtătură de tastatură'],
['js/platform-assistant-workbench.js', 'Actualizat la ${new Date().toLocaleTimeString', 'auto-refreshul actualizează ora sincronizării'],
['js/platform-assistant-workbench.js', 'Reîncarcă lista fără refresh complet', 'butonul de refresh are ajutor contextual'],
['js/platform-assistant-workbench.js', 'Copiază un link cu filtrele curente', 'butonul de partajare are ajutor contextual'],
['js/platform-assistant-workbench.js', 'Comută actualizarea automată la 60 de secunde', 'butonul auto-refresh are ajutor contextual'],
['js/platform-assistant-workbench.js', 'data-catalog-retry', 'managerul oferă reîncercare după o eroare de catalog'],
['js/platform-assistant-workbench.js', 'button.focus()', 'butonul de retry este accesibil imediat din tastatură'],
['js/platform-assistant-workbench.js', 'Reîncearcă încărcarea catalogului', 'retry are etichetă ARIA explicită'],
['js/platform-assistant-workbench.js', 'Reîmprospătează catalogul de pagini', 'refresh are etichetă ARIA explicită'],
['js/platform-assistant-workbench.js', 'aria-controls','refresh indică lista controlată'],
['js/platform-assistant-workbench.js', 'Copiază linkul cu filtrarea curentă', 'partajarea are etichetă ARIA explicită'],
['js/platform-assistant-workbench.js', 'Comută actualizarea automată a catalogului', 'auto-refresh are etichetă ARIA explicită'],
['js/platform-assistant-workbench.js', 'aria-keyshortcuts', 'scurtăturile managerului sunt declarate accesibil'],
['js/platform-assistant-workbench.js', "button.setAttribute('aria-busy','true')", 'încărcarea managerului este anunțată accesibil'],
['js/platform-assistant-workbench.js', "button.setAttribute('aria-busy','false')", 'retry-ul revine la starea accesibilă după încărcare'],
['js/platform-assistant-workbench.js', 'ensureManagerSearchTools', 'managerul are unelte de căutare reutilizabile'],
['js/platform-assistant-workbench.js', 'platform-page-clear-search', 'căutarea poate fi curățată fără refresh complet'],
['js/platform-assistant-workbench.js', 'platform-page-filter-summary', 'managerul sumarizează filtrele active'],
['js/platform-assistant-workbench.js', 'data-filter-summary-clear', 'filtrele pot fi curățate din sumar'],
['js/platform-assistant-workbench.js', 'panel_pro_page_scheduled_filter', 'filtrul de programare este memorat'],
['js/platform-assistant-workbench.js', "new BroadcastChannel('panel-pro-pages')", 'sincronizarea între ferestre folosește un canal dedicat'],
['js/platform-assistant-workbench.js', 'catalogRefreshTimer', 'managerul are refresh automat controlat'],
['js/platform-assistant-workbench.js', "document.visibilityState === 'visible'", 'refresh-ul automat evită ferestrele ascunse'],
['js/platform-assistant-workbench.js', "pageSync?.close()", 'canalul de sincronizare este închis la ieșire'],
['js/platform-assistant-workbench.js', 'platform-page-refresh-time', 'managerul afișează ora ultimei reîmprospătări'],
['js/platform-assistant-workbench.js', "event.key==='Escape'", 'managerul permite curățarea rapidă din tastatură'],
['js/platform-assistant-workbench.js', 'catalogRetryObserver', 'managerul recreează retry-ul după erori'],
['js/platform-assistant-workbench.js', "Catalogul nu a putut fi reîncărcat.", 'retry-ul comunică eroarea reîncărcării'],
['js/platform-assistant-workbench.js', 'Se încearcă din nou…', 'butonul de reîncercare previne cererile duplicate'],
['js/platform-assistant-workbench.js', 'button.remove();Promise.resolve().then(()=>loadCatalog())', 'butonul de retry reapare după un nou eșec'],
  ['js/platform-assistant-workbench.js', 'validateImportedPage(backup.draft)', 'backupurile locale sunt validate la restaurare'],
  ['js/platform-assistant-workbench.js', 'item?.draft&&validateImportedPage(item.draft).length===0', 'lista de backupuri exclude datele invalide'],
  ['js/platform-assistant-workbench.js', 'localStorage.setItem(backupKey,JSON.stringify(valid))', 'backupurile invalide sunt curățate din stocarea locală'],
  ['js/platform-assistant-workbench.js', 'button.disabled=!inputNode.value.trim()', 'butonul de ștergere a căutării reflectă starea câmpului'],
  ['js/platform-assistant-workbench.js', 'filter((article)=>!article.hidden)', 'contorul catalogului numără doar rezultatele vizibile'],
  ['js/platform-assistant-workbench.js', 'filtrate · ${total} total', 'contorul diferențiază rezultatele filtrate de total'],
  ['js/platform-assistant-workbench.js', "node.closest('article')?.hidden", 'selectarea în lot ignoră paginile ascunse de paginare'],
  ['js/platform-assistant-workbench.js', "state.step='clarify'", 'asistentul cere clarificări pentru cereri generice'],
  ['js/platform-assistant-workbench.js', 'Ce tip de pagină vrei să pregătesc?', 'asistentul oferă opțiuni pentru clarificarea tipului de pagină'],
  ['js/platform-assistant-workbench.js', 'themeFrom', 'asistentul înțelege temele din limbaj natural'],
  ['js/platform-assistant-workbench.js', 'deviceFrom', 'asistentul înțelege audiența pe dispozitiv'],
  ['js/platform-assistant-workbench.js', 'device:state.draft.content.settings.audience?.device', 'preferințele memorează dispozitivul ales'],
  ['administrare-module.html', 'value="midnight"', 'constructorul oferă preseturi vizuale suplimentare'],
  ['js/custom-page.js', 'pageTheme', 'pagina publicată aplică tema aleasă'],
  ['supabase/functions/manage-platform-pages/index.ts', 'themeValue', 'backendul validează tema paginii'],
  ['js/platform-assistant-workbench.js', 'platform-page-responsive', 'constructorul permite controlul responsive'],
  ['js/custom-page.js', 'dataset.responsive', 'pagina publicată aplică setarea responsive'],
  ['js/platform-assistant-workbench.js', 'selectedPages', 'managerul păstrează selecția multiplă a paginilor'],
  ['js/platform-assistant-workbench.js', 'enhanceBlockSelection', 'editorul suportă selecție multiplă'],
  ['js/platform-assistant-workbench.js', "event.key.toLowerCase()==='z'", 'shortcut-ul undo există'],
  ['js/platform-assistant-workbench.js', "['calculator','🧮 Calculator'", 'șabloanele rapide avansate există'],
  ['js/platform-assistant-workbench.js', 'blockPresets.tabs', 'editorul are blocuri de tip tab'],
  ['js/platform-assistant-workbench.js', 'taburi|tabs|sectiuni tab', 'asistentul generează taburi din limbaj natural'],
  ['js/platform-assistant-workbench.js', 'preview-live-tabs', 'preview-ul redă taburile'],
  ['js/custom-page.js', "block.type==='tabs'", 'pagina publicată redă taburile'],
  ['supabase/functions/manage-platform-pages/index.ts', "type === 'tabs'", 'backendul validează blocurile de tip tab'],
  ['js/platform-assistant-workbench.js', 'previewBlocks', 'preview-ul suportă date demo'],
  ['js/platform-assistant-workbench.js', '2*1024*1024', 'importul are limită de siguranță'],
  ['js/platform-assistant-workbench.js', 'Ruta duplicată în import', 'importul respinge rutele duplicate și fișierele prea mari'],
  ['js/platform-assistant-workbench.js', 'Importul va înlocui', 'importul cere confirmare pentru conflictele existente'],
  ['js/platform-assistant-workbench.js', 'validateImportedPage', 'importul validează fiecare pagină înainte de salvare'],
  ['js/platform-assistant-workbench.js', 'Pagina ${pageSlug||\'fără rută\'} nu este validă', 'importul raportează pagina invalidă'],
  ['js/platform-assistant-workbench.js', 'importedIssues=validateImportedPage(draft)', 'importul unui draft folosește validatorul comun'],
  ['js/platform-assistant-workbench.js', 'invalidTemplates=items.filter', 'importul șabloanelor folosește validatorul comun'],
  ['js/platform-assistant-workbench.js', 'item.draft&&validateImportedPage(item.draft).length===0', 'biblioteca filtrează șabloanele locale invalide'],
  ['js/platform-assistant-workbench.js', 'array.findIndex((other)=>other?.id===item.id)===index', 'biblioteca elimină șabloanele duplicate'],
  ['js/platform-assistant-workbench.js', 'Versiunea fișierului de șabloane nu este acceptată', 'importul șabloanelor verifică versiunea'],
  ['js/platform-assistant-workbench.js', 'platform-page-access-filter', 'managerul filtrează paginile după acces'],
  ['js/platform-assistant-workbench.js', 'platform-page-clear-filters', 'managerul poate reseta toate filtrele'],
  ['js/platform-assistant-workbench.js', 'rememberManagerFilters', 'managerul memorează filtrele locale'],
  ['js/platform-assistant-workbench.js', 'restoreManagerFilters', 'managerul restaurează filtrele locale'],
  ['js/platform-assistant-workbench.js', 'restoreManagerFilters();renderCatalog()', 'catalogul aplică imediat filtrele restaurate'],
  ['js/platform-assistant-workbench.js', 'Selecția nu mai conține pagini disponibile', 'acțiunile în lot curăță selecțiile stale'],
  ['js/platform-assistant-workbench.js', 'availableSlugs', 'catalogul curăță selecțiile după reîncărcare'],
 ['js/platform-assistant-workbench.js', "sort:$('platform-page-sort')?.value||'title'", 'managerul memorează sortarea și paginarea'],
  ['js/platform-assistant-workbench.js', 'preferences.previewMode=state.previewMode', 'preview-ul memorează dispozitivul și audiența'],
  ['js/platform-assistant-workbench.js', 'const titles=slugs.map', 'confirmarea în lot afișează titlurile selectate'],
  ['js/platform-assistant-workbench.js', 'dispozitiv invalid', 'validatorul importurilor verifică dispozitivul și programarea'],
  ['js/platform-assistant-workbench.js', 'status de aprobare invalid', 'validatorul importurilor verifică starea de aprobare'],
  ['js/platform-assistant-workbench.js', 'tipuri de bloc necunoscute', 'validatorul importurilor respinge blocurile necunoscute'],
  ['js/platform-assistant-workbench.js', 'conținut nesigur', 'validatorul importurilor respinge schemele periculoase'],
  ['js/platform-assistant-workbench.js', 'inspectImportedBlocks', 'validatorul verifică și blocurile imbricate'],
  ['js/platform-assistant-workbench.js', 'conținut importat prea mare', 'validatorul importurilor respectă limitele backendului'],
  ['js/platform-assistant-workbench.js', 'oversizedLevel', 'limita de blocuri se aplică și grupurilor'],
  ['js/platform-assistant-workbench.js', 'malformedBlocks', 'validatorul importurilor verifică structura blocurilor complexe'],
  ['js/platform-assistant-workbench.js', 'invalidLinks', 'validatorul importurilor verifică linkurile și sursele imaginilor'],
  ['js/platform-assistant-workbench.js', 'preferences.autoSave=state.autoSaveEnabled', 'preferința autosave este memorată'],
  ['js/platform-assistant-workbench.js', '🔀 Ambele', 'clarificarea inițială oferă alegeri pentru audiență și categorie'],
  ['js/platform-assistant-workbench.js', 'const explicitCategory=/(^|\\s)legal', 'cererea explicită legală suprascrie preferința anterioară'],
  ['js/platform-assistant-workbench.js', '🌙 Midnight', 'clarificarea inițială oferă preseturi vizuale'],
  ['js/platform-assistant-workbench.js', 'Ai modificări locale nesalvate', 'schimbarea zonei protejează draftul local'],
  ['js/platform-assistant-workbench.js', 'Sigur vrei să resetezi constructorul?', 'resetarea protejează draftul local'],
  ['supabase/functions/manage-platform-pages/index.ts', 'audienceSession', 'paginile pot filtra audiența pe sesiune'],
  ['js/custom-page.js', 'x-panel-device', 'pagina publică trimite dispozitivul pentru filtrare'],
  ['js/panel-layout.js', 'x-panel-device', 'meniul public trimite dispozitivul pentru pagini custom'],
  ['organizatii.html', 'x-panel-device', 'selectorii din organizații respectă audiența pe dispozitiv'],
  ['supabase/functions/manage-platform-pages/index.ts', 'audienceSession.discord_id', 'paginile pot filtra utilizatori individuali'],
  ['js/platform-assistant-workbench.js', 'platform-page-users', 'editorul are țintire pe utilizatori'],
  ['js/platform-assistant-workbench.js', 'permissionActions', 'editorul are permisiuni separate pe acțiuni'],
  ['js/platform-assistant-workbench.js', 'platform-page-permission-preset', 'permisiunile au preseturi rapide'],
  ['js/platform-assistant-workbench.js', 'data-copy-page-permissions', 'constructorul poate copia permisiunile unei pagini existente'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanPagePermissions', 'backendul curăță permisiunile paginilor'],
  ['supabase/functions/manage-platform-pages/index.ts', 'permissionAllowed', 'citirea paginii verifică permisiunile configurate'],
  ['docs/page-constructor.md', 'Permisiuni pe acțiuni', 'documentația descrie permisiunile pe acțiuni'],
  ['supabase/functions/manage-platform-pages/index.ts', 'approval_status', 'publicarea poate necesita aprobare'],
  ['js/platform-assistant-workbench.js', 'galerie goală la blocul', 'verificarea validează galeriile'],
  ['js/platform-assistant-workbench.js', 'data-page-approve', 'managerul poate aproba pagini'],
  ['js/platform-assistant-workbench.js', 'pageReject', 'managerul poate respinge pagini'],
  ['js/platform-assistant-workbench.js', 'comparePageVersions', 'managerul poate compara versiuni'],
  ['js/platform-assistant-workbench.js', 'platform-assistant-help', 'centrul de ajutor este disponibil'],
  ['js/platform-assistant-workbench.js', 'platform-page-recurrence', 'editorul suportă publicare recurentă'],
  ['js/platform-assistant-workbench.js', 'pageScheduleLabel', 'managerul afișează programarea și repetarea paginilor'],
  ['js/platform-assistant-workbench.js', 'repetarea are nevoie de data publicării', 'editorul validează data pentru publicarea recurentă'],
  ['supabase/functions/manage-platform-pages/index.ts', 'recurrence_until', 'backendul gestionează finalul repetării'],
  ['supabase/functions/manage-platform-pages/index.ts', 'function recurrenceActive', 'backendul calculează fereastra fiecărui ciclu'],
  ['supabase/functions/manage-platform-pages/index.ts', 'Publicarea recurentă are nevoie de o dată de început', 'backendul refuză repetările fără ancoră'],
  ['supabase/functions/manage-platform-pages/index.ts', 'recurring:', 'health-ul paginii expune starea recurenței'],
  ['js/platform-assistant-workbench.js', 'health.recurring', 'managerul afișează starea recurenței'],
  ['js/custom-page.js', 'recurrenceStepMs', 'pagina publică respectă ferestrele recurente'],
  ['js/platform-assistant-workbench.js', 'previewMode', 'preview desktop/mobil există'],
  ['administrare-module.html', 'preview-live-frame.tablet', 'preview tabletă există'],
  ['js/platform-assistant-workbench.js', 'panel_custom_page_published', 'sincronizarea între taburi există'],
  ['js/platform-assistant-workbench.js', 'catalogRefreshTimer', 'managerul reîmprospătează automat lista paginilor'],
  ['js/platform-assistant-workbench.js', 'page.content?.blocks||[]', 'căutarea managerului include conținutul blocurilor'],
  ['js/custom-page.js', 'action:listAction', 'pagina publicată folosește ruta de citire corectă'],
  ['organizatii.html', 'refreshCustomOrganizationPages', 'organizatii.html poate reîncărca selectorii'],
  ['organizatii.html', "new BroadcastChannel('panel-pro-pages')", 'selectorii organizațiilor se sincronizează între taburi'],
  ['organizatii.html', "panel-custom-page-published", 'selectorii reacționează la publicarea din constructor'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'public_list'", 'lista publică este disponibilă'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'submit_form'", 'backendul primește formulare publicate'],
  ['supabase/functions/manage-platform-pages/index.ts', 'cleanSubmissionValues', 'backendul curăță datele formularelor'],
  ['supabase/functions/manage-platform-pages/index.ts', 'block_path', 'backendul acceptă formulare din grupuri'],
  ['supabase/functions/manage-platform-pages/index.ts', 'audienceOrganizations', 'trimiterea formularului revalidează audiența'],
  ['supabase/functions/manage-platform-pages/index.ts', 'allowFormRequest', 'trimiterea formularelor are limită separată'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'list_submissions'", 'administratorul poate lista cererile'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'update_submission_status'", 'administratorul poate actualiza starea cererilor'],
  ['js/platform-assistant-workbench.js', 'showSubmissions', 'managerul afișează cererile formularelor'],
  ['js/platform-assistant-workbench.js', 'Descarcă CSV', 'cererile pot fi exportate'],
  ['supabase/migrations/20260914000100_platform_page_submissions.sql', 'platform_page_submissions', 'schema pentru trimiteri din formulare'],
  ['supabase/functions/manage-platform-pages/index.ts', "action === 'set_page_state'", 'starea de publicare este controlată server-side'],
  ['supabase/functions/manage-organizations/index.ts', 'platform_custom_pages', 'permisiunile acceptă pagini custom'],
  ['tools/validate-panel.mjs', 'function walk', 'validatorul general este disponibil']
  ,['js/platform-assistant-workbench.js', "heading:{type:'heading'", 'preset heading']
  ,['js/platform-assistant-workbench.js', "callout:{type:'callout'", 'preset callout']
  ,['js/platform-assistant-workbench.js', "banner:{type:'banner'", 'preset banner']
  ,['js/platform-assistant-workbench.js', "list:{type:'list'", 'preset list']
  ,['js/platform-assistant-workbench.js', "cards:{type:'cards'", 'preset cards']
  ,['js/platform-assistant-workbench.js', "faq:{type:'faq'", 'preset FAQ']
  ,['js/platform-assistant-workbench.js', "accordion:{type:'accordion'", 'preset accordion']
  ,['js/platform-assistant-workbench.js', "stats:{type:'stats'", 'preset statistici']
  ,['js/platform-assistant-workbench.js', "table:{type:'table'", 'preset tabel']
  ,['js/platform-assistant-workbench.js', "form:{type:'form'", 'preset formular']
  ,['js/platform-assistant-workbench.js', "gallery:{type:'gallery'", 'preset galerie']
  ,['js/platform-assistant-workbench.js', "timeline:{type:'timeline'", 'preset timeline']
  ,['js/platform-assistant-workbench.js', "calculator:{type:'calculator'", 'preset calculator']
  ,['js/platform-assistant-workbench.js', "group:{type:'group'", 'preset grup']
  ,['js/platform-assistant-workbench.js', "button:{type:'button'", 'preset buton']
  ,['js/platform-assistant-workbench.js', "divider:{type:'divider'", 'preset separator']
  ,['js/platform-assistant-workbench.js', "blockPresets.tabs", 'preset taburi']
  ,['js/platform-assistant-workbench.js', 'renderBlockEditor', 'editorul randă blocurile']
  ,['js/platform-assistant-workbench.js', 'data-block-copy', 'editorul copiază blocuri']
  ,['js/platform-assistant-workbench.js', 'data-block-save', 'editorul salvează blocuri reutilizabile']
  ,['js/platform-assistant-workbench.js', 'data-block-remove', 'editorul șterge blocuri']
  ,['js/platform-assistant-workbench.js', 'dragstart', 'editorul mută blocuri prin drag and drop']
  ,['js/platform-assistant-workbench.js', 'data-group-selected', 'editorul grupează selecția']
  ,['js/platform-assistant-workbench.js', 'data-demo-data', 'preview-ul are date demo']
  ,['js/platform-assistant-workbench.js', 'runAccessibilityAudit', 'auditul verifică accesibilitatea']
  ,['js/platform-assistant-workbench.js', 'applySeo', 'pagina aplică SEO']
  ,['js/custom-page.js', 'noindex,nofollow', 'SEO poate marca noindex']
  ,['js/custom-page.js', 'safeHref', 'linkurile preview sunt filtrate']
  ,['supabase/functions/manage-platform-pages/index.ts', 'cleanPageHref', 'backendul filtrează linkurile']
  ,['supabase/functions/manage-platform-pages/index.ts', 'cleanBlocks', 'backendul curăță blocurile']
  ,['supabase/functions/manage-platform-pages/index.ts', 'cleanPageVisual', 'backendul curăță stilurile']
  ,['supabase/functions/manage-platform-pages/index.ts', 'cleanPageSeo', 'backendul curăță SEO']
  ,['supabase/functions/manage-platform-pages/index.ts', 'allowRequest', 'backendul limitează cererile']
  ,['supabase/functions/manage-platform-pages/index.ts', 'admin_audit_log', 'backendul scrie audit']
  ,['supabase/functions/manage-platform-pages/index.ts', 'preview_token', 'backendul păstrează preview privat']
  ,['supabase/functions/manage-platform-pages/index.ts', 'approval_required', 'backendul respectă aprobarea']
  ,['supabase/functions/manage-platform-pages/index.ts', 'responsive:', 'backendul persistă responsive']
  ,['js/custom-page.js', 'pageTheme', 'pagina publică aplică tema']
  ,['js/custom-page.js', 'responsive', 'pagina publică aplică responsive']
  ,['custom-page.html', 'data-page-theme', 'șablonul custom page are teme']
  ,['custom-page.html', 'data-responsive', 'șablonul custom page are responsive']
  ,['panel-ios/custom-page.html', 'data-page-theme', 'iOS are teme custom page']
  ,['panel-android/web-src/custom-page.html', 'data-page-theme', 'Android are teme custom page']
  ,['panel-ios/js/custom-page.js', 'x-panel-device', 'iOS trimite dispozitivul']
  ,['panel-android/web-src/js/custom-page.js', 'x-panel-device', 'Android trimite dispozitivul']
  ,['js/panel-layout.js', 'x-panel-device', 'layoutul transmite dispozitivul pentru pagini']
  ,['organizatii.html', 'panel_custom_page_published', 'organizațiile ascultă publicarea']
  ,['supabase/functions/manage-panel-modules/index.ts', 'allowed_mentions', 'embedurile nu permit mention spam']
  ,['supabase/functions/manage-panel-modules/index.ts', 'PATCH', 'publicarea Discord editează embedul']
  ,['supabase/functions/manage-panel-modules/index.ts', 'fallback', 'publicarea Discord are fallback controlat']
  ,['js/administrare-module.js', 'publication-repair', 'interfața repară publicația Discord']
  ,['js/administrare-module.js', 'publication-test', 'interfața testează publicația Discord']
  ,['supabase/functions/manage-panel-modules/index.ts', 'result_channel_id', 'publicarea păstrează canalul de rezultate']
  ,['js/platform-assistant-workbench.js', 'catalogRefreshTimer', 'catalogul are actualizare periodică']
  ,['js/platform-assistant-workbench.js', 'openBlockInspector', 'inspectorul vizual pentru blocuri există']
  ,['js/platform-assistant-workbench.js', 'platform-block-inspector', 'inspectorul blocurilor are dialog de editare']
  ,['js/platform-assistant-workbench.js', 'enhanceBlockInspector', 'inspectorul are câmpuri prietenoase pentru blocuri']
  ,['js/platform-assistant-workbench.js', 'data-friendly-items', 'inspectorul poate edita liste și secțiuni']
  ,['js/platform-assistant-workbench.js', 'data-friendly-cards', 'inspectorul poate edita carduri']
  ,['js/platform-assistant-workbench.js', 'data-friendly-fields', 'inspectorul poate edita câmpuri de formular']
  ,['js/platform-assistant-workbench.js', 'platform-template-export', 'șabloanele personale pot fi exportate']
  ,['js/platform-assistant-workbench.js', 'platform-template-import', 'șabloanele personale pot fi importate']
  ,['js/platform-assistant-workbench.js', 'platform-page-auto-slug', 'ruta poate fi generată automat din titlu']
  ,['js/platform-assistant-workbench.js', 'platform-page-sidebar', 'secțiunea meniului poate fi aleasă manual']
  ,['js/platform-assistant-workbench.js', 'platform-page-audience-presets', 'audiența are preseturi rapide']
  ,['js/platform-assistant-workbench.js', 'platform-command-palette', 'constructorul are paletă de comenzi']
  ,['js/platform-assistant-workbench.js', 'showQualityAudit', 'draftul are audit de calitate']
  ,['js/platform-assistant-workbench.js', 'platform-draft-status', 'draftul afișează starea salvării locale']
  ,['js/platform-assistant-workbench.js', 'platform-advanced-toggle', 'setările avansate pot fi pliate într-un singur buton']
  ,['js/platform-assistant-workbench.js', 'advancedOpen', 'constructorul păstrează starea opțiunilor avansate']
  ,['js/platform-assistant-workbench.js', 'platform-page-catalog-summary', 'managerul are sumar de stări']
  ,['js/platform-assistant-workbench.js', 'applyTextReplacement', 'asistentul poate înlocui texte în masă']
  ,['js/platform-assistant-workbench.js', 'syncConditionalSettings', 'setările sunt afișate condiționat']
  ,['js/platform-assistant-workbench.js', 'data-summary-filter', 'sumarul managerului are filtre rapide']
  ,['js/platform-assistant-workbench.js', 'localHistoryObserver', 'istoricul local este disponibil în acțiuni']
  ,['js/platform-assistant-workbench.js', 'duplicateCurrentDraft', 'draftul curent poate fi duplicat rapid']
  ,['js/platform-assistant-workbench.js', 'data-duplicate-draft', 'acțiunea de duplicare a draftului este vizibilă']
  ,['js/platform-assistant-workbench.js', 'ensureProfilePresets', 'constructorul are profiluri de pagină dintr-un click']
  ,['js/platform-assistant-workbench.js', 'platform-quick-profiles', 'profilurile rapide folosesc zona dedicată']
  ,['js/platform-assistant-workbench.js', 'ensurePreviewActions', 'preview-ul are acțiuni rapide pentru rută']
  ,['js/platform-assistant-workbench.js', 'data-preview-copy-route', 'ruta preview poate fi copiată direct']
  ,['js/platform-assistant-workbench.js', 'data-preview-print', 'preview-ul poate fi tipărit direct']
  ,['js/platform-assistant-workbench.js', 'syncWizardProgress', 'constructorul afișează etapa curentă din flux']
  ,['js/platform-assistant-workbench.js', 'aria-current', 'progresul constructorului este accesibil']
  ,['js/platform-assistant-workbench.js', 'autoPrepareDraft', 'constructorul poate pregăti automat draftul înainte de publicare']
  ,['js/platform-assistant-workbench.js', 'Pregătește automat', 'butonul de pregătire automată este vizibil în confirmare']
  ,['js/platform-assistant-workbench.js', 'saved.advancedOpen', 'preferința pentru opțiunile avansate se recuperează local']
  ,['js/platform-assistant-workbench.js', "event.ctrlKey||!event.altKey||event.key.toLowerCase()!=='p'", 'preview-ul are scurtătură Ctrl+Alt+P']
  ,['js/platform-assistant-workbench.js', 'ensureConnectionStatus', 'constructorul afișează starea conexiunii']
  ,['js/platform-assistant-workbench.js', 'platform-connection-status', 'starea online offline este vizibilă']
  ,['js/platform-assistant-workbench.js', 'Ești offline. Draftul a fost păstrat local', 'salvarea offline este protejată']
  ,['js/platform-assistant-workbench.js', 'pendingSaveIntent', 'constructorul reține salvarea pentru reluare automată']
  ,['js/platform-assistant-workbench.js', 'Se reia automat ultima salvare', 'salvarea se reia la reconectare']
  ,['js/platform-assistant-workbench.js', 'Draftul tău local nu a fost suprascris', 'editorul avertizează despre modificări externe']
  ,['js/platform-assistant-workbench.js', 'syncState', 'constructorul diferențiază salvarea locală de sincronizarea serverului']
  ,['js/platform-assistant-workbench.js', 'Sincronizat', 'starea sincronizată este afișată utilizatorului']
  ,['js/platform-assistant-workbench.js', "state.syncState==='synced'?'✓ Sincronizat':'✓ Salvat local'", 'rezumatul păstrează starea de sincronizare']
  ,['js/platform-assistant-workbench.js', "state.syncState==='local'", 'închiderea protejează drafturile nesincronizate']
  ,['js/platform-assistant-workbench.js', 'scheduleDraftAutoSave', 'constructorul programează salvarea automată a draftului']
  ,['js/platform-assistant-workbench.js', 'autoSaveEnabled', 'salvarea automată poate fi controlată din starea constructorului']
  ,['js/platform-assistant-workbench.js', 'state.publishNow=false', 'salvarea automată nu publică pagina implicit']
  ,['js/platform-assistant-workbench.js', 'saveDraft({silent:true})', 'autosave-ul nu întrerupe interfața de confirmare']
  ,['js/platform-assistant-workbench.js', 'const silent=options.silent===true', 'salvarea poate rula în mod silențios']
  ,['js/platform-assistant-workbench.js', 'platform-autosave-toggle', 'autosave-ul are control vizibil în constructor']
  ,['js/platform-assistant-workbench.js', 'state.autoSaveEnabled=!state.autoSaveEnabled', 'autosave-ul poate fi pornit sau oprit rapid']
  ,['js/platform-assistant-workbench.js', 'state.autoSaveEnabled=!state.autoSaveEnabled;preferences.autoSave=state.autoSaveEnabled', 'alegerea autosave-ului se persistă imediat']
  ,['js/platform-assistant-workbench.js', 'saved.autoSaveEnabled!==false', 'preferința autosave se recuperează după reload']
  ,['js/platform-assistant-workbench.js', 'state.originalSlug===requested?requested:uniquePageSlug', 'ruta automată evită duplicatele existente']
  ,['js/platform-assistant-workbench.js', "url.searchParams.set('preview',token)", 'acțiunile preview folosesc tokenul privat când există']
  ,['js/platform-assistant-workbench.js', 'platform-autosave-retry', 'autosave-ul oferă reîncercare după o eroare']
  ,['js/platform-assistant-workbench.js', 'state.autoSaveError=error.message', 'eroarea autosave-ului este păstrată vizibil']
  ,['js/platform-assistant-workbench.js', 'state.autoSaveError=null', 'autosave-ul curăță eroarea după sincronizare']
  ,['js/platform-assistant-workbench.js', 'applyPageOptions', 'modificările principale marchează draftul ca local']
  ,['js/platform-assistant-workbench.js', 'settings.permissions=permissions;markDraftChanged()', 'permisiunile marchează draftul ca local']
  ,['js/platform-assistant-workbench.js', "settings.visual={accent", 'personalizarea vizuală marchează draftul ca local']
  ,['js/platform-assistant-workbench.js', "settings.seo={title", 'setările SEO marchează draftul ca local']
  ,['js/platform-assistant-workbench.js', "delete state.draft.content.settings.visual;state.syncState='local'", 'resetarea vizuală marchează draftul ca local']
  ,['js/platform-assistant-workbench.js', 'saved.pendingSaveIntent===true', 'intenția offline se recuperează după reload']
  ,['js/platform-assistant-workbench.js', 'state.publishNow=saved.publishNow===true', 'tipul salvării offline se recuperează după reload']
  ,['js/platform-assistant-workbench.js', 'awaitingMemoryRestore', 'reluarea offline așteaptă recuperarea explicită a draftului']
  ,['js/platform-assistant-workbench.js', 'state.awaitingMemoryRestore=false', 'confirmarea recuperării activează reluarea offline']
  ,['js/platform-assistant-workbench.js', 'syncSeoSnippet', 'constructorul afișează preview SEO live']
  ,['js/platform-assistant-workbench.js', 'data-seo-snippet', 'preview-ul SEO are container dedicat']
  ,['js/platform-assistant-workbench.js', 'data-seo-title-length', 'preview-ul SEO afișează lungimea titlului']
  ,['js/platform-assistant-workbench.js', 'data-seo-description-length', 'preview-ul SEO afișează lungimea descrierii']
  ,['js/platform-assistant-workbench.js', 'ensureDesignPresets', 'designul are preseturi vizuale rapide']
  ,['js/platform-assistant-workbench.js', 'data-design-preset', 'preseturile vizuale sunt identificabile']
  ,['js/platform-assistant-workbench.js', 'reset', 'designul poate reveni la aspectul moștenit']
  ,['js/platform-assistant-workbench.js', 'ensureMetadataCounters', 'câmpurile principale au contoare live']
  ,['js/platform-assistant-workbench.js', 'data-metadata-counter', 'contoarele metadatelor sunt identificabile']
  ,['js/platform-assistant-workbench.js', 'startTools.forEach', 'șabloanele sunt pliate după generarea draftului']
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
