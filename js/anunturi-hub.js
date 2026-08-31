(() => {
  'use strict';
  if (!location.pathname.endsWith('anunturi.html')) return;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let activeFilter = 'all';

  const announcements = () => window.communityAnnouncementsApi;
  const discipline = () => window.communityDisciplineApi;
  const actions = () => window.communityActionsApi;

  function hasRead(scope) {
    const access = discipline()?.getAccess?.() || {};
    return Boolean(access?.[scope]?.read || access?.platform_admin);
  }

  function hasWrite(scope) {
    const access = discipline()?.getAccess?.() || {};
    return Boolean(access?.[scope]?.write || access?.platform_admin);
  }

  function hasSanction(scope) {
    const access = discipline()?.getAccess?.() || {};
    return Boolean(access?.[scope]?.sanction || access?.platform_admin);
  }

  function updateVisibility() {
    const announcementAccess = announcements()?.getAccess?.() || {};
    const readableAudiences = announcementAccess.readAudiences || [];
    const disciplineReadable = hasRead('departments') || hasRead('organization');
    const actionsReadable = Boolean(actions()?.getAccess?.()?.read);
    const tabs = document.querySelectorAll('[data-filter]');
    tabs.forEach((tab) => {
      const filter = tab.dataset.filter;
      const visible = filter === 'all'
        ? Boolean(announcementAccess.read || disciplineReadable || actionsReadable)
        : filter === 'poll' || filter === 'fine'
          ? Boolean(announcementAccess.read)
        : readableAudiences.includes(filter);
      tab.hidden = !visible;
    });

    const warningTab = document.querySelector('[data-discipline-filter="warnings"]');
    const sanctionTab = document.querySelector('[data-discipline-filter="sanctions"]');
    if (warningTab) warningTab.hidden = !disciplineReadable;
    if (sanctionTab) sanctionTab.hidden = !disciplineReadable;

    const createOptions = {
      announcement: Boolean(announcementAccess.write),
      poll: Boolean(announcementAccess.write),
      warning: hasWrite('departments') || hasWrite('organization'),
      sanction: hasSanction('departments') || hasSanction('organization'),
      action: Boolean(actions()?.getAccess?.()?.write)
    };
    const createType = $('unified-create-type');
    createType?.querySelectorAll('option').forEach((option) => { option.hidden = !createOptions[option.value]; });
    const firstAvailable = createType && [...createType.options].find((option) => !option.hidden);
    if (firstAvailable && createType.options[createType.selectedIndex]?.hidden) createType.value = firstAvailable.value;
    if ($('create-button')) $('create-button').hidden = !Object.values(createOptions).some(Boolean);
  }

  function hidePanels() {
    $('feed').hidden = false;
    $('discipline-panel').hidden = true;
    $('actions-panel').hidden = true;
  }

  function readableDisciplineEntries() {
    return (discipline()?.getEntries?.() || []).filter((entry) => hasRead(entry.target_scope));
  }

  function renderAll() {
    if (activeFilter !== 'all') return;
    const feed = $('feed');
    if (!feed) return;
    const records = [
      ...(announcements()?.getPosts?.() || []).map((post) => ({ kind: 'post', date: post.created_at, value: post })),
      ...readableDisciplineEntries().map((entry) => ({ kind: 'discipline', date: entry.created_at, value: entry })),
      ...((actions()?.getActions?.() || []).map((action) => ({ kind: 'action', date: action.created_at, value: action })))
    ].sort((left, right) => Date.parse(String(right.date || '')) - Date.parse(String(left.date || '')));

    feed.innerHTML = records.length ? records.map((record) => {
      if (record.kind === 'post') return announcements()?.renderCard?.(record.value) || '';
      if (record.kind === 'discipline') return discipline()?.renderCard?.(record.value) || '';
      return actions()?.renderCard?.(record.value) || '';
    }).join('') : '<div class="empty">Nu există înregistrări în modulele la care ai acces.</div>';
    announcements()?.bindRenderedCards?.(feed);
    discipline()?.bindRenderedCards?.(feed);
    actions()?.bindRenderedCards?.(feed);
  }

  function openUnifiedCreate() {
    updateVisibility();
    const type = $('unified-create-type');
    if (!type || [...type.options].every((option) => option.hidden)) {
      alert('Nu ai permisiune de creare în niciun modul.');
      return;
    }
    $('unified-create-modal').hidden = false;
  }

  function closeUnifiedCreate() { $('unified-create-modal').hidden = true; }

  function continueCreate(event) {
    event.preventDefault();
    const type = $('unified-create-type').value;
    closeUnifiedCreate();
    if (type === 'announcement' || type === 'poll') announcements()?.openComposer?.(type);
    else if (type === 'warning' || type === 'sanction') discipline()?.openComposer?.(type);
    else if (type === 'action') actions()?.openComposer?.();
  }

  function selectTab(tab) {
    activeFilter = tab.dataset.filter || tab.dataset.actionsFilter || tab.dataset.disciplineFilter || 'all';
    if (activeFilter === 'all') {
      hidePanels();
      renderAll();
    } else if (tab.dataset.filter) {
      hidePanels();
    }
  }

  window.openUnifiedCreate = openUnifiedCreate;
  document.addEventListener('DOMContentLoaded', () => {
    $('unified-create-form')?.addEventListener('submit', continueCreate);
    document.addEventListener('click', (event) => {
      const target = event.target;
      const tab = target instanceof Element ? target.closest('.tab') : null;
      if (tab) selectTab(tab);
      if (target instanceof Element && target.closest('[data-unified-create-close]')) closeUnifiedCreate();
      if (target === $('unified-create-modal')) closeUnifiedCreate();
    });
    window.addEventListener('community:posts-updated', renderAll);
    window.addEventListener('community:discipline-updated', () => { updateVisibility(); renderAll(); });
    window.addEventListener('community:actions-updated', () => { updateVisibility(); renderAll(); });
    window.addEventListener('community:permissions-updated', updateVisibility);
    updateVisibility();
    setTimeout(() => { updateVisibility(); renderAll(); }, 0);
  });
})();
