(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const formatDate = (value) => {
    if (!value) return 'Fără termen';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Neconfigurat' : date.toLocaleString('ro-RO');
  };

  const setMessage = (message, kind = 'muted') => {
    const element = $('renew-message');
    if (!element) return;
    element.textContent = String(message || '');
    element.className = `mt-3 min-h-5 text-sm ${kind === 'error' ? 'text-rose-300' : kind === 'success' ? 'text-emerald-300' : 'text-slate-400'}`;
  };

  const render = (data) => {
    const organization = data?.organization || {};
    const access = data?.access || {};
    const packageValue = data?.package || {};
    $('renew-org-name').textContent = organization.name || 'Organizație activă';
    $('renew-package').textContent = packageValue.code === 'full' ? 'Full' : 'Standard';
    $('renew-expires').textContent = access.unlimited ? 'Fără termen' : formatDate(access.expires_at);
    $('renew-expires').classList.toggle('text-rose-300', access.expired === true);
  };

  const load = async () => {
    try {
      const data = await window.panelRequestJson('renew-organization', {
        method: 'POST',
        body: JSON.stringify({ action: 'status' })
      });
      render(data);
    } catch (error) {
      setMessage(error.message || 'Organizația nu a putut fi încărcată.', 'error');
      $('renew-submit').disabled = true;
    }
  };

  $('renew-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('renew-submit');
    const codeInput = $('renew-voucher');
    const code = codeInput.value.trim().toUpperCase();
    if (!code) return setMessage('Introdu codul voucherului.', 'error');
    button.disabled = true;
    setMessage('Se verifică și se aplică voucherul...');
    try {
      const data = await window.panelRequestJson('renew-organization', {
        method: 'POST',
        body: JSON.stringify({ action: 'redeem_voucher', voucher_code: code })
      });
      render(data);
      codeInput.value = '';
      setMessage(`Voucher aplicat cu succes. Accesul a fost prelungit cu ${data.added_days || 0} zile.`, 'success');
      localStorage.removeItem('panel_role_synced_at');
    } catch (error) {
      setMessage(error.message || 'Voucherul nu a putut fi aplicat.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
