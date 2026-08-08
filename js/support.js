(() => {
  'use strict';

  const REVOLUT_URL = 'https://revolut.me/mariomihail';
  const ROOT_ID = 'project-support-widget';

  if (document.getElementById(ROOT_ID)) return;

  const style = document.createElement('style');
  style.textContent = `
    #${ROOT_ID} { position: fixed; right: 18px; bottom: 18px; z-index: 9999; font-family: inherit; }
    #${ROOT_ID} * { box-sizing: border-box; }
    .support-trigger {
      display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(99,102,241,.35);
      background: rgba(15,23,42,.96); color: #e2e8f0; border-radius: 14px; padding: 11px 15px;
      font-size: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 14px 35px rgba(2,6,23,.45);
      transition: transform .2s ease, border-color .2s ease, background .2s ease;
      backdrop-filter: blur(12px);
    }
    .support-trigger:hover { transform: translateY(-2px); border-color: rgba(99,102,241,.75); background: #1e293b; }
    .support-trigger:focus-visible, .support-close:focus-visible, .support-pay:focus-visible, .support-confirm:focus-visible, .support-later:focus-visible { outline: 2px solid #818cf8; outline-offset: 2px; }
    .support-backdrop {
      position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
      padding: 18px; background: rgba(2,6,23,.78); backdrop-filter: blur(6px); z-index: 10000;
    }
    .support-backdrop.open { display: flex; }
    .support-modal {
      width: min(100%, 470px); border: 1px solid #334155; border-radius: 22px; background: #0f172a;
      color: #e2e8f0; box-shadow: 0 28px 80px rgba(0,0,0,.55); overflow: hidden;
      animation: supportPop .18s ease-out;
    }
    @keyframes supportPop { from { opacity: 0; transform: scale(.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .support-head { display: flex; justify-content: space-between; gap: 16px; padding: 20px 20px 14px; border-bottom: 1px solid #1e293b; }
    .support-kicker { margin: 0 0 5px; color: #818cf8; font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
    .support-title { margin: 0; color: #f8fafc; font-size: 19px; font-weight: 800; }
    .support-close { width: 34px; height: 34px; flex: 0 0 auto; border: 1px solid #334155; border-radius: 11px; background: #020617; color: #94a3b8; cursor: pointer; font-size: 20px; line-height: 1; }
    .support-close:hover { color: #f8fafc; background: #1e293b; }
    .support-body { padding: 20px; }
    .support-copy { margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.65; }
    .support-points { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin: 17px 0 20px; }
    .support-point { padding: 10px 11px; border: 1px solid #1e293b; border-radius: 12px; background: #020617; color: #cbd5e1; font-size: 11px; }
    .support-pay {
      display: flex; align-items: center; justify-content: center; gap: 9px; width: 100%; padding: 13px 16px;
      border: 1px solid rgba(99,102,241,.45); border-radius: 13px; background: #4f46e5; color: #fff;
      text-decoration: none; font-size: 13px; font-weight: 800; transition: background .2s ease, transform .2s ease;
    }
    .support-pay:hover { background: #6366f1; transform: translateY(-1px); }
    .support-note { margin: 13px 0 0; color: #64748b; text-align: center; font-size: 10px; line-height: 1.5; }
    .support-confirmation { display: none; }
    .support-confirmation.open { display: block; }
    .support-donation-content.hidden { display: none; }
    .support-confirm-icon { width: 58px; height: 58px; margin: 0 auto 14px; display: grid; place-items: center; border-radius: 18px; background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.28); font-size: 27px; }
    .support-confirm-title { margin: 0; text-align: center; color: #f8fafc; font-size: 18px; font-weight: 800; }
    .support-confirm-copy { margin: 9px auto 18px; max-width: 360px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6; }
    .support-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .support-confirm, .support-later { display: flex; align-items: center; justify-content: center; min-height: 43px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; transition: .2s ease; }
    .support-confirm { border: 1px solid rgba(16,185,129,.35); background: #059669; color: #fff; }
    .support-confirm:hover { background: #10b981; transform: translateY(-1px); }
    .support-later { border: 1px solid #334155; background: #020617; color: #cbd5e1; }
    .support-later:hover { background: #1e293b; color: #f8fafc; }

    @media (max-width: 520px) {
      #${ROOT_ID} { right: 12px; bottom: 12px; }
      .support-trigger span:last-child { display: none; }
      .support-trigger { width: 46px; height: 46px; justify-content: center; padding: 0; border-radius: 50%; font-size: 17px; }
      .support-points { grid-template-columns: 1fr; }
      .support-actions { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <button type="button" class="support-trigger" aria-haspopup="dialog" aria-controls="support-project-modal">
      <span aria-hidden="true">❤️</span><span>Susține proiectul</span>
    </button>
    <div class="support-backdrop" role="presentation">
      <section id="support-project-modal" class="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-project-title">
        <div class="support-head">
          <div>
            <p class="support-kicker">Panel by Little Mario</p>
            <h2 id="support-project-title" class="support-title">Susține dezvoltarea proiectului</h2>
          </div>
          <button type="button" class="support-close" aria-label="Închide">×</button>
        </div>
        <div class="support-body">
          <div class="support-donation-content">
          <p class="support-copy">Acest panel este dezvoltat și întreținut în timpul liber. Dacă îți este util, poți contribui voluntar la dezvoltarea lui, la funcționalități noi și la menținerea proiectului actualizat.</p>
          <div class="support-points">
            <div class="support-point">🚀 Funcționalități noi</div>
            <div class="support-point">🛠️ Corectarea erorilor</div>
            <div class="support-point">⚡ Optimizări constante</div>
            <div class="support-point">💾 Mentenanță proiect</div>
          </div>
          <a class="support-pay" href="${REVOLUT_URL}" target="_blank" rel="noopener noreferrer">💳 Donează prin Revolut</a>
          <p class="support-note">Donațiile sunt complet opționale. Îți mulțumesc pentru susținere!</p>
          </div>
          <div class="support-confirmation" aria-live="polite">
            <div class="support-confirm-icon">💳</div>
            <h3 class="support-confirm-title">Ai finalizat donația?</h3>
            <p class="support-confirm-copy">După ce termini plata în pagina Revolut, revino aici și alege una dintre opțiunile de mai jos.</p>
            <div class="support-actions">
              <button type="button" class="support-confirm">❤️ Da, am donat</button>
              <button type="button" class="support-later">Nu încă</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
  document.body.appendChild(root);

  const trigger = root.querySelector('.support-trigger');
  const backdrop = root.querySelector('.support-backdrop');
  const closeButton = root.querySelector('.support-close');
  const payButton = root.querySelector('.support-pay');
  const donationContent = root.querySelector('.support-donation-content');
  const confirmationContent = root.querySelector('.support-confirmation');
  const confirmButton = root.querySelector('.support-confirm');
  const laterButton = root.querySelector('.support-later');

  const showDonationStep = () => {
    donationContent.classList.remove('hidden');
    confirmationContent.classList.remove('open');
  };

  const showConfirmationStep = () => {
    donationContent.classList.add('hidden');
    confirmationContent.classList.add('open');
    confirmButton.focus();
  };

  const openModal = () => {
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    showDonationStep();
    closeButton.focus();
  };

  const closeModal = () => {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
    trigger.focus();
  };

  trigger.addEventListener('click', openModal);
  payButton.addEventListener('click', () => {
    window.setTimeout(showConfirmationStep, 120);
  });
  confirmButton.addEventListener('click', () => {
    const returnPage = `${window.location.pathname.split('/').pop() || 'index.html'}${window.location.search || ''}`;
    window.location.href = `thank-you.html?return=${encodeURIComponent(returnPage)}`;
  });
  laterButton.addEventListener('click', closeModal);
  closeButton.addEventListener('click', closeModal);
  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && backdrop.classList.contains('open')) closeModal();
  });
})();
