(() => {
  if (!location.pathname.endsWith('organizatii.html')) return;
  const show = () => {
    if (document.getElementById('package-limits-help')) return;
    const select = document.getElementById('package-code');
    if (!select) return;
    const help = document.createElement('div');
    help.id = 'package-limits-help';
    help.className = 'mt-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-300';
    const update = () => {
      help.innerHTML = select.value === 'full'
        ? '<b class="text-emerald-300">Full/Premium:</b> include Standard, partea de organizație/mafia, modulele ilegale, servere multiple, roluri nelimitate și webhook-uri dedicate.'
        : '<b class="text-cyan-300">Standard:</b> partea legală a firmei și angajaților, inclusiv avertismentele și sancțiunile pentru angajați, un server și maximum 10 roluri Discord.';
    };
    select.parentElement?.appendChild(help);
    const actions = document.createElement('div');
    actions.className = 'mt-3 flex flex-wrap gap-2';
    actions.innerHTML = '<button type="button" data-package-choice="standard" class="rounded-lg bg-cyan-700 px-4 py-2 text-xs font-bold">Alege Standard</button><button type="button" data-package-choice="full" class="rounded-lg bg-fuchsia-700 px-4 py-2 text-xs font-bold">Alege Premium / Full</button><button type="button" id="verify-package-guilds" class="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold">Verifică Guild-urile</button><button type="button" id="verify-package-webhooks" class="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold">Verifică webhook-urile</button>';
    help.after(actions);
    actions.querySelectorAll('[data-package-choice]').forEach((button) => button.onclick = () => { select.value = button.dataset.packageChoice; select.dispatchEvent(new Event('change')); });
    actions.querySelector('#verify-package-guilds').onclick = () => document.querySelector('#discover')?.click() || alert('Deschide formularul organizației și introdu Guild ID-ul.');
    actions.querySelector('#verify-package-webhooks').onclick = () => { const urls = [...document.querySelectorAll('input[id*="wh_"][id*="url"]')].map((input) => input.value.trim()).filter(Boolean); alert(urls.length ? `Sunt completate ${urls.length} adrese webhook. Salvează organizația pentru validare.` : 'Nu există webhook-uri completate.'); };
    select.addEventListener('change', update);
    update();
  };
  const timer = setInterval(() => { show(); if (document.getElementById('package-limits-help')) clearInterval(timer); }, 250);
})();
