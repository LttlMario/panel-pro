(() => {
  const login = document.getElementById('discord-login-btn');
  const code = document.getElementById('voucher-code');
  const guild = document.getElementById('voucher-guild-id');
  if (!login || !code || !guild) return;

  const modal = document.createElement('div');
  modal.id = 'voucher-onboarding-modal';
  modal.hidden = true;
  modal.innerHTML = `<div class="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"><section class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-fuchsia-500/40 bg-slate-900 p-6 text-slate-100 shadow-2xl"><h2 class="text-2xl font-black">Activare prin voucher</h2><p class="mt-3 text-sm leading-6 text-slate-300">Poți introduce Guild ID-ul unui server pe care botul este deja instalat sau poți lăsa câmpul gol. Dacă nu alegi încă un server, vei fi trimis la meniul de creare și configurare a organizației.</p><div class="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><b>Dacă alegi un server acum:</b><ol class="mt-2 list-decimal space-y-2 pl-5"><li>Invită botul aplicației pe server.</li><li>Activează Developer Mode în Discord.</li><li>Click dreapta pe server → Copy Server ID.</li><li>Introdu ID-ul în formularul de login.</li></ol></div><label class="mt-4 flex items-start gap-3 text-sm"><input id="voucher-confirm" type="checkbox" class="mt-1 h-4 w-4"><span>Confirm că folosesc un voucher valid și înțeleg că serverul ales va fi configurat separat pentru noua organizație.</span></label><div class="mt-5 flex justify-end gap-3"><button type="button" id="voucher-cancel" class="rounded-xl border border-slate-600 px-4 py-2">Anulează</button><button type="button" id="voucher-continue" class="rounded-xl bg-fuchsia-700 px-4 py-2 font-bold">Confirmă și continuă</button></div></section></div>`;
  document.body.appendChild(modal);

  let confirmed = false;
  const show = () => {
    if (!code.value.trim() || confirmed) return true;
    modal.hidden = false;
    return false;
  };

  login.addEventListener('click', (event) => {
    if (!show()) event.stopImmediatePropagation();
  }, true);
  modal.querySelector('#voucher-cancel').onclick = () => { modal.hidden = true; };
  modal.querySelector('#voucher-continue').onclick = () => {
    if (!modal.querySelector('#voucher-confirm').checked) return alert('Bifează confirmarea pentru a continua.');
    if (guild.value.trim() && !/^\d{15,22}$/.test(guild.value.trim())) return alert('Guild ID-ul introdus este invalid.');
    confirmed = true;
    modal.hidden = true;
    login.click();
  };
})();
