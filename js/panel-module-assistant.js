(() => {
  'use strict';

  const root = document.getElementById('panel-module-assistant');
  if (!root || typeof isPlatformAdmin !== 'function' || !isPlatformAdmin()) return;

  const input = document.getElementById('panel-module-chat-input');
  const form = document.getElementById('panel-module-chat-form');
  const log = document.getElementById('panel-module-chat-log');
  const actions = document.getElementById('panel-module-chat-actions');
  const reset = document.getElementById('panel-module-assistant-reset');
  if (!input || !form || !log || !actions) return;

  const memoryKey = 'panel_pro_global_module_assistant_v1';
  const steps = ['goal', 'name', 'color', 'fields', 'buttons', 'result', 'access', 'confirm', 'done'];
  const state = {};
  let step = 'goal';

  try {
    const saved = JSON.parse(localStorage.getItem(memoryKey) || '{}');
    if (saved && typeof saved === 'object') {
      step = steps.includes(saved.step) ? saved.step : 'goal';
      Object.assign(state, saved.state || {});
    }
  } catch (_) { /* memoria local opțională */ }

  const saveMemory = () => {
    try { localStorage.setItem(memoryKey, JSON.stringify({ step, state, updatedAt: new Date().toISOString() })); } catch (_) { /* storage indisponibil */ }
  };
  const clearMemory = () => {
    try { localStorage.removeItem(memoryKey); } catch (_) { /* storage indisponibil */ }
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
  const say = (text, user = false) => {
    const line = document.createElement('div');
    line.className = `module-chat-line${user ? ' user' : ''}`;
    line.innerHTML = `<b>${user ? 'Tu' : 'Asistent'}:</b> ${text}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  };
  const normalized = (value) => String(value || '').toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const splitList = (value) => String(value || '').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  const typeOf = (value) => {
    const text = normalized(value);
    if (/aprobare|aproba|respinge|staff|manager|conduc/.test(text)) return 'approval';
    if (/recrut|aplica/.test(text)) return 'approval';
    if (/sondaj|vot/.test(text)) return 'request';
    if (/raport|statistic/.test(text)) return 'report';
    if (/anunt|comunicat|inform/.test(text)) return 'announcement';
    return 'request';
  };
  const typeLabel = { announcement: 'anunț', request: 'cerere / formular', approval: 'cerere cu aprobare', report: 'raport / statistici' };
  const colorMap = { verde:'#22c55e', albastru:'#3b82f6', rosu:'#ef4444', mov:'#8b5cf6', violet:'#8b5cf6', galben:'#f59e0b', cyan:'#06b6d4', gri:'#64748b' };

  const value = (id) => document.getElementById(id);
  const setValue = (id, next) => { const element = value(id); if (element) { element.value = next; element.dispatchEvent(new Event('input', { bubbles: true })); } };
  const setChecked = (id, next) => { const element = value(id); if (element) { element.checked = Boolean(next); element.dispatchEvent(new Event('change', { bubbles: true })); } };
  const clearActions = () => { actions.replaceChildren(); };
  const actionButton = (label, handler, kind = '') => { const button = document.createElement('button'); button.type = 'button'; button.className = `button ${kind}`; button.textContent = label; button.addEventListener('click', handler); actions.appendChild(button); return button; };

  const addButton = (label, action = 'open_form') => {
    value('add-module-button')?.click();
    const rows = [...document.querySelectorAll('[data-builder-button]')];
    const row = rows[rows.length - 1];
    if (!row) return;
    const labelInput = row.querySelector('[data-button-label]');
    const actionSelect = row.querySelector('[data-button-action]');
    if (labelInput) labelInput.value = label;
    if (actionSelect) actionSelect.value = action;
  };
  const addField = (label, index) => {
    value('add-module-field')?.click();
    const rows = [...document.querySelectorAll('[data-builder-field]')];
    const row = rows[rows.length - 1];
    if (!row) return;
    const idInput = row.querySelector('[data-field-id]');
    const labelInput = row.querySelector('[data-field-label]');
    const placeholder = row.querySelector('[data-field-placeholder]');
    if (idInput) idInput.value = String(label || `camp_${index + 1}`).toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || `camp_${index + 1}`;
    if (labelInput) labelInput.value = label;
    if (placeholder) placeholder.value = `Completează ${String(label || '').toLocaleLowerCase('ro-RO')}`;
  };
  const applyDraft = () => {
    value('module-new')?.click();
    setValue('module-key', `custom_${String(state.name || state.type || 'modul').toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 46)}_${Date.now().toString().slice(-4)}`);
    setValue('module-label', state.name || 'Modul nou');
    setValue('module-title', state.title || state.name || 'Modul Panel Pro');
    setValue('module-description', state.description || `Modul ${typeLabel[state.type] || 'personalizat'} configurat de administratorul global.`);
    setValue('module-color', state.color || '#5865f2');
    setValue('module-handler', state.type === 'announcement' ? 'announcement' : state.type === 'report' ? 'report' : state.type === 'approval' ? 'approval' : 'request');
    value('module-handler')?.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll('[data-builder-button], [data-builder-field]').forEach((row) => row.remove());
    const buttons = state.buttons?.length ? state.buttons : state.type === 'approval' ? ['Trimite spre aprobare'] : state.type === 'report' ? ['Generează raport'] : ['Trimite'];
    buttons.forEach((label) => addButton(label, state.type === 'report' ? 'report' : state.type === 'approval' ? 'open_form' : 'open_form'));
    (state.fields || []).forEach((label, index) => addField(label, index));
    setValue('module-response-button', state.responseMessage || 'Acțiunea a fost primită.');
    setValue('module-response-success', state.successMessage || 'Operațiunea a fost finalizată cu succes.');
    setValue('module-response-error', state.errorMessage || 'Operațiunea nu a putut fi finalizată.');
    setValue('module-response-review', state.reviewMessage || 'Cererea a fost trimisă spre verificare.');
    setChecked('module-slash-enabled', state.slash === true);
    value('module-preview')?.click();
  };

  const showConfirm = () => {
    clearActions();
    actionButton('✅ Creează draftul complet', () => { applyDraft(); step = 'done'; clearActions(); say('Draftul complet a fost creat în editor. Nu am publicat nimic. Poți cere modificări sau poți salva și publica manual.'); saveMemory(); });
    actionButton('✏️ Mai vreau să modific', () => { step = 'done'; clearActions(); say('Spune-mi ce vrei să modific: culoarea, numele, un buton, un câmp, mesajul de succes sau răspunsul privat/public.'); saveMemory(); }, 'cyan');
  };

  const process = (raw) => {
    const clean = String(raw || '').trim();
    const text = normalized(clean);
    if (!clean) return;
    say(escapeHtml(clean), true);
    if (/^(resetare|reseteaza|reset)( asistent| modul)?$/.test(text)) { clearMemory(); Object.keys(state).forEach((key) => delete state[key]); step = 'goal'; log.replaceChildren(); clearActions(); say('Am resetat conversația. Spune-mi ce vrei să construiască modulul.'); return; }

    if (step === 'goal') { state.type = typeOf(clean); state.raw = clean; step = 'name'; say(`Am identificat un modul de <b>${typeLabel[state.type]}</b>. Cum vrei să se numească?`); saveMemory(); return; }
    if (step === 'name') { state.name = clean; step = 'color'; say('Ce culoare vrei pentru embed? Spune o culoare (verde, albastru, mov, roșu) sau un cod HEX.'); saveMemory(); return; }
    if (step === 'color') { state.color = (clean.match(/#[0-9a-f]{6}/i) || [])[0] || colorMap[text] || '#5865f2'; step = 'fields'; say('Ce câmpuri trebuie completate? Scrie-le separate prin virgulă sau spune „fără câmpuri”.'); saveMemory(); return; }
    if (step === 'fields') { state.fields = /fara|niciun|nu are nevoie/.test(text) ? [] : splitList(clean); step = 'buttons'; say('Ce butoane vrei? Scrie-le separate prin virgulă sau spune „recomandă”.'); saveMemory(); return; }
    if (step === 'buttons') { state.buttons = /recomand|automat/.test(text) ? [] : splitList(clean); step = 'result'; say('Unde trebuie să ajungă rezultatul acțiunii: în canalul de rezultate/log, ca răspuns privat sau ambele?'); saveMemory(); return; }
    if (step === 'result') { state.resultMode = /privat|ephemeral/.test(text) ? 'private' : /ambele|amandoua/.test(text) ? 'both' : 'log'; state.responseMessage = state.resultMode === 'private' ? 'Răspunsul a fost trimis privat.' : 'Rezultatul a fost trimis în canalul configurat.'; step = 'access'; say('Cine poate folosi modulul: toți membrii, un rol configurat, managerii sau doar ownerul? Și este Gratuit sau Premium?'); saveMemory(); return; }
    if (step === 'access') { state.premium = /premium|platit/.test(text); state.permission = /owner/.test(text) ? 'owner' : /manager|conduc/.test(text) ? 'manager' : /rol/.test(text) ? 'mapped_role' : 'everyone'; state.slash = /slash|comanda/.test(text); step = 'confirm'; say(`Am pregătit un draft: <b>${escapeHtml(state.name)}</b>, tip ${typeLabel[state.type]}, ${state.fields?.length || 0} câmpuri, ${state.buttons?.length || 0} butoane, rezultat ${state.resultMode === 'private' ? 'privat' : 'în canalul configurat'}, acces ${state.premium ? 'Premium' : 'Gratuit'}. Confirmi?`); showConfirm(); saveMemory(); return; }
    if (step === 'confirm') { say('Alege „Creează draftul complet” sau spune ce vrei să schimb înainte de creare.'); return; }
    if (step === 'done') {
      let changed = false;
      const colorMatch = text.match(/(?:schimba|seteaza) (?:culoarea|colorarea) (?:in|la) ([a-z#0-9]+)/);
      if (colorMatch) { state.color = colorMatch[1].startsWith('#') ? colorMatch[1] : colorMap[colorMatch[1]] || state.color; setValue('module-color', state.color); changed = true; }
      const nameMatch = clean.match(/(?:schimba|seteaza) (?:numele|denumirea) (?:in|la) (.+)$/i);
      if (nameMatch) { state.name = nameMatch[1].trim(); setValue('module-label', state.name); changed = true; }
      const fieldMatch = clean.match(/(?:adauga|adaugă) (?:un )?camp(?:ul)?(?: numit)? (.+)$/i);
      if (fieldMatch) { addField(fieldMatch[1].trim(), document.querySelectorAll('[data-builder-field]').length); changed = true; }
      const buttonMatch = clean.match(/(?:adauga|adaugă) (?:un )?buton(?:ul)?(?: numit| cu numele)? (.+)$/i);
      if (buttonMatch) { addButton(buttonMatch[1].trim()); changed = true; }
      if (/raspuns privat|raspuns public|ephemeral/.test(text)) { state.resultMode = /privat|ephemeral/.test(text) ? 'private' : 'log'; state.responseMessage = state.resultMode === 'private' ? 'Răspunsul a fost trimis privat.' : 'Rezultatul a fost trimis în canalul configurat.'; setValue('module-response-button', state.responseMessage); changed = true; }
      if (changed) { value('module-preview')?.click(); say('Am aplicat modificarea în editor. Mai poți cere ajustări sau poți salva draftul.'); saveMemory(); return; }
      say('Draftul este pregătit. Poți cere „schimbă numele în…”, „adaugă câmp…”, „adaugă buton…” sau poți salva modulul.');
    }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); const raw = input.value.trim(); if (!raw) return; input.value = ''; process(raw); });
  reset.addEventListener('click', () => { clearMemory(); Object.keys(state).forEach((key) => delete state[key]); step = 'goal'; log.replaceChildren(); clearActions(); say('Am resetat conversația. Spune-mi ce vrei să construiască modulul.'); });
  clearActions();
  if (step !== 'goal' && Object.keys(state).length) { say('Am reluat conversația de unde ai rămas. Poți continua sau apăsa „Resetare”.'); } else { say('Spune-mi ce vrei să facă modulul. Îți voi pune întrebările necesare și îl voi construi complet ca draft.'); }
  actionButton('📢 Anunț', () => { input.value = 'Vreau un anunț pentru comunitate'; form.requestSubmit(); });
  actionButton('✅ Cerere cu aprobare', () => { input.value = 'Vreau o cerere cu aprobare pentru staff'; form.requestSubmit(); });
  actionButton('📊 Raport', () => { input.value = 'Vreau un raport cu statistici'; form.requestSubmit(); });
})();
