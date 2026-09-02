(() => {
  'use strict';
  const PAGE = 'organizatie-evenimente.html';
  const LOCAL_KEY = 'panel_local_organization_events';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
  const dateValue = (value) => new Date(`${value}T00:00:00Z`);
  const daysElapsed = (value) => Math.floor((dateValue(todayLocal()).getTime() - dateValue(value).getTime()) / 86400000);
  const dateLabel = (value) => value ? new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeZone: 'Europe/Bucharest' }).format(dateValue(value)) : '—';
  const EVENT_TYPES = Object.freeze({ car_meet: 'Car Meet', convoy: 'Convoy', race: 'Cursă / Race', party: 'Petrecere', community: 'Eveniment comunitar', roleplay: 'Eveniment RP', other: 'Alt eveniment' });
  const eventTypeLabel = (value) => EVENT_TYPES[String(value || 'other')] || EVENT_TYPES.other;
  const localEvents = () => { try { const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
  const saveLocalEvents = (events) => localStorage.setItem(LOCAL_KEY, JSON.stringify(events));
  let events = [], reminders = [], canWrite = false, localMode = false, editingId = '';

  function state(event) {
    if (event.status === 'archived') return { key: 'archived', label: 'Arhivat', tone: 'slate', remaining: null };
    const elapsed = daysElapsed(event.event_date);
    if (elapsed < 0) return { key: 'future', label: `Urmează în ${Math.abs(elapsed)} ${Math.abs(elapsed) === 1 ? 'zi' : 'zile'}`, tone: 'indigo', remaining: 14 };
    if (elapsed >= 14 || event.status === 'completed') return { key: 'completed', label: 'Perioada încheiată', tone: 'amber', remaining: 0 };
    return { key: 'active', label: `Mai sunt ${14 - elapsed} ${14 - elapsed === 1 ? 'zi' : 'zile'}`, tone: 'emerald', remaining: 14 - elapsed };
  }
  function statusClasses(tone) { return ({ emerald: 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300', amber: 'border-amber-700/60 bg-amber-950/30 text-amber-200', indigo: 'border-indigo-700/60 bg-indigo-950/30 text-indigo-200', slate: 'border-slate-700 bg-slate-950 text-slate-400' })[tone] || 'border-slate-700 bg-slate-950 text-slate-400'; }
  function localReminders(event) {
    const elapsed = daysElapsed(event.event_date);
    if (elapsed < 0 || elapsed > 14) return [];
    return [{ id: `local-${event.id}-${todayLocal()}`, event_id: event.id, reminder_date: todayLocal(), days_remaining: 14 - elapsed, status: 'preview', sent_at: null }];
  }
  async function api(action, payload = {}) {
    return window.panelRequestJson('manage-organization-events', { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  }
  function setMode(remote) {
    localMode = !remote;
    $('mode-badge').textContent = remote ? 'Supabase conectat' : 'Mod local de test';
    $('mode-badge').className = `rounded-full border px-3 py-1.5 text-xs font-bold ${remote ? 'border-emerald-700/70 bg-emerald-950/40 text-emerald-200' : 'border-amber-700/70 bg-amber-950/40 text-amber-200'}`;
    $('mode-note').innerHTML = remote ? 'Datele sunt salvate în Supabase și pot fi consultate de managerii care au acces la această organizație. Reminderul real va fi trimis de jobul programat din Supabase.' : 'Supabase nu are încă migrarea sau funcția publicată, așa că pagina rulează în mod local. Evenimentele rămân salvate în acest browser, iar butonul de test afișează simularea. După aplicarea migrației și publicarea funcțiilor, aceleași butoane vor folosi datele reale.';
  }
  async function load() {
    try {
      const result = await api('list');
      events = result.events || []; reminders = result.reminders || []; canWrite = result.can_write === true; setMode(true);
    } catch (error) {
      if ([401, 403].includes(Number(error.status))) {
        canWrite = false; events = []; reminders = []; localMode = false; setMode(true);
        $('event-form-card').classList.remove('hidden'); $('event-form').classList.add('hidden'); $('read-only-note').classList.remove('hidden');
        $('mode-note').textContent = error.message || 'Nu ai acces la această pagină.';
        render(); return;
      }
      events = localEvents(); reminders = []; canWrite = true; setMode(false);
      $('form-status').textContent = `Mod local: ${error.message || 'backend indisponibil'}`;
    }
    $('event-form-card').classList.remove('hidden');
    $('event-form').classList.toggle('hidden', !canWrite && localMode === false);
    $('read-only-note').classList.toggle('hidden', canWrite);
    render();
  }
  function renderStats() {
    const active = events.filter((event) => state(event).key === 'active' || state(event).key === 'future');
    $('stat-active').textContent = active.length;
    $('stat-history').textContent = events.length;
    const next = active.map((event) => ({ event, day: event.event_date })).sort((a, b) => a.day.localeCompare(b.day))[0];
    $('stat-next').textContent = next ? `${dateLabel(next.day)} · ${next.event.title}` : 'Niciun reminder planificat';
  }
  function render() {
    renderStats();
    $('events-list').innerHTML = events.length ? events.map((event) => {
      const current = state(event);
      const log = (localMode ? localReminders(event) : reminders.filter((item) => String(item.event_id) === String(event.id))).sort((a, b) => String(b.reminder_date).localeCompare(String(a.reminder_date)));
      const actions = canWrite ? `<div class="flex flex-wrap gap-2"><button type="button" data-edit="${esc(event.id)}" class="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Editează</button>${current.key !== 'archived' ? `<button type="button" data-archive="${esc(event.id)}" class="rounded-lg border border-amber-800/70 px-3 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-950/50">Arhivează</button>` : ''}<button type="button" data-delete="${esc(event.id)}" class="rounded-lg border border-rose-800/70 px-3 py-2 text-[11px] font-bold text-rose-200 hover:bg-rose-950/50">Șterge</button><button type="button" data-test="${esc(event.id)}" class="rounded-lg border border-cyan-700/70 px-3 py-2 text-[11px] font-bold text-cyan-200 hover:bg-cyan-950/50">${localMode ? 'Simulează reminderul' : 'Testează webhookul'}</button></div>` : '';
      return `<article class="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:p-5"><div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full border border-cyan-700/60 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-bold text-cyan-200">${esc(eventTypeLabel(event.event_type))}</span><span class="rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClasses(current.tone)}">${esc(current.label)}</span></div><h3 class="mt-3 text-base font-black text-white">${esc(event.title)}</h3><p class="mt-2 text-xs text-slate-400">📅 ${esc(dateLabel(event.event_date))}${current.remaining !== null ? ` · ${current.remaining === 0 ? 'Ziua 14' : `ziua ${14 - current.remaining} din 14`}` : ''}</p>${event.details ? `<p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">${esc(event.details)}</p>` : ''}${event.evidence_url ? `<a class="mt-3 inline-flex max-w-full items-center gap-2 truncate text-xs font-bold text-cyan-300 hover:text-cyan-200" href="${esc(event.evidence_url)}" target="_blank" rel="noopener noreferrer">🔗 Deschide dovada</a>` : ''}</div>${actions}</div><details class="mt-4 border-t border-slate-800 pt-3"><summary class="cursor-pointer text-xs font-bold text-slate-400">Jurnal remindere (${log.length})</summary><div class="mt-3 space-y-2">${log.length ? log.map((item) => `<div class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs"><span>${esc(dateLabel(item.reminder_date))} · ${item.days_remaining === 0 ? '0 zile rămase' : `${item.days_remaining} ${item.days_remaining === 1 ? 'zi' : 'zile'} rămase`}</span><span class="${item.status === 'sent' ? 'text-emerald-300' : item.status === 'failed' ? 'text-rose-300' : 'text-slate-400'}">${esc(item.status === 'sent' ? 'Trimis' : item.status === 'failed' ? 'Eșuat' : localMode ? 'Simulare locală' : item.status)}</span></div>`).join('') : '<p class="text-xs text-slate-500">Nu există încă remindere înregistrate.</p>'}</div></details></article>`;
    }).join('') : '<p class="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400">Nu există încă evenimente. Adaugă primul eveniment pentru a începe istoricul.</p>';
  }
  function resetForm() { editingId = ''; $('event-form').reset(); $('event-type').value = ''; $('event-date').value = todayLocal(); $('form-title').textContent = 'Adaugă un eveniment'; $('save-event').textContent = 'Salvează evenimentul'; $('cancel-edit').classList.add('hidden'); }
  function fillForm(event) { editingId = String(event.id); $('event-title').value = event.title || ''; $('event-type').value = EVENT_TYPES[event.event_type] ? event.event_type : 'other'; $('event-date').value = event.event_date || todayLocal(); $('event-details').value = event.details || ''; $('event-evidence').value = event.evidence_url || ''; $('form-title').textContent = 'Editează evenimentul'; $('save-event').textContent = 'Salvează modificările'; $('cancel-edit').classList.remove('hidden'); window.scrollTo({ top: $('event-form-card').offsetTop - 24, behavior: 'smooth' }); }
  async function saveEvent(event) {
    const payload = { title: $('event-title').value.trim(), event_type: $('event-type').value, event_date: $('event-date').value, details: $('event-details').value.trim(), evidence_url: $('event-evidence').value.trim() };
    if (!payload.event_type) throw new Error('Alege tipul evenimentului.');
    if (localMode) { const saved = { ...payload, id: editingId || `local-${Date.now()}`, organization_id: 'local', status: 'active', created_by_discord_id: 'local', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; events = editingId ? events.map((item) => String(item.id) === editingId ? { ...item, ...saved } : item) : [saved, ...events]; saveLocalEvents(events); $('form-status').textContent = 'Eveniment salvat local.'; resetForm(); render(); return; }
    const result = await api(editingId ? 'update' : 'create', editingId ? { id: editingId, ...payload } : payload);
    if (editingId) events = events.map((item) => String(item.id) === editingId ? result.event : item); else events = [result.event, ...events];
    const notification = result.notification || {};
    $('form-status').textContent = notification.status === 'sent' && notification.starts_in_days > 0
      ? `Evenimentul a fost salvat și postat pe Discord (${notification.sent || 0} destinații). Reminderele zilnice încep în ${notification.starts_in_days} ${notification.starts_in_days === 1 ? 'zi' : 'zile'}, la data evenimentului.`
      : notification.status === 'sent'
        ? `Evenimentul a fost salvat și notificarea a fost trimisă pe Discord (${notification.sent || 0} destinații).`
        : notification.status === 'already_sent'
          ? 'Evenimentul a fost salvat. Notificarea de astăzi fusese deja trimisă.'
          : notification.status === 'outside_window'
            ? 'Evenimentul a fost salvat, dar data este în afara perioadei de remindere de 14 zile.'
            : `Evenimentul a fost salvat, dar notificarea Discord nu a fost trimisă: ${notification.error || 'destinația nu este configurată.'}`;
    resetForm(); render();
  }
  $('event-form').addEventListener('submit', async (event) => { event.preventDefault(); $('save-event').disabled = true; $('form-status').textContent = 'Se salvează…'; try { await saveEvent(event); } catch (error) { $('form-status').textContent = error.message || 'Salvarea a eșuat.'; } finally { $('save-event').disabled = false; } });
  $('cancel-edit').onclick = resetForm;
  $('refresh-events').onclick = load;
  $('events-list').addEventListener('click', async (event) => {
    const editId = event.target.closest('[data-edit]')?.dataset.edit; const archiveId = event.target.closest('[data-archive]')?.dataset.archive; const deleteId = event.target.closest('[data-delete]')?.dataset.delete; const testId = event.target.closest('[data-test]')?.dataset.test;
    if (editId) { const item = events.find((value) => String(value.id) === String(editId)); if (item) fillForm(item); return; }
    if (archiveId) { if (!confirm('Arhivezi evenimentul? Va rămâne în istoric și nu va mai primi remindere.')) return; try { if (localMode) { events = events.map((item) => String(item.id) === String(archiveId) ? { ...item, status: 'archived', archived_at: new Date().toISOString() } : item); saveLocalEvents(events); } else { const result = await api('archive', { id: archiveId }); events = events.map((item) => String(item.id) === String(archiveId) ? result.event : item); } render(); } catch (error) { alert(error.message || 'Arhivarea a eșuat.'); } return; }
    if (deleteId) { if (!confirm('Ștergi definitiv evenimentul? Evenimentul și jurnalul reminderelor vor fi eliminate și acțiunea nu poate fi anulată.')) return; try { if (localMode) { events = events.filter((item) => String(item.id) !== String(deleteId)); saveLocalEvents(events); } else { await api('delete', { id: deleteId }); events = events.filter((item) => String(item.id) !== String(deleteId)); } if (editingId === String(deleteId)) resetForm(); render(); } catch (error) { alert(error.message || 'Ștergerea a eșuat.'); } return; }
    if (testId) { try { if (localMode) { const item = events.find((value) => String(value.id) === String(testId)); const current = item ? state(item) : null; const futureText = item && current?.key === 'future' ? `Reminderul va începe peste ${Math.abs(daysElapsed(item.event_date))} zile.` : `${current?.remaining ?? 0} zile rămase până la împlinirea celor 14 zile.`; alert(item ? `Simulare locală\n\n${item.title}\n${futureText}\n\nÎn modul real, acest mesaj ar fi trimis pe webhook.` : 'Evenimentul nu mai există.'); } else { const result = await api('send_test', { id: testId }); alert(`Test trimis pe ${result.sent || 0} webhook${result.sent === 1 ? '' : '-uri'}.`); } } catch (error) { alert(error.message || 'Testul webhookului a eșuat.'); } }
  });
  resetForm(); load();
})();
