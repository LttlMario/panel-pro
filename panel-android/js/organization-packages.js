(() => {
  const form = document.querySelector('#form'); if (!form) return;
  const box = document.createElement('div');
  box.className = 'rounded-xl border border-fuchsia-700/60 bg-fuchsia-950/20 p-4';
  box.innerHTML = '<h2 class="font-bold">Pachetul organizației</h2><p id="package-help" class="mt-1 text-xs text-slate-400">Pentru o organizație nouă alege pachetul și perioada. La editare pachetul existent este păstrat automat.</p><div id="package-new-fields" class="mt-3 grid md:grid-cols-2 gap-3"><label>Pachet<select id="package-code" class="field"><option value="standard">Standard</option><option value="operations">Operations</option><option value="full">Full</option></select></label><label>Activ până la<input id="package-expires" type="datetime-local" class="field"></label></div><div id="package-existing-fields" class="mt-3 hidden"><p id="package-current" class="text-sm font-bold text-fuchsia-200"></p><div class="mt-2 flex flex-wrap gap-2"><button type="button" data-package-days="7" class="rounded-lg border border-fuchsia-700 px-3 py-2 text-xs font-bold">+ 7 zile</button><button type="button" data-package-days="30" class="rounded-lg border border-fuchsia-700 px-3 py-2 text-xs font-bold">+ 30 zile</button><button type="button" data-package-days="-7" class="rounded-lg border border-rose-700 px-3 py-2 text-xs font-bold">− 7 zile</button></div></div><p id="package-status" class="mt-3 text-xs text-slate-400"></p>';
  const status = document.querySelector('#status');
  form.insertBefore(box, form.firstElementChild?.nextElementSibling || form.firstChild);
  const expires = box.querySelector('#package-expires');
  expires.value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16);
  const syncMode = () => {
    const existing = Boolean(document.querySelector('#id')?.value);
    box.querySelector('#package-new-fields').classList.toggle('hidden', existing);
    box.querySelector('#package-existing-fields').classList.toggle('hidden', !existing);
    if (!existing) return;
    const organization = (window.__organizationListForContractDefaults || []).find((item) => item.id === document.querySelector('#id').value);
    const packageValue = organization?.platform_settings?.organization_package || {};
    box.querySelector('#package-current').textContent = `Pachet: ${packageValue.code || 'existent'} · ${packageValue.unlimited ? 'fără termen' : (packageValue.expires_at ? `până la ${new Date(packageValue.expires_at).toLocaleString('ro-RO')}` : 'termen gestionat separat')}`;
  };
  document.querySelector('#id')?.addEventListener('change', syncMode);
  const observer = new MutationObserver(syncMode); observer.observe(document.querySelector('#id'), { attributes: true, attributeFilter: ['value'] });
  setInterval(syncMode, 300);
  box.querySelectorAll('[data-package-days]').forEach(button => button.onclick = async () => {
    const organizationId = document.querySelector('#id').value;
    const organization = (window.__organizationListForContractDefaults || []).find((item) => item.id === organizationId);
    const current = organization?.platform_settings?.organization_access?.expires_at;
    const base = current && Date.parse(current) > Date.now() ? new Date(current) : new Date();
    base.setDate(base.getDate() + Number(button.dataset.packageDays));
    try { button.disabled = true; await invoke({ action: 'extend', organization_id: organizationId, expires_at: base.toISOString() }); box.querySelector('#package-status').textContent = 'Perioada a fost actualizată.'; } catch (error) { box.querySelector('#package-status').textContent = error.message; } finally { button.disabled = false; }
  });
  const originalSubmit = form.onsubmit;
  form.onsubmit = async event => {
    event.preventDefault();
    const organizationId = document.querySelector('#id').value;
    if (originalSubmit) return originalSubmit(event);
  };
  syncMode();
})();
