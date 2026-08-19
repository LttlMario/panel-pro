(() => {
  "use strict";

  const NOTICE_KEY = "panel_privacy_notice_seen_v2";

  function wasAcknowledged() {
    try {
      return window.localStorage.getItem(NOTICE_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  function isLoginPage() {
    return window.location.pathname.split("/").pop() === "login.html";
  }

  function addStyles() {
    if (document.getElementById("panel-privacy-notice-styles")) return;

    const style = document.createElement("style");
    style.id = "panel-privacy-notice-styles";
    style.textContent = `
      #panel-privacy-notice-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147482000;
        display: grid;
        place-items: center;
        padding: 18px;
        background: rgba(2, 6, 23, .78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      #panel-privacy-notice-dialog {
        width: min(100%, 560px);
        max-height: min(92vh, 680px);
        overflow: auto;
        border: 1px solid rgba(34, 211, 238, .32);
        border-radius: 24px;
        background: linear-gradient(145deg, #0f1b30, #07101f 72%);
        color: #e2e8f0;
        box-shadow: 0 28px 90px rgba(0, 0, 0, .55), 0 0 0 1px rgba(255,255,255,.03) inset;
      }
      #panel-privacy-notice-dialog .ppn-head,
      #panel-privacy-notice-dialog .ppn-body,
      #panel-privacy-notice-dialog .ppn-actions { padding: 22px 24px; }
      #panel-privacy-notice-dialog .ppn-head {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        border-bottom: 1px solid rgba(51, 65, 85, .8);
      }
      #panel-privacy-notice-dialog .ppn-icon {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        flex: 0 0 42px;
        border: 1px solid rgba(52, 211, 153, .35);
        border-radius: 14px;
        background: rgba(16, 185, 129, .12);
        color: #6ee7b7;
        font-size: 20px;
      }
      #panel-privacy-notice-dialog .ppn-kicker {
        margin: 0 0 5px;
        color: #67e8f9;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: .16em;
        text-transform: uppercase;
      }
      #panel-privacy-notice-dialog h2 { margin: 0; color: #f8fafc; font-size: 21px; line-height: 1.25; }
      #panel-privacy-notice-dialog .ppn-body { display: grid; gap: 14px; }
      #panel-privacy-notice-dialog p { margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.65; }
      #panel-privacy-notice-dialog .ppn-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      #panel-privacy-notice-dialog .ppn-card {
        padding: 13px;
        border: 1px solid rgba(51, 65, 85, .85);
        border-radius: 14px;
        background: rgba(2, 6, 23, .38);
      }
      #panel-privacy-notice-dialog .ppn-card strong { display: block; color: #e2e8f0; font-size: 12px; }
      #panel-privacy-notice-dialog .ppn-card span { display: block; margin-top: 5px; color: #94a3b8; font-size: 11px; line-height: 1.5; }
      #panel-privacy-notice-dialog .ppn-link { color: #67e8f9; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
      #panel-privacy-notice-dialog .ppn-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
        border-top: 1px solid rgba(51, 65, 85, .8);
        background: rgba(2, 6, 23, .28);
      }
      #panel-privacy-notice-dialog button,
      #panel-privacy-notice-dialog a.ppn-button {
        display: inline-flex;
        min-height: 42px;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        border: 1px solid #334155;
        border-radius: 11px;
        background: #0b1628;
        color: #cbd5e1;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
      }
      #panel-privacy-notice-dialog a.ppn-button:hover { border-color: #22d3ee; color: #cffafe; }
      #panel-privacy-notice-dialog button { border-color: rgba(52, 211, 153, .5); background: rgba(16, 185, 129, .16); color: #a7f3d0; }
      #panel-privacy-notice-dialog button:hover { background: rgba(16, 185, 129, .25); }
      @media (max-width: 520px) {
        #panel-privacy-notice-dialog .ppn-head,
        #panel-privacy-notice-dialog .ppn-body,
        #panel-privacy-notice-dialog .ppn-actions { padding: 18px; }
        #panel-privacy-notice-dialog .ppn-grid { grid-template-columns: 1fr; }
        #panel-privacy-notice-dialog .ppn-actions > * { width: 100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function markAcknowledged() {
    try { window.localStorage.setItem(NOTICE_KEY, "1"); } catch (_) {}
  }

  function createNotice() {
    if (document.getElementById("panel-privacy-notice-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "panel-privacy-notice-overlay";

    const dialog = document.createElement("section");
    dialog.id = "panel-privacy-notice-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "panel-privacy-notice-title");

    const head = document.createElement("div");
    head.className = "ppn-head";
    const icon = document.createElement("div");
    icon.className = "ppn-icon";
    icon.textContent = "✓";
    icon.setAttribute("aria-hidden", "true");
    const heading = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "ppn-kicker";
    kicker.textContent = "Informare de confidențialitate";
    const title = document.createElement("h2");
    title.id = "panel-privacy-notice-title";
    title.textContent = "Cum folosim stocarea în Panel Pro";
    heading.append(kicker, title);
    head.append(icon, heading);

    const body = document.createElement("div");
    body.className = "ppn-body";
    const intro = document.createElement("p");
    intro.textContent = "Pentru ca panelul să funcționeze corect, folosim doar stocare tehnică necesară autentificării și preferințelor tale. Nu folosim cookie-uri de marketing, publicitate sau urmărire.";

    const grid = document.createElement("div");
    grid.className = "ppn-grid";
    [
      ["Sesiune și autentificare", "Păstrează accesul activ și protejează cererile către panel."],
      ["Preferințe", "Reține tema, organizația activă și opțiuni locale de funcționare."],
      ["Roluri Discord", "Rolurile sunt verificate pentru a decide ce pagini și funcții pot fi folosite."],
      ["Fără tracking", "Nu folosim cookie-uri de profilare, reclame sau vânzare de date."],
    ].forEach(([label, description]) => {
      const card = document.createElement("div");
      card.className = "ppn-card";
      const strong = document.createElement("strong");
      strong.textContent = label;
      const span = document.createElement("span");
      span.textContent = description;
      card.append(strong, span);
      grid.appendChild(card);
    });

    const details = document.createElement("p");
    details.textContent = "Poți consulta oricând explicațiile complete în ";
    const termsLink = document.createElement("a");
    termsLink.className = "ppn-link";
    termsLink.href = "termeni.html#cookie-uri-si-stocare";
    termsLink.textContent = "Termeni și condiții";
    details.appendChild(termsLink);
    details.appendChild(document.createTextNode(". "));

    body.append(intro, grid, details);

    const actions = document.createElement("div");
    actions.className = "ppn-actions";
    const termsButton = document.createElement("a");
    termsButton.className = "ppn-button";
    termsButton.href = "termeni.html#cookie-uri-si-stocare";
    termsButton.textContent = "Vezi detaliile";
    const acknowledge = document.createElement("button");
    acknowledge.type = "button";
    acknowledge.textContent = "Am înțeles";
    acknowledge.addEventListener("click", () => {
      markAcknowledged();
      overlay.remove();
    });
    actions.append(termsButton, acknowledge);

    dialog.append(head, body, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    acknowledge.focus();
  }

  function init() {
    if (!isLoginPage() || wasAcknowledged()) return;
    addStyles();
    createNotice();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.setTimeout(init, 350), { once: true });
  } else {
    window.setTimeout(init, 350);
  }
})();
