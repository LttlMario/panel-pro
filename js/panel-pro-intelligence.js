(() => {
  'use strict';
  const root = document.getElementById('platform-assistant-workbench') || document.getElementById('panel-module-assistant');
  if (!root || typeof isPlatformAdmin !== 'function' || !isPlatformAdmin()) return;
  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value || '').toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const memoryKey = 'panel_pro_intelligence_memory_v1';
  const historyKey = 'panel_pro_intelligence_history_v1';
  const state = { lastAnalysis: null, history: [] };
  try { state.history = JSON.parse(localStorage.getItem(historyKey) || '[]').slice(0, 20); } catch (_) {}
  const save = () => { try { localStorage.setItem(historyKey, JSON.stringify(state.history.slice(0, 20))); } catch (_) {} };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const patterns = {
    page: /pagina|dashboard|panou|regulament|faq|tutorial|ghid|sectiune|formular web|site/i,
    module: /modul|discord|embed|buton|log|calculator|comanda slash/i,
    create: /creeaza|creare|construieste|fa|vreau|genereaza|pregateste/i,
    edit: /modifica|editeaza|schimba|actualizeaza|repara|corecteaza|ascunde|arata/i,
    publish: /publica|pune live|trimite|posteaza/i,
    manage: /listeaza|cauta|gaseste|arhiveaza|dezactiveaza|sterge|duplica|copiaza/i,
    legal: /legal/i,
    illegal: /ilegal/i,
    private: /privat|mesaj direct|dm|ephemeral/i,
    log: /log|canal de rezultate|public/i,
    schedule: /programeaza|programat|maine|astazi|la ora|peste [0-9]+ zile/i,
    approval: /aprobare|aproba|respinge|manager|staff|conducere/i,
    form: /formular|cerere|inscriere|campuri|date/i,
    report: /raport|statistici|indicatori|clasament/i,
    visual: /culoare|tema|design|aspect|mobil|desktop|coloane|lat/i,
  };
  const labels = { page: 'pagină', module: 'modul Discord', create: 'creare', edit: 'modificare', publish: 'publicare', manage: 'administrare', legal: 'legală', illegal: 'ilegală', private: 'răspuns privat', log: 'log în canal', schedule: 'programare', approval: 'aprobare', form: 'formular', report: 'raport', visual: 'aspect vizual' };
  const planFor = (result) => result.type === 'module' ? ['înțeleg cerința', 'pregătesc modulul și butoanele', 'verific canalele și permisiunile', 'previzualizez embedul', result.intents.includes('publish') ? 'public după confirmare' : 'păstrez ca draft'] : ['înțeleg scopul paginii', 'aleg structura și blocurile', 'aplic accesul și aspectul', 'verific responsive și validarea', result.intents.includes('publish') ? 'public după confirmare' : 'păstrez ca draft'];
  const analyze = (raw) => {
    const text = String(raw || '').trim(); const value = norm(text); const intents = Object.entries(patterns).filter(([, pattern]) => pattern.test(value)).map(([key]) => key);
    const type = intents.includes('module') || intents.includes('log') || intents.includes('private') ? 'module' : intents.includes('page') ? 'page' : intents.includes('manage') ? 'manage' : 'page';
    const name = text.match(/(?:numit|denumit|titlul|numele)\s*(?:este|:|sa fie)?\s*["“]?([^"”.,;]+)["”]?/i)?.[1]?.trim() || '';
    const color = text.match(/#[0-9a-f]{6}|verde|albastru|rosu|mov|violet|galben|cyan|gri/i)?.[0] || '';
    const fields = text.match(/(?:campuri|câmpuri|datele necesare|cu)\s*(?:sunt|:|cu)?\s*([^.;]+)/i)?.[1]?.split(/[,;]|\s+și\s+|\s+si\s+/i).map((item) => item.trim()).filter((item) => item.length > 1).slice(0, 12) || [];
    const missing = [];
    if (!text) missing.push('cerința');
    if (intents.length === 0 || (!intents.includes('page') && !intents.includes('module') && !intents.includes('manage'))) missing.push('tipul de construcție');
    if (intents.includes('create') && !name && text.length < 40) missing.push('numele');
    const confidence = Math.min(1, (intents.length / 3) + (text.length > 30 ? .35 : .1));
    const suggestions = [];
    if (type === 'page') { if (!intents.includes('form')) suggestions.push('Adaugă formular'); if (!intents.includes('visual')) suggestions.push('Alege tema și aspectul'); if (!intents.includes('publish')) suggestions.push('Pregătește publicarea'); }
    if (type === 'module') { if (!intents.includes('approval')) suggestions.push('Adaugă aprobare'); if (!intents.includes('private') && !intents.includes('log')) suggestions.push('Alege unde ajunge răspunsul'); if (!intents.includes('form')) suggestions.push('Adaugă câmpuri'); }
    if (!suggestions.length) suggestions.push('Verifică configurația', 'Salvează ca draft');
    return { raw: text, value, type, intents, labels: intents.map((item) => labels[item] || item), name, color, fields, missing, confidence, suggestions: suggestions.slice(0, 4) };
  };
  window.PanelProIntelligence = { analyze, normalize: norm, remember(raw) { if (!raw) return; state.history.unshift({ raw: String(raw).slice(0, 600), at: new Date().toISOString() }); save(); }, history: () => state.history.slice() };
  const host = root.querySelector('#platform-assistant-log') || root.querySelector('#panel-module-chat-log');
  const input = root.querySelector('#platform-assistant-input') || root.querySelector('#panel-module-chat-input');
  const form = root.querySelector('#platform-assistant-form') || root.querySelector('#panel-module-chat-form');
  if (!input || !form) return;
  let summary = document.getElementById('panel-intelligence-summary');
  if (!summary) { summary = document.createElement('div'); summary.id = 'panel-intelligence-summary'; summary.className = 'preview mt-3'; summary.hidden = true; form.parentElement?.insertBefore(summary, form); }
  const submit = () => { if (typeof form.requestSubmit === 'function') form.requestSubmit(); else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
  const render = (raw) => {
    const result = analyze(raw); state.lastAnalysis = result; if (!raw.trim()) { summary.hidden = true; return; }
    summary.hidden = false;
    const confidence = Math.round(result.confidence * 100);
    summary.innerHTML = `<div class="flex items-start justify-between gap-2"><strong>Am înțeles</strong><span class="tag">${confidence}% potrivire</span></div><p class="muted text-xs mt-1">${result.labels.length ? result.labels.map((item) => escapeHtml(item)).join(' · ') : 'Cerință încă neclasificată'}</p>${result.name ? `<small class="muted">Nume: <strong>${escapeHtml(result.name)}</strong></small>` : ''}${result.fields.length ? `<small class="muted block">Câmpuri detectate: ${result.fields.map(escapeHtml).join(', ')}</small>` : ''}${result.missing.length ? `<small class="text-amber-300 block">Încă neclar: ${result.missing.map(escapeHtml).join(', ')}</small>` : '<small class="text-emerald-300 block">Cerința este suficient de clară pentru a începe.</small>'}<details class="mt-2 text-xs"><summary class="cursor-pointer">Planul meu de lucru</summary><ol class="list-decimal pl-5 mt-1 muted">${planFor(result).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></details><div class="module-chat-actions mt-2">${result.suggestions.map((item) => `<button type="button" class="button" data-intelligence-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('')}</div>`;
    summary.querySelectorAll('[data-intelligence-suggestion]').forEach((button) => button.addEventListener('click', () => { const label = button.dataset.intelligenceSuggestion; const mapping = { 'Adaugă formular': 'adaugă un formular', 'Adaugă câmpuri': 'adaugă câmpuri pentru nume, motiv și descriere', 'Adaugă aprobare': 'adaugă aprobare pentru manageri', 'Alege unde ajunge răspunsul': 'răspuns privat și log', 'Alege tema și aspectul': 'tema Panel Pro în două coloane', 'Pregătește publicarea': 'pregătește publicarea ca draft', 'Verifică configurația': 'verifică configurația', 'Salvează ca draft': 'salvează draftul' }; input.value = mapping[label] || label; submit(); }));
  };
  input.addEventListener('input', () => render(input.value));
  form.addEventListener('submit', () => { const raw = input.value.trim(); if (raw) { window.PanelProIntelligence.remember(raw); render(raw); } }, true);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); submit(); } });
  document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.target.matches('input,textarea,select')) { event.preventDefault(); input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
  const compact = document.createElement('div'); compact.className = 'flex flex-wrap gap-2 mt-2'; compact.innerHTML = '<small class="muted self-center">Exemple inteligente:</small><button type="button" class="button" data-smart-example="Creează un formular pentru recrutare, cu aprobare la manager și răspuns privat">Recrutare cu aprobare</button><button type="button" class="button" data-smart-example="Creează o pagină legală numită Regulament, cu o secțiune FAQ">Regulament + FAQ</button><button type="button" class="button" data-smart-example="Creează un embed Discord pentru cereri, cu buton și log">Embed cu log</button>';
  form.parentElement?.insertBefore(compact, form);
  compact.querySelectorAll('[data-smart-example]').forEach((button) => button.addEventListener('click', () => { input.value = button.dataset.smartExample; render(input.value); submit(); }));
  const historyButton = document.createElement('button'); historyButton.type = 'button'; historyButton.className = 'button'; historyButton.textContent = '🕘 Cereri recente'; historyButton.addEventListener('click', () => { const rows = state.history.slice(0, 8); if (!rows.length) return; const panel = document.createElement('div'); panel.className = 'preview mt-2'; panel.innerHTML = `<strong>Cereri recente</strong><div class="module-list mt-2">${rows.map((row, index) => `<button type="button" class="module-choice text-left" data-history-index="${index}">${escapeHtml(row.raw)}<br><small class="muted">${escapeHtml(new Date(row.at).toLocaleString('ro-RO'))}</small></button>`).join('')}</div>`; summary.parentElement?.insertBefore(panel, summary.nextSibling); panel.querySelectorAll('[data-history-index]').forEach((node) => node.addEventListener('click', () => { input.value = rows[Number(node.dataset.historyIndex)]?.raw || ''; render(input.value); panel.remove(); input.focus(); })); });
  compact.appendChild(historyButton);
  const advancedNodes = ['platform-page-metadata', 'platform-page-audience', 'platform-page-permissions', 'platform-page-design', 'platform-page-seo', 'platform-settings-visibility'].map($).filter(Boolean);
  advancedNodes.forEach((node) => { if (!node.dataset.intelligenceManaged) { node.dataset.intelligenceManaged = 'true'; } });
})();
