(() => {
  "use strict";

  const TERMS_VERSION = "2026-08-19";
  let activePromise = null;

  function storageKey(identity) {
    const safeIdentity = String(identity || "account").replace(/[^a-zA-Z0-9_-]/g, "_");
    return `panel_terms_accepted_${TERMS_VERSION}_${safeIdentity}`;
  }

  function isAccepted(identity) {
    try {
      return window.localStorage.getItem(storageKey(identity)) === "1";
    } catch (_) {
      return false;
    }
  }

  function saveAcceptance(identity) {
    try {
      window.localStorage.setItem(storageKey(identity), "1");
      return true;
    } catch (_) {
      return false;
    }
  }

  function addStyles() {
    if (document.getElementById("panel-terms-gate-styles")) return;
    const style = document.createElement("style");
    style.id = "panel-terms-gate-styles";
    style.textContent = `
      #panel-terms-gate-overlay { position:fixed; inset:0; z-index:2147482500; display:grid; place-items:center; padding:18px; background:rgba(2,6,23,.84); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
      #panel-terms-gate-dialog { width:min(100%,620px); max-height:min(92vh,720px); overflow:auto; border:1px solid rgba(34,211,238,.35); border-radius:24px; background:linear-gradient(145deg,#111d35,#07101f 74%); color:#e2e8f0; box-shadow:0 30px 100px rgba(0,0,0,.58); }
      #panel-terms-gate-dialog .ptg-head, #panel-terms-gate-dialog .ptg-body, #panel-terms-gate-dialog .ptg-actions { padding:22px 24px; }
      #panel-terms-gate-dialog .ptg-head { display:flex; align-items:flex-start; gap:14px; border-bottom:1px solid rgba(51,65,85,.8); }
      #panel-terms-gate-dialog .ptg-icon { display:grid; place-items:center; width:44px; height:44px; flex:0 0 44px; border:1px solid rgba(34,211,238,.4); border-radius:14px; background:rgba(8,145,178,.16); color:#67e8f9; font-size:20px; }
      #panel-terms-gate-dialog .ptg-kicker { margin:0 0 5px; color:#67e8f9; font-size:10px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; }
      #panel-terms-gate-dialog h2 { margin:0; color:#f8fafc; font-size:22px; line-height:1.25; }
      #panel-terms-gate-dialog .ptg-body { display:grid; gap:14px; }
      #panel-terms-gate-dialog p { margin:0; color:#cbd5e1; font-size:13px; line-height:1.65; }
      #panel-terms-gate-dialog .ptg-list { display:grid; gap:9px; margin:0; padding:0; list-style:none; }
      #panel-terms-gate-dialog .ptg-list li { display:flex; gap:9px; padding:11px 12px; border:1px solid rgba(51,65,85,.85); border-radius:13px; background:rgba(2,6,23,.36); color:#cbd5e1; font-size:12px; line-height:1.5; }
      #panel-terms-gate-dialog .ptg-list li::before { content:"✓"; flex:none; color:#6ee7b7; font-weight:900; }
      #panel-terms-gate-dialog .ptg-link { color:#67e8f9; font-weight:800; text-decoration:underline; text-underline-offset:3px; }
      #panel-terms-gate-dialog .ptg-consent { display:flex; align-items:flex-start; gap:10px; padding:13px; border:1px solid rgba(52,211,153,.3); border-radius:14px; background:rgba(16,185,129,.08); color:#d1fae5; font-size:12px; line-height:1.5; cursor:pointer; }
      #panel-terms-gate-dialog .ptg-consent input { width:17px; height:17px; flex:none; margin-top:1px; accent-color:#10b981; }
      #panel-terms-gate-dialog .ptg-error { min-height:18px; color:#fda4af; font-size:12px; }
      #panel-terms-gate-dialog .ptg-actions { display:flex; justify-content:flex-end; border-top:1px solid rgba(51,65,85,.8); background:rgba(2,6,23,.28); }
      #panel-terms-gate-dialog button { min-height:44px; padding:10px 18px; border:1px solid rgba(52,211,153,.5); border-radius:11px; background:rgba(16,185,129,.17); color:#a7f3d0; font:inherit; font-size:12px; font-weight:900; cursor:pointer; }
      #panel-terms-gate-dialog button:disabled { border-color:#334155; background:#172033; color:#64748b; cursor:not-allowed; }
      #panel-terms-gate-dialog button:not(:disabled):hover { background:rgba(16,185,129,.28); }
      @media (max-width:520px) { #panel-terms-gate-dialog .ptg-head, #panel-terms-gate-dialog .ptg-body, #panel-terms-gate-dialog .ptg-actions { padding:18px; } #panel-terms-gate-dialog .ptg-actions button { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function createDialog(identity) {
    addStyles();
    const overlay = document.createElement("div");
    overlay.id = "panel-terms-gate-overlay";
    const dialog = document.createElement("section");
    dialog.id = "panel-terms-gate-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "panel-terms-gate-title");

    const head = document.createElement("div");
    head.className = "ptg-head";
    const icon = document.createElement("div");
    icon.className = "ptg-icon";
    icon.textContent = "✓";
    icon.setAttribute("aria-hidden", "true");
    const heading = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "ptg-kicker";
    kicker.textContent = "Acces condiționat";
    const title = document.createElement("h2");
    title.id = "panel-terms-gate-title";
    title.textContent = "Acceptă termenii și condițiile";
    heading.append(kicker, title);
    head.append(icon, heading);

    const body = document.createElement("div");
    body.className = "ptg-body";
    const intro = document.createElement("p");
    intro.textContent = "Înainte să continui, confirmă că ai citit și accepți regulile de utilizare ale Panel Pro. Acceptarea este solicitată pentru fiecare cont și pentru fiecare versiune nouă a termenilor.";
    const list = document.createElement("ul");
    list.className = "ptg-list";
    [
      "Rolurile și accesul la pagini sunt verificate prin Discord.",
      "Nu este permis accesul la contul altei persoane sau ocolirea permisiunilor.",
      "Datele tehnice sunt folosite pentru autentificare, sesiune și funcționarea panelului.",
      "Parola și datele de autentificare trebuie păstrate confidențial.",
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    const details = document.createElement("p");
    details.textContent = "Poți citi documentul complet aici: ";
    const termsLink = document.createElement("a");
    termsLink.className = "ptg-link";
    termsLink.href = "termeni.html";
    termsLink.target = "_blank";
    termsLink.rel = "noopener noreferrer";
    termsLink.textContent = "Termeni și condiții";
    details.appendChild(termsLink);

    const consent = document.createElement("label");
    consent.className = "ptg-consent";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.required = true;
    const consentText = document.createElement("span");
    consentText.textContent = "Am citit și accept Termenii și condițiile Panel Pro.";
    consent.append(checkbox, consentText);
    const error = document.createElement("p");
    error.className = "ptg-error";
    error.setAttribute("aria-live", "polite");
    body.append(intro, list, details, consent, error);

    const actions = document.createElement("div");
    actions.className = "ptg-actions";
    const accept = document.createElement("button");
    accept.type = "button";
    accept.disabled = true;
    accept.textContent = "Accept și continuă";
    checkbox.addEventListener("change", () => {
      accept.disabled = !checkbox.checked;
      error.textContent = "";
    });
    actions.appendChild(accept);
    dialog.append(head, body, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    checkbox.focus();

    return new Promise((resolve) => {
      accept.addEventListener("click", () => {
        if (!checkbox.checked) return;
        if (!saveAcceptance(identity)) {
          error.textContent = "Acceptarea nu a putut fi salvată. Permite stocarea locală și încearcă din nou.";
          return;
        }
        overlay.remove();
        resolve(true);
      });
    });
  }

  window.PANEL_TERMS_VERSION = TERMS_VERSION;
  window.requirePanelTermsAcceptance = ({ identity } = {}) => {
    const normalizedIdentity = String(identity || "account");
    if (isAccepted(normalizedIdentity)) return Promise.resolve(true);
    if (activePromise) return activePromise;
    activePromise = createDialog(normalizedIdentity).finally(() => { activePromise = null; });
    return activePromise;
  };
})();
