(() => {
  'use strict';

  const state = { organizations: [], selectedId: '', audit: [], health: null, catalog: {}, administrators: [], canManageAdministrators: false, busy: false };
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const date = (value) => value ? new Date(value).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  const shortDate = (value) => value ? new Date(value).toLocaleDateString('ro-RO') : 'Fără expirare';
  const statusElement = $('#organization-admin-status');
  const setStatus = (message, kind = '') => { statusElement.textContent = message; statusElement.className = `admin-status ${kind}`; };
  const toast = (message, isError = false) => {
    document.querySelector('.toast')?.remove();
    const item = document.createElement('div'); item.className = `toast${isError ? ' error' : ''}`; item.textContent = message; document.body.appendChild(item);
    window.setTimeout(() => item.remove(), 5000);
  };
  const selected = () => state.organizations.find((organization) => organization.id === state.selectedId) || null;
  const api = async (body) => {
    if (!localStorage.getItem('panel_session_token') && typeof window.ensurePanelSession === 'function') await window.ensurePanelSession();
    return window.panelRequestJson('manage-organizations', { method: 'POST', timeoutMs: 30000, body: JSON.stringify(body) });
  };
  const administratorApi = async (body) => {
    if (!localStorage.getItem('panel_session_token') && typeof window.ensurePanelSession === 'function') await window.ensurePanelSession();
    return window.panelRequestJson('manage-platform-administrators', { method: 'POST', timeoutMs: 30000, body: JSON.stringify(body) });
  };
  const statusFor = (organization) => organization?.health?.status || 'inactive';
  const statusLabel = (value) => ({ active: 'Activă', draft: 'Draft', expired: 'Expirată', inactive: 'Inactivă' }[value] || value);
  const issueLabel = (organization) => Number(organization?.health?.issueCount || 0) ? `${organization.health.issueCount} problem${organization.health.issueCount === 1 ? 'ă' : 'e'}` : 'Configurație OK';
  const packageLabel = (organization) => organization?.package?.code === 'full' ? 'Full' : 'Standard';
  const featureEditor = (organization) => {
    const features = new Set(organization.package?.features || []);
    const entries = Object.entries(state.catalog);
    if (!entries.length) return '';
    const options = entries.map(([key, meta]) => `<label class="detail-stat flex items-start gap-2"><input type="checkbox" data-package-feature="${esc(key)}" ${features.has(key) ? 'checked' : ''} disabled><span><strong>${esc(meta.label)}</strong><small class="block mt-1 text-slate-400">${meta.standard ? 'Inclus în Standard' : 'Disponibil doar în Full'}</small></span></label>`).join('');
    return `<section class="detail-section"><h3>Module și pachete</h3><p class="mt-1 text-xs text-slate-400">Standard include toată partea legală și modulele pentru angajați. Full adaugă partea de organizație/mafia și modulele ilegale. Modulele Full nu pot fi activate individual pe Standard.</p><div class="detail-grid"><label class="detail-stat"><span>Pachet</span><select id="package-code-editor" class="field mt-2"><option value="standard" ${organization.package?.code !== 'full' ? 'selected' : ''}>Standard · legal + angajați</option><option value="full" ${organization.package?.code === 'full' ? 'selected' : ''}>Full · Standard + organizație/mafia</option></select></label>${options}</div><button class="button small primary" type="button" data-action="save-package">Salvează pachetul</button></section>`;
  };
  const filteredOrganizations = () => {
    const query = String($('#organization-search')?.value || '').trim().toLowerCase();
    const status = $('#organization-status-filter')?.value || 'all';
    const packageCode = $('#organization-package-filter')?.value || 'all';
    const issuesOnly = Boolean($('#organization-issues-only')?.checked);
    const result = state.organizations.filter((organization) => {
      const haystack = [organization.name, organization.slug, organization.code, ...(organization.guilds || []).map((guild) => guild.guild_id)].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (status === 'all' || statusFor(organization) === status) && (packageCode === 'all' || packageLabel(organization).toLowerCase() === packageCode) && (!issuesOnly || Number(organization.health?.issueCount || 0) > 0);
    });
    const sort = $('#organization-sort')?.value || 'name';
    return result.sort((a, b) => sort === 'updated' ? String(b.updated_at || '').localeCompare(String(a.updated_at || '')) : sort === 'expiry' ? String(a.access?.expires_at || '9999').localeCompare(String(b.access?.expires_at || '9999')) : sort === 'activity' ? Number(b.metrics?.active_sessions || 0) - Number(a.metrics?.active_sessions || 0) : String(a.name || '').localeCompare(String(b.name || ''), 'ro'));
  };
  const renderKpis = () => {
    const organizations = state.organizations;
    const active = organizations.filter((item) => statusFor(item) === 'active').length;
    const drafts = organizations.filter((item) => statusFor(item) === 'draft').length;
    const expired = organizations.filter((item) => statusFor(item) === 'expired').length;
    const issues = organizations.filter((item) => Number(item.health?.issueCount || 0) > 0).length;
    const members = organizations.reduce((sum, item) => sum + Number(item.metrics?.members || 0), 0);
    const sessions = organizations.reduce((sum, item) => sum + Number(item.metrics?.active_sessions || 0), 0);
    const cards = [['Total', organizations.length, ''], ['Active', active, ''], ['Drafturi', drafts, 'warning'], ['Expirate', expired, 'danger'], ['Probleme', issues, issues ? 'warning' : ''], ['Membri / sesiuni', `${members} / ${sessions}`, '']];
    $('#organization-admin-kpis').innerHTML = cards.map(([label, value, className]) => `<div class="kpi ${className}"><span>${label}</span><strong>${esc(value)}</strong></div>`).join('');
  };
  const renderPlatformAdministrators = () => {
    const section = $('#platform-admin-management');
    const list = $('#platform-admin-list');
    const status = $('#platform-admin-management-status');
    const form = $('#platform-admin-form');
    if (!section || !list || !status) return;
    section.hidden = false;
    form.hidden = !state.canManageAdministrators;
    status.textContent = state.canManageAdministrators
      ? 'Ești proprietarul platformei. Poți acorda sau revoca accesul administratorilor delegați.'
      : 'Ai acces de administrator delegat. Lista este vizibilă, însă acordarea și revocarea rămân rezervate proprietarului platformei.';
    list.innerHTML = state.administrators.length
      ? state.administrators.map((administrator) => `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3"><div><strong class="block text-sm text-slate-100">${esc(administrator.display_name || 'Administrator delegat')}</strong><span class="text-xs text-slate-400">Discord ID: ${esc(administrator.discord_id)} · adăugat ${esc(date(administrator.created_at))}</span></div><div class="flex items-center gap-2"><span class="badge ${administrator.active ? 'active' : 'inactive'}">${administrator.active ? 'Activ' : 'Revocat'}</span>${state.canManageAdministrators && administrator.active ? `<button type="button" class="button small danger" data-platform-admin-revoke="${esc(administrator.discord_id)}">Revocă accesul</button>` : ''}</div></div>`).join('')
      : '<div class="empty-state">Nu există administratori delegați.</div>';
  };
  const loadPlatformAdministrators = async () => {
    try {
      const result = await administratorApi({ action: 'list' });
      state.administrators = Array.isArray(result.administrators) ? result.administrators : [];
      state.canManageAdministrators = result.can_manage === true;
      renderPlatformAdministrators();
    } catch (error) {
      const section = $('#platform-admin-management');
      if (section) section.hidden = true;
    }
  };
  const renderList = () => {
    const list = filteredOrganizations(); $('#organization-count').textContent = `${list.length} rezultat${list.length === 1 ? '' : 'e'}`;
    $('#organization-list').innerHTML = list.length ? list.map((organization) => {
      const status = statusFor(organization); const selectedClass = organization.id === state.selectedId ? ' selected' : ''; const issue = Number(organization.health?.issueCount || 0) > 0;
      return `<article class="org-card${selectedClass}" data-organization-id="${esc(organization.id)}" tabindex="0"><div class="org-card-top"><div class="org-name">${esc(organization.name)}</div><span class="badge ${status}">${statusLabel(status)}</span></div><div class="org-meta">${esc(organization.slug || 'fără slug')} · actualizată ${esc(date(organization.updated_at))}</div><div class="org-stats"><span class="stat-pill">📦 ${esc(packageLabel(organization))}</span><span class="stat-pill">🛡️ ${organization.guilds?.length || 0} guild</span><span class="stat-pill">🎭 ${organization.roles?.length || 0} roluri</span><span class="stat-pill">👥 ${organization.metrics?.members || 0} membri</span><span class="stat-pill">⏱️ ${organization.metrics?.active_shifts || 0} ture</span>${issue ? `<span class="badge issue">⚠ ${esc(issueLabel(organization))}</span>` : '<span class="badge active">✓ Sănătoasă</span>'}</div></article>`;
    }).join('') : '<div class="empty-state">Nu există organizații pentru filtrele curente.</div>';
  };
  const renderDetail = () => {
    const organization = selected();
    if (!organization) { $('#organization-detail').innerHTML = '<div class="detail-empty">Selectează o organizație din registru pentru a vedea toate opțiunile.</div>'; return; }
    const status = statusFor(organization); const health = organization.health || {}; const routes = health.webhooks || {};
    const guildTags = (organization.guilds || []).map((guild) => `<span class="tag">${esc(guild.guild_name || guild.guild_id)} · ${esc(guild.kind || 'primary')}</span>`).join('') || '<span class="tag">Niciun guild configurat</span>';
    const roleTags = (organization.roles || []).slice(0, 16).map((role) => `<span class="tag">${esc(role.panel_role || role.discord_role_name || role.discord_role_id)}</span>`).join('') || '<span class="tag">Niciun rol configurat</span>';
    const audit = state.audit.length ? state.audit.map((event) => `<div class="audit-item"><strong>${esc(event.action)}</strong> · ${esc(date(event.created_at))}<br><span>${esc(event.actor_discord_id || 'platform-admin')}</span></div>`).join('') : '<div class="empty-state">Încarcă auditul organizației pentru detalii.</div>';
    $('#organization-detail').innerHTML = `<div class="detail-title"><div><h2>${esc(organization.name)}</h2><p>${esc(organization.id)} · ${esc(organization.slug || 'fără slug')}</p></div><span class="badge ${status}">${statusLabel(status)}</span></div><div class="detail-grid"><div class="detail-stat"><span>Acces până la</span><strong>${esc(shortDate(organization.access?.expires_at))}</strong></div><div class="detail-stat"><span>Pachet</span><strong>${esc(packageLabel(organization))}${organization.package?.unlimited ? ' · nelimitat' : ''}</strong></div><div class="detail-stat"><span>Membri activi</span><strong>${organization.metrics?.members || 0}</strong></div><div class="detail-stat"><span>Sesiuni active</span><strong>${organization.metrics?.active_sessions || 0}</strong></div><div class="detail-stat"><span>Ture active</span><strong>${organization.metrics?.active_shifts || 0}</strong></div><div class="detail-stat"><span>Absențe curente</span><strong>${organization.metrics?.active_absences || 0}</strong></div></div><section class="detail-section"><h3>Configurare Discord și acces</h3><div class="tag-list">${guildTags}</div><div class="tag-list">${roleTags}</div><div class="health-result"><div class="health-row"><span>Guilduri configurate</span><strong>${health.guildsConfigured || 0}</strong></div><div class="health-row"><span>Roluri configurate</span><strong>${health.rolesConfigured || 0}</strong></div><div class="health-row"><span>Client ID / URL public</span><strong>${health.hasClientId ? '✓' : '⚠'} / ${health.hasPublicUrl ? '✓' : '⚠'}</strong></div><div class="health-row"><span>Webhook-uri configurate</span><strong>${routes.configured || 0} · lipsă ${routes.missing || 0} · invalide ${routes.invalid || 0}</strong></div><div class="health-row"><span>Ultima activitate</span><strong>${esc(organization.metrics?.last_audit ? date(organization.metrics.last_audit.created_at) : '—')}</strong></div></div></section>${featureEditor(organization)}<section class="detail-section"><h3>Acțiuni administrative</h3><div class="action-grid"><a class="button small" href="organizatii.html?organization=${encodeURIComponent(organization.id)}">✎ Deschide editorul</a><button class="button small" data-action="health">🩺 Verifică Discord</button>${status === 'draft' ? '<button class="button small primary" data-action="publish">🚀 Publică draftul</button>' : ''}<button class="button small" data-action="extend" data-days="7">+7 zile</button><button class="button small" data-action="extend" data-days="30">+30 zile</button><button class="button small" data-action="extend" data-days="90">+90 zile</button><button class="button small" data-action="custom-date">Alege data</button><button class="button small" data-action="no-expiry">Fără expirare</button><button class="button small" data-action="toggle">${status === 'active' ? '⏸ Dezactivează' : '▶ Activează'}</button><button class="button small warning" data-action="sessions">Revocă sesiunile</button><button class="button small" data-action="audit">Încarcă audit</button><button class="button small danger" data-action="delete">Șterge organizația</button></div><div id="organization-health-result"></div></section><section class="detail-section"><h3>Audit organizație</h3><div class="audit-list">${audit}</div></section>`;
  };
  const load = async (keepSelection = true) => {
    if (state.busy) return; state.busy = true; setStatus('Se încarcă registrul securizat…');
    try { const result = await api({ action: 'platform_overview' }); state.catalog = result.feature_catalog || state.catalog; state.organizations = Array.isArray(result.organizations) ? result.organizations : []; if (!keepSelection || !selected()) state.selectedId = state.organizations[0]?.id || ''; renderKpis(); renderList(); renderDetail(); setStatus(`Actualizat la ${date(result.generated_at)} · ${state.organizations.length} organizații`, 'ok'); loadPlatformAdministrators(); }
    catch (error) { setStatus(error.message || 'Registrul nu a putut fi încărcat.', 'error'); $('#organization-list').innerHTML = `<div class="empty-state">${esc(error.message || 'Eroare de încărcare.')}</div>`; }
    finally { state.busy = false; }
  };
  const refreshAfterAction = async (message) => { toast(message); state.audit = []; await load(true); };
  const action = async (name, body = {}) => api({ action: name, organization_id: selected().id, ...body });
  const extend = async (days) => { const organization = selected(); const current = organization.access?.expires_at && Date.parse(organization.access.expires_at) > Date.now() ? Date.parse(organization.access.expires_at) : Date.now(); const expires = new Date(current + Number(days) * 86400000).toISOString(); await action('extend', { expires_at: expires }); await refreshAfterAction(`Accesul pentru ${organization.name} a fost prelungit cu ${days} zile.`); };
  const customDate = async () => { const value = window.prompt('Introdu data expirării în format YYYY-MM-DD:', selected().access?.expires_at ? new Date(selected().access.expires_at).toISOString().slice(0, 10) : ''); if (!value) return; const parsed = new Date(`${value}T23:59:59Z`); if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) { toast('Alege o dată viitoare validă.', true); return; } await action('set_access', { expires_at: parsed.toISOString(), active: true }); await refreshAfterAction('Data de expirare a fost actualizată.'); };
  const packageAction = async () => { const code = $('#package-code-editor')?.value || selected().package?.code || 'standard'; const features = [...document.querySelectorAll('[data-package-feature]:checked')].map((input) => input.dataset.packageFeature); await action('set_package', { package_code: code, features, unlimited: selected().package?.unlimited === true, expires_at: selected().package?.expires_at || null }); await refreshAfterAction(`Pachetul ${code} și modulele selectate au fost salvate.`); };
  const loadAudit = async () => { const result = await action('list_audit'); state.audit = result.events || []; renderDetail(); };
  const health = async () => { const area = $('#organization-health-result'); area.innerHTML = '<div class="health-result">Se verifică guildurile și configurația Discord…</div>'; try { const result = await action('health_check'); state.health = result.health; const rows = (result.health.guilds || []).map((guild) => `<div class="health-row"><span><i class="dot ${guild.status === 'ok' ? 'ok' : guild.status === 'error' ? 'error' : 'warn'}"></i>${esc(guild.guild_name || guild.guild_id)}</span><strong>${esc(guild.status)} · ${guild.role_count || 0} roluri${guild.error ? ` · ${esc(guild.error)}` : ''}</strong></div>`).join(''); area.innerHTML = `<div class="health-result"><strong>Verificare ${esc(date(result.checked_at))}</strong>${rows || '<div class="health-row"><span>Niciun guild configurat</span></div>'}</div>`; await load(true); } catch (error) { area.innerHTML = `<div class="health-result">${esc(error.message)}</div>`; } };
  const runAction = async (name, element) => { const organization = selected(); if (!organization || state.busy) return; if (element) element.disabled = true; try { if (name === 'health') return await health(); if (name === 'audit') return await loadAudit(); if (name === 'extend') return await extend(Number(element.dataset.days)); if (name === 'custom-date') return await customDate(); if (name === 'no-expiry') { if (!window.confirm(`Elimini expirarea pentru „${organization.name}”? Organizația va rămâne activă până când o dezactivezi manual.`)) return; await action('set_access', { expires_at: '', active: true }); return await refreshAfterAction('Organizația a fost setată fără expirare.'); } if (name === 'package' || name === 'save-package') return await packageAction(); if (name === 'publish') { if (!window.confirm(`Publici draftul „${organization.name}”?`)) return; await action('publish'); return await refreshAfterAction('Draftul a fost publicat.'); } if (name === 'toggle') { const active = statusFor(organization) !== 'active'; if (!window.confirm(`${active ? 'Activezi' : 'Dezactivezi'} organizația „${organization.name}”?`)) return; await action('set_access', { expires_at: organization.access?.expires_at || '', active }); return await refreshAfterAction(`Organizația a fost ${active ? 'activată' : 'dezactivată'}.`); } if (name === 'sessions') { if (!window.confirm(`Revoci toate sesiunile active pentru „${organization.name}”? Utilizatorii vor trebui să se autentifice din nou.`)) return; const result = await action('revoke_organization_sessions'); return await refreshAfterAction(`${result.revoked_sessions || 0} sesiuni au fost revocate.`); } if (name === 'delete') { const confirmation = window.prompt(`Pentru ștergere definitivă, scrie exact numele organizației: ${organization.name}`); if (confirmation !== organization.name) { if (confirmation !== null) toast('Numele introdus nu corespunde.', true); return; } if (!window.confirm('Această acțiune șterge datele organizației și nu poate fi anulată. Continui?')) return; await action('delete', { confirm_name: confirmation }); state.selectedId = ''; state.audit = []; return await refreshAfterAction('Organizația și datele ei au fost șterse.'); } } catch (error) { toast(error.message || 'Acțiunea a eșuat.', true); } finally { if (element) element.disabled = false; } };
  const exportOrganizations = () => { const rows = [['Nume', 'Slug', 'Status', 'Pachet', 'Expirare', 'Guilduri', 'Roluri', 'Membri', 'Sesiuni', 'Probleme']]; filteredOrganizations().forEach((organization) => rows.push([organization.name, organization.slug || '', statusLabel(statusFor(organization)), packageLabel(organization), shortDate(organization.access?.expires_at), organization.guilds?.length || 0, organization.roles?.length || 0, organization.metrics?.members || 0, organization.metrics?.active_sessions || 0, issueLabel(organization)])); const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `organizatii-platforma-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url); };
  document.addEventListener('click', (event) => { const card = event.target.closest('[data-organization-id]'); if (card && !event.target.closest('button,a')) { state.selectedId = card.dataset.organizationId; state.audit = []; renderList(); renderDetail(); } const button = event.target.closest('[data-action]'); if (button) runAction(button.dataset.action, button); });
  ['organization-search', 'organization-status-filter', 'organization-package-filter', 'organization-sort', 'organization-issues-only'].forEach((id) => $((`#${id}`))?.addEventListener('input', () => { renderList(); }));
  $('#organization-reset-filters')?.addEventListener('click', () => { $('#organization-search').value = ''; $('#organization-status-filter').value = 'all'; $('#organization-package-filter').value = 'all'; $('#organization-sort').value = 'name'; $('#organization-issues-only').checked = false; renderList(); });
  $('#refresh-organizations')?.addEventListener('click', () => load(true));
  $('#export-organizations')?.addEventListener('click', exportOrganizations);
  $('#platform-admin-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const discordId = $('#platform-admin-discord-id').value.trim();
    const displayName = $('#platform-admin-display-name').value.trim();
    button.disabled = true;
    try {
      await administratorApi({ action: 'grant', discord_id: discordId, display_name: displayName });
      $('#platform-admin-discord-id').value = '';
      $('#platform-admin-display-name').value = '';
      toast('Administratorul delegat a primit acces. La următoarea autentificare va fi recunoscut automat.');
      await loadPlatformAdministrators();
    } catch (error) { toast(error.message || 'Administratorul nu a putut fi adăugat.', true); }
    finally { button.disabled = false; }
  });
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-platform-admin-revoke]');
    if (!button) return;
    const discordId = button.dataset.platformAdminRevoke;
    if (!window.confirm(`Revoci accesul de administrator pentru Discord ID ${discordId}?`)) return;
    button.disabled = true;
    try { await administratorApi({ action: 'revoke', discord_id: discordId }); toast('Accesul administratorului a fost revocat.'); await loadPlatformAdministrators(); }
    catch (error) { toast(error.message || 'Accesul nu a putut fi revocat.', true); }
    finally { button.disabled = false; }
  });
  load(false);
})();
