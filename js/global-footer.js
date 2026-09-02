(() => {
  "use strict";

  const CONFIG = Object.freeze({
    revolutUrl: "https://revolut.me/mariomihail",
    androidUrl: "descarca-android.html",
    changelogUrl: "changelog.html",
    thankYouUrl: "thank-you.html",
    iosUrl: "instalare-ios.html"
  });

  function getReleaseVersion() {
    return window.PANEL_RELEASE?.version || "3.10.0";
  }

  function removeLegacySupportElements() {
    [
      "#support-project-btn",
      "#support-modal",
      "#support-confirm-modal",
      ".support-project-floating",
      ".support-project-footer",
      "[data-old-support-widget]"
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element.closest("#panel-global-footer") && !element.closest("#panel-support-overlay")) {
          element.remove();
        }
      });
    });
  }

  function findFooterHost() {
    const explicit = document.querySelector("[data-panel-footer-host]");
    if (explicit && explicit.closest('main') && document.querySelector('#panel-shared-sidebar, #panel-header-host')) return document.body;
    if (explicit) return explicit;

    const main = document.querySelector("main");
    if (document.querySelector('#panel-shared-sidebar, #panel-header-host')) return document.body;
    if (main) {
      const style = getComputedStyle(main);
      if (style.display !== "flex") {
        main.style.display = "flex";
        main.style.flexDirection = "column";
      }
      if (!main.style.minHeight && style.minHeight === "0px") {
        main.style.minHeight = "100%";
      }
      return main;
    }

    document.documentElement.style.minHeight = "100%";
    document.body.style.minHeight = "100vh";
    document.body.style.display = "flex";
    document.body.style.flexDirection = "column";
    return document.body;
  }

  function createFooter() {
    document.querySelectorAll('footer:not(#panel-global-footer)').forEach((footer) => footer.remove());
    if (document.getElementById("panel-global-footer")) return;

    const footer = document.createElement("footer");
    footer.id = "panel-global-footer";
    footer.setAttribute("aria-label", "Informații proiect și donații");
    footer.innerHTML = `
      <div class="pgf-inner">

          <a class="pgf-android-badge" href="${CONFIG.androidUrl}" aria-label="Descarcă aplicația Panel pentru Android și vezi instrucțiunile de instalare">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.6 9.48l1.43-2.48a.5.5 0 10-.87-.5l-1.46 2.53a8.2 8.2 0 00-9.4 0L5.84 6.5a.5.5 0 10-.87.5L6.4 9.48A3.98 3.98 0 003 13v6a2 2 0 002 2h1v-5h1v5h10v-5h1v5h1a2 2 0 002-2v-6a3.98 3.98 0 00-3.4-3.52ZM8.5 7.5a.75.75 0 110 1.5.75.75 0 010-1.5Zm7 0a.75.75 0 110 1.5.75.75 0 010-1.5Z"/>
              </svg>

              <span>
                  <small>DESCARCĂ PENTRU</small>
                  <strong>Android</strong>
                  <em>Instalare APK</em>
              </span>
          </a>

          <a class="pgf-ios-badge" href="${CONFIG.iosUrl}" aria-label="Descarcă aplicația Panel pentru iPhone și vezi instrucțiunile de instalare">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M16.37 12.73c.02 2.35 2.06 3.13 2.08 3.14-.02.05-.32 1.1-1.05 2.18-.64.94-1.3 1.88-2.35 1.9-1.03.02-1.36-.61-2.54-.61-1.18 0-1.55.59-2.52.63-1 .04-1.76-1-2.4-1.94-1.3-1.88-2.29-5.3-.96-7.62.66-1.15 1.84-1.88 3.13-1.9.98-.02 1.9.66 2.54.66.63 0 1.82-.82 3.07-.7.52.02 1.98.21 2.91 1.57-.08.05-1.74 1.02-1.72 3.69Zm-2.07-7.09c.53-.64.89-1.54.79-2.43-.77.03-1.69.51-2.24 1.15-.49.57-.92 1.49-.8 2.36.86.07 1.73-.43 2.25-1.08Z"/>
              </svg>

              <span>
                  <small>DESCARCĂ PENTRU</small>
                  <strong>iPhone</strong>
                  <em>Instalare iOS</em>
              </span>
          </a>

        <div class="pgf-center">
            <p class="pgf-meta">
                © 2026
                <span class="pgf-brand"><img src="img/logo-32.png" alt="" aria-hidden="true">Panel by Little Mario</span>
                <span aria-hidden="true"> • </span>
                <a class="pgf-version"
                  href="${CONFIG.changelogUrl}"
                  title="Vezi noutățile și actualizările">
                    v${getReleaseVersion()}
                </a>
            </p>
        </div>

        <div class="pgf-support-block">

            <p class="pgf-support">
                ❤️ Susține dezvoltarea proiectului
            </p>

            <button
                class="pgf-donate"
                type="button"
                id="panel-donate-button">
                💳 Donează prin Revolut
            </button>

        </div>

    </div>
    `;

    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true;
    const userAgent = navigator.userAgent || '';
    const androidDevice = /Android/i.test(userAgent);
    const iosDevice = /iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const nativeCapacitor = window.Capacitor?.isNativePlatform?.() === true;
    const androidNative = androidDevice && (nativeCapacitor || /;\s*wv\)/i.test(userAgent));
    if (androidNative) {
      footer.querySelector('.pgf-android-badge')?.remove();
      footer.querySelector('.pgf-ios-badge')?.remove();
      document.getElementById('dashboard-fivem-launcher')?.remove();
    } else if (androidDevice) {
      footer.querySelector('.pgf-ios-badge')?.remove();
    } else if (iosDevice) {
      footer.querySelector('.pgf-android-badge')?.remove();
      document.getElementById('dashboard-fivem-launcher')?.remove();
    }
    if (standalone && iosDevice) footer.classList.add('pgf-ios-installed');

    findFooterHost().appendChild(footer);
    watchFooterVisibility(footer);
  }

  function watchFooterVisibility(footer) {
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = footer.getBoundingClientRect();
      document.documentElement.style.setProperty('--panel-footer-height', `${Math.ceil(footer.offsetHeight)}px`);
      const visibleHeight = Math.max(0, Math.min(rect.height, window.innerHeight - rect.top));
      document.documentElement.style.setProperty('--panel-footer-visible-height', `${Math.ceil(visibleHeight)}px`);
      document.body.classList.toggle('panel-footer-visible', visibleHeight > 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(footer);
  }

  function createDialog() {
    if (document.getElementById("panel-support-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "panel-support-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section id="panel-support-dialog" role="dialog" aria-modal="true" aria-labelledby="panel-support-title">
        <div class="psd-head">
          <h2 id="panel-support-title">❤️ Susține dezvoltarea proiectului</h2>
          <button class="psd-close" type="button" aria-label="Închide">×</button>
        </div>
        <div class="psd-body" id="panel-support-content"></div>
        <div class="psd-actions" id="panel-support-actions"></div>
      </section>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeDialog();
    });
    overlay.querySelector(".psd-close").addEventListener("click", closeDialog);
  }

  function setDialog(bodyHtml, actionsHtml) {
    const overlay = document.getElementById("panel-support-overlay");
    overlay.querySelector("#panel-support-content").innerHTML = bodyHtml;
    overlay.querySelector("#panel-support-actions").innerHTML = actionsHtml;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.querySelector(".psd-button")?.focus();
  }

  function closeDialog() {
    const overlay = document.getElementById("panel-support-overlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.overflow = "";
  }

  function openInitialDialog() {
    setDialog(
      `<p>Panelul este dezvoltat și întreținut în timpul liber. Donațiile sunt complet opționale, iar orice contribuție ajută la continuarea dezvoltării.</p>
       <p class="psd-note">Plata se deschide pe pagina oficială Revolut într-un tab nou.</p>`,
      `<button class="psd-button psd-secondary" type="button" data-action="cancel">Mai târziu</button>
       <button class="psd-button psd-primary" type="button" data-action="open-revolut">💳 Continuă către Revolut</button>`
    );
  }

  function openConfirmationDialog() {
    setDialog(
      `<p>Pagina Revolut a fost deschisă într-un tab nou.</p>
       <p class="psd-note">Revolut.me nu transmite automat confirmarea plății către panel. Apasă „Da, am donat” numai după ce ai finalizat contribuția.</p>`,
      `<button class="psd-button psd-secondary" type="button" data-action="not-yet">Nu încă</button>
       <button class="psd-button psd-primary" type="button" data-action="confirmed">❤️ Da, am donat</button>`
    );
  }

  function openRevolut() {
      const revolutLink = document.createElement("a");

      revolutLink.href = CONFIG.revolutUrl;
      revolutLink.target = "_blank";
      revolutLink.rel = "noopener noreferrer";

      document.body.appendChild(revolutLink);
      revolutLink.click();
      revolutLink.remove();

      openConfirmationDialog();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const donate = event.target.closest("#panel-donate-button");
      if (donate) {
        event.preventDefault();
        openInitialDialog();
        return;
      }

      const action = event.target.closest("[data-action]")?.dataset.action;
      if (!action) return;

      if (action === "cancel" || action === "not-yet") closeDialog();
      if (action === "open-revolut") openRevolut();
      if (action === "confirmed") {
        const returnTo = encodeURIComponent(location.pathname.split("/").pop() || "index.html");
        location.href = `${CONFIG.thankYouUrl}?from=${returnTo}`;
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDialog();
    });
  }

  function init() {
    if (location.pathname.endsWith('administrare-organizatie.html') && !localStorage.getItem('panel_session_token')) { location.href='login.html'; return; }
    if (location.pathname.endsWith('creare-organizatie-voucher.html')) {
      const draftFetch=window.fetch;window.fetch=async(...args)=>{const response=await draftFetch(...args);if(String(args[0]).includes('create-voucher-organization')){try{const copy=response.clone(),json=await copy.json();if(json.organization?.id){window.draftOrganizationId=json.organization.id;window.setDraftOrganizationId?.(json.organization.id);}}catch(_){}}return response;};
      const draftScript=document.createElement('script');draftScript.src='js/draft-config-ui.js?v=20260818-voucher-flow';document.head.appendChild(draftScript);
      const channelScript=document.createElement('script');channelScript.src='js/discord-channel-config.js?v=20260902-bot-routing-roles';document.head.appendChild(channelScript);
      if (!document.querySelector('[data-voucher-extra-fields]')) { const form=document.querySelector('#create'), address=document.querySelector('#address'); const box=document.createElement('div'); box.dataset.voucherExtraFields='true'; box.className='space-y-4'; box.innerHTML='<label class="block text-sm">Logo organizație (link, opțional)<input id="draft-logo" type="url" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3" placeholder="https://..."></label>'; if(form) form.insertBefore(box,address?.parentElement?.nextElementSibling||form.lastElementChild); const originalFetch=window.fetch; window.fetch=(url,options)=>{try{if(String(url).includes('create-voucher-organization')&&options?.body){const body=JSON.parse(options.body);body.logo_url=document.getElementById('draft-logo')?.value.trim()||null;options.body=JSON.stringify(body);}}catch(_){}return originalFetch(url,options)}; }
      if (!document.getElementById('panel-header-host')) {
        const headerHost = document.createElement('div'); headerHost.id = 'panel-header-host'; document.body.prepend(headerHost);
        const headerScript = document.createElement('script'); headerScript.src = 'js/global-header.js'; document.head.appendChild(headerScript);
      }
      if (!document.querySelector('[data-panel-footer-host]')) { const host=document.createElement('div'); host.dataset.panelFooterHost='true'; host.className='w-full'; document.body.appendChild(host); }
    }
    removeLegacySupportElements();
    createFooter();
    createDialog();
    bindEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
