(() => {
  const init = () => {
    const address = document.getElementById('address');
    const form = document.getElementById('form');
    if (!address || !form || document.getElementById('contract-salary')) return;

    const label = document.createElement('label');
    label.innerHTML = 'Salariu lunar implicit (opțional)<input id="contract-salary" class="field" placeholder="Ex: 3.500 lei/lună">';
    address.closest('label')?.after(label);

    const originalFetch = window.fetch;
    window.fetch = async (url, options = {}) => {
      if (String(url).includes('/functions/v1/manage-organizations') && options.body) {
        try {
          const body = JSON.parse(options.body);
          if (body.action === 'save') {
            const salary = document.getElementById('contract-salary')?.value.trim() || '';
            body.contract_template = { ...(body.contract_template || {}), salary };
            options.body = JSON.stringify(body);
          }
        } catch (_) {}
      }
      const response = await originalFetch(url, options);
      if (String(url).includes('/functions/v1/manage-organizations') && options.body) {
        try {
          const sent = JSON.parse(options.body);
          const saved = await response.clone().json().catch(() => ({}));
          const organizationId = sent.organization?.id || saved.organization_id;
          if (sent.action === 'save' && response.ok && organizationId && sent.contract_template?.salary !== undefined) {
            await originalFetch(url, { ...options, body: JSON.stringify({ action: 'set_contract_salary', organization_id: organizationId, salary: sent.contract_template.salary }) });
          }
        } catch (_) {}
      }
      if (String(url).includes('/functions/v1/manage-organizations')) {
        try {
          const data = await response.clone().json();
          if (Array.isArray(data.organizations)) window.__panelOrganizations = data.organizations;
        } catch (_) {}
      }
      return response;
    };

    const originalEdit = window.editOrganization;
    if (typeof originalEdit === 'function') {
      window.editOrganization = async (...args) => {
        const result = await originalEdit(...args);
        const organization = window.__panelOrganizations?.find?.((item) => item.id === args[0]);
        const salary = organization?.platform_settings?.contract_template?.salary || '';
        const field = document.getElementById('contract-salary');
        if (field) field.value = salary;
        return result;
      };
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
