(() => {
  const form = document.querySelector('#form'); if (!form) return;
  const box = document.createElement('div');
  box.className = 'rounded-xl border border-fuchsia-700/60 bg-fuchsia-950/20 p-4';
  box.innerHTML = '<h2 class="font-bold">Pachetul organizației</h2><p class="mt-1 text-xs text-slate-400">Alege Standard sau Full și perioada de activare. Data poate fi modificată ulterior.</p><div class="mt-3 grid md:grid-cols-2 gap-3"><label>Pachet<select id="package-code" class="field"><option value="standard">Standard</option><option value="full">Full</option></select></label><label>Activ până la<input id="package-expires" type="datetime-local" class="field"></label></div><p id="package-status" class="mt-3 text-xs text-slate-400"></p>';
  const status = document.querySelector('#status');
  form.insertBefore(box, form.firstElementChild?.nextElementSibling || form.firstChild);
  const expires = box.querySelector('#package-expires');
  expires.value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 16);
  const originalSubmit = form.onsubmit;
  form.onsubmit = async event => {
    event.preventDefault();
    const organizationId = document.querySelector('#id').value;
    if (organizationId) {
      try {
        const value = expires.value ? new Date(expires.value).toISOString() : null;
        if (value && Date.parse(value) <= Date.now()) throw new Error('Data pachetului trebuie să fie în viitor.');
        await invoke({ action: 'set_package', organization_id: organizationId, package_code: box.querySelector('#package-code').value, unlimited: false, expires_at: value });
      } catch (error) { if (status) status.textContent = error.message; return; }
    }
    if (originalSubmit) return originalSubmit(event);
  };
})();
