(() => {
  'use strict';
  if (typeof isPlatformAdmin !== 'function' || !isPlatformAdmin() || typeof window.panelRequestJson !== 'function') return;
  const $ = (id) => document.getElementById(id);
  const status = $('activator-status');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const call = (endpoint, body, timeoutMs = 30000) => window.panelRequestJson(endpoint, { method:'POST', body:JSON.stringify(body), timeoutMs, retry:true });
  const packages = { standard:{label:'Standard',features:['Dashboard și Pontaj','Contracte','Rapoarte','Marketplace legal','Resurse legale','Anunțuri angajați','Învoiri angajați','Disciplină angajați','Evenimente']}, operations:{label:'Operations',features:['Dashboard','Anunțuri organizație','Învoiri organizație','Disciplină organizație','Acțiuni organizație','Calculator ilegal','Marketplace ilegal','Locații ilegale','Minigames']}, full:{label:'Full',features:['Toate modulele Panel Pro','Marketplace legal și ilegal','Stash','Contracte și cereri','Disciplină și acțiuni','Rapoarte și Status Live']} };
  let catalog = {organizations:[],guilds:[]};
  const setStatus = (message, error = false) => { status.textContent = message; status.className = `status ${error?'error':'ok'}`; };
  const selectedOrg = () => catalog.organizations.find((org) => String(org.id) === String($('organization-select')?.value));
  // Operations include atât module de organizație, cât și module operaționale;
  // presetul complet este singurul care nu omite vreunul dintre ele.
  const bundleForPackage = { standard: 'legal_management', operations: 'operations', full: 'full' };
  const isNewMode = () => $('organization-mode')?.value === 'new';
  const organizationGuilds = () => catalog.guilds.filter((guild) => String(guild.organization_id) === String($('organization-select')?.value || ''));
  const renderGuilds = () => {
    const guilds = organizationGuilds();
    const field = $('guild-field');
    const select = $('guild-select');
    field.hidden = guilds.length <= 1;
    select.innerHTML = guilds.length > 1 ? '<option value="">Alege serverul Discord…</option>' : '';
    guilds.forEach((guild) => { const label = guild.kind === 'secondary' ? 'Organizație' : 'Angajați'; select.insertAdjacentHTML('beforeend', `<option value="${esc(guild.guild_id)}">${esc(guild.guild_name || guild.guild_id)} · ${label}</option>`); });
    if (guilds.length === 1) select.value = String(guilds[0].guild_id);
    $('guild-help').textContent = guilds.length > 1 ? 'Organizația are mai multe servere. Alege unde se aplică activarea.' : guilds.length === 1 ? `Server detectat automat: ${guilds[0].guild_name || guilds[0].guild_id}.` : 'Nu există un server Discord configurat pentru această organizație.';
    updateSummary();
  };
  const updateSummary = () => { const newMode = isNewMode(); const org = selectedOrg(); const pkg = packages[$('package-select')?.value] || packages.standard; const duration = $('duration-select')?.value || '30'; const guild = $('guild-select')?.selectedOptions?.[0]?.textContent || 'Se detectează automat'; const guildCount = organizationGuilds().length; const newName = $('new-organization-name')?.value?.trim() || 'Nespecificată'; const newPrimary = $('new-primary-guild')?.value?.trim(); const newSecondary = $('new-secondary-guild')?.value?.trim(); const discord = newMode ? (newPrimary ? (newSecondary ? 'Angajați + Organizație' : 'Angajați') : 'Lipsește serverul Angajați') : guildCount > 1 ? 'Angajați + Organizație' : guildCount === 1 ? guild : 'Lipsește serverul'; $('summary').innerHTML = `<div class="summary-row"><span>Organizație</span><strong>${esc(newMode ? newName : org?.name || 'Neselectată')}</strong></div><div class="summary-row"><span>Pachet</span><strong>${esc(pkg.label)}</strong></div><div class="summary-row"><span>Acces</span><strong>${duration === 'unlimited' ? 'Nelimitat' : `${esc(duration)} zile`}</strong></div><div class="summary-row"><span>Discord</span><strong>${esc(discord)}</strong></div><div class="summary-row"><span>Configurare</span><strong>${guildCount > 1 || (newMode && newSecondary) ? 'Separat pe ambele servere' : 'Automată pe serverul selectat'}</strong></div>`; $('feature-list').innerHTML = pkg.features.map((feature) => `<span class="feature">${esc(feature)}</span>`).join(''); };
  const validateActivation = (showResult = true) => {
    const newMode = isNewMode(), packageCode = $('package-select').value, duration = $('duration-select').value, errors = [], checks = [];
    const organizationId = $('organization-select').value, existingGuilds = organizationGuilds();
    const name = $('new-organization-name').value.trim(), primary = $('new-primary-guild').value.trim(), secondary = $('new-secondary-guild').value.trim();
    if (newMode) {
      if (name.length < 2) errors.push('Numele organizației trebuie să aibă cel puțin 2 caractere.');
      if (!/^\d{15,22}$/.test(primary)) errors.push('Guild ID-ul pentru serverul Angajați este invalid sau lipsește.');
      if (secondary && (!/^\d{15,22}$/.test(secondary) || secondary === primary)) errors.push('Guild ID-ul pentru serverul Organizație este invalid sau identic cu primul.');
      checks.push(`Organizație nouă: ${name || 'necompletată'}`);
    } else {
      if (!organizationId || !selectedOrg()) errors.push('Selectează organizația existentă.');
      if (!existingGuilds.length) errors.push('Organizația nu are niciun server Discord configurat.');
      checks.push(`Organizație selectată: ${selectedOrg()?.name || 'necompletată'}`);
    }
    const guildCount = newMode ? (secondary ? 2 : primary ? 1 : 0) : existingGuilds.length;
    if (guildCount > 1 && packageCode !== 'full') errors.push('Două servere Discord sunt disponibile doar pentru pachetul Full.');
    if (!['7','30','90','365','unlimited'].includes(duration)) errors.push('Durata selectată nu este validă.');
    checks.push(`Servere Discord: ${guildCount} · pachet ${packages[packageCode]?.label || packageCode}`);
    checks.push(`Acces: ${duration === 'unlimited' ? 'nelimitat' : `${duration} zile`}`);
    const host = $('preflight-results');
    if (showResult && host) { host.hidden = false; host.className = `notice ${errors.length ? 'status error' : 'status ok'}`; host.innerHTML = `<strong>${errors.length ? 'Verificarea a găsit probleme' : 'Verificare reușită — nu s-a modificat nimic'}</strong><ul style="margin:8px 0 0 18px;list-style:disc">${[...errors, ...checks.map((item) => errors.length ? `Verificat: ${item}` : `✓ ${item}`)].map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`; }
    return !errors.length;
  };
  const load = async () => { try { const result = await call('manage-panel-modules',{action:'catalog'}); catalog = {organizations:result.organizations||[],guilds:result.guilds||[]}; $('organization-select').innerHTML = '<option value="">Alege organizația…</option>' + catalog.organizations.map((org) => `<option value="${esc(org.id)}">${esc(org.name)}</option>`).join(''); renderGuilds(); setStatus(`${catalog.organizations.length} organizații disponibile.`); } catch (error) { setStatus(error?.message || 'Nu am putut încărca organizațiile.', true); } };
  const syncMode = () => { const newMode = isNewMode(); $('organization-select').hidden = newMode; $('new-organization-fields').hidden = !newMode; $('guild-field').hidden = newMode || organizationGuilds().length <= 1; $('activate-button').textContent = newMode ? '⚡ Creează și activează' : '⚡ Activează organizația'; updateSummary(); };
  const activate = async () => { const newMode = isNewMode(); let organizationId = $('organization-select').value; const packageCode = $('package-select').value; const duration = $('duration-select').value; const existingGuilds = organizationGuilds(); const primaryGuild = $('new-primary-guild').value.trim(); const secondaryGuild = $('new-secondary-guild').value.trim(); if (!validateActivation(true)) return setStatus('Corectează problemele afișate înainte de activare.', true); if (!window.confirm(newMode ? 'Creezi și activezi organizația cu setările afișate?' : 'Activezi organizația și configurezi automat toate modulele?')) return; const button = $('activate-button'); button.disabled = true; try { setStatus(newMode ? 'Se creează organizația…' : 'Se activează organizația…'); const unlimited = duration === 'unlimited'; const expiresAt = unlimited ? null : new Date(Date.now() + Number(duration) * 86400000).toISOString(); let targetGuilds = newMode ? [{ guild_id: primaryGuild, kind: 'primary' }] : existingGuilds.map((guild) => ({ guild_id: String(guild.guild_id), kind: guild.kind === 'secondary' ? 'secondary' : 'primary' })); if (newMode && secondaryGuild) targetGuilds.push({ guild_id: secondaryGuild, kind: 'secondary' }); if (newMode) { const created = await call('manage-organizations',{action:'save',organization:{name:$('new-organization-name').value.trim(),active:false},guilds:targetGuilds,access:{expires_at:expiresAt}}); organizationId = created.organization_id; } await call('manage-organizations',{action:'set_package',organization_id:organizationId,package_code:packageCode,unlimited,expires_at:expiresAt}); await call('manage-organizations',{action:'set_access',organization_id:organizationId,active:true,expires_at:expiresAt}); setStatus('Se configurează separat serverele Angajați și Organizație…'); let channels = 0; let messages = 0; for (const targetGuild of targetGuilds) { const result = await call('manage-discord-bundles',{action:'install_bundle',bundle_key:bundleForPackage[packageCode] || 'full',organization_id:organizationId,guild_id:targetGuild.guild_id,publish_embeds:true,initialize_embeds:true},60000); channels += Number(result.created?.channels || 0); messages += Number(result.created?.messages || 0); } setStatus(`${newMode ? 'Organizația a fost creată și activată' : 'Activarea a fost finalizată'}: ${packages[packageCode].label}, ${unlimited?'nelimitat':duration+' zile'}. ${targetGuilds.length} server${targetGuilds.length === 1 ? '' : 'e'} configurat${targetGuilds.length === 1 ? '' : 'e'}, ${channels} canale și ${messages} embeduri inițializate sau actualizate.`, false); if (newMode) { await load(); $('organization-mode').value = 'existing'; syncMode(); $('organization-select').value = organizationId; renderGuilds(); } } catch (error) { setStatus(error?.message || 'Activarea nu a putut fi finalizată.', true); } finally { button.disabled = false; } };
  $('organization-mode').addEventListener('change',syncMode); $('organization-select').addEventListener('change',renderGuilds); ['package-select','duration-select','guild-select','new-organization-name','new-primary-guild','new-secondary-guild'].forEach((id) => $(id).addEventListener('input',updateSummary)); $('package-select').addEventListener('change',updateSummary); $('duration-select').addEventListener('change',updateSummary); $('preflight-button').addEventListener('click',() => validateActivation(true)); $('activate-button').addEventListener('click',activate); $('refresh-button').addEventListener('click',load); syncMode(); updateSummary(); load();
})();
