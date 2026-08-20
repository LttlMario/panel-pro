(() => {
  'use strict';

  const rules = [
    { key: 'length', label: 'minimum 8 caractere', test: (value) => value.length >= 8 },
    { key: 'uppercase', label: 'o literă mare', test: (value) => /[A-Z]/.test(value) },
    { key: 'number', label: 'o cifră', test: (value) => /\d/.test(value) },
  ];

  window.bindPanelPasswordRules = function bindPanelPasswordRules(inputOrId, containerOrId) {
    const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
    const container = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!input || !container || input.dataset.passwordRulesBound === 'true') return;

    const items = rules.map((rule) => {
      const item = document.createElement('li');
      item.dataset.passwordRule = rule.key;
      item.className = 'flex items-center gap-2 text-xs text-slate-500 transition-colors';
      item.innerHTML = '<span data-password-rule-icon class="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-700 text-[10px]">○</span><span data-password-rule-label></span>';
      container.querySelector('[data-password-rules-list]')?.appendChild(item);
      return { ...rule, item, icon: item.querySelector('[data-password-rule-icon]'), labelElement: item.querySelector('[data-password-rule-label]') };
    });

    const render = () => {
      const value = String(input.value || '');
      items.forEach((rule) => {
        const valid = rule.test(value);
        rule.item.classList.toggle('text-emerald-300', valid);
        rule.item.classList.toggle('text-slate-500', !valid);
        rule.icon.textContent = valid ? '✓' : '○';
        rule.icon.classList.toggle('border-emerald-400/60', valid);
        rule.icon.classList.toggle('bg-emerald-400/10', valid);
        rule.icon.classList.toggle('text-emerald-300', valid);
        rule.labelElement.textContent = valid ? `✓ ${rule.label} — îndeplinit` : `Necesită ${rule.label}`;
      });
      input.classList.toggle('border-emerald-400/60', value.length > 0 && items.every((rule) => rule.test(value)));
      input.classList.toggle('border-rose-400/60', value.length > 0 && items.some((rule) => !rule.test(value)));
    };

    input.dataset.passwordRulesBound = 'true';
    input.addEventListener('input', render);
    render();
  };
})();
