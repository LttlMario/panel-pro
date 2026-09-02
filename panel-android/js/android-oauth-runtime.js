(() => {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;

  // Android folosește copia locală, curată, a aplicației panel-pro.
  document.documentElement.classList.add('panel-ios-device');
  document.documentElement.classList.add('panel-android-device');

  const mobileFooterStyle = document.createElement('style');
  mobileFooterStyle.textContent = `
    html.panel-android-device #panel-global-footer .pgf-android-badge,
    html.panel-android-device #panel-global-footer .pgf-ios-badge {
      display: none !important;
    }
  `;
  document.head.appendChild(mobileFooterStyle);

  // Discord revine pe callback-ul public, iar MainActivity îl rescrie
  // înapoi către login.html local înainte ca WebView-ul să părăsească aplicația.
  window.PANEL_ANDROID_REDIRECT_URI = 'https://panel-pro.ro/login.html';

  const RELEASES_URL = 'https://api.github.com/repos/LttlMario/panel-android/releases?per_page=10';
  const CACHE_KEY = 'panel_android_latest_release';
  const CACHE_TTL = 6 * 60 * 60 * 1000;
  const compareVersions = (left, right) => {
    const a = String(left || '').replace(/^v/i, '').split('.').map((value) => Number(value) || 0);
    const b = String(right || '').replace(/^v/i, '').split('.').map((value) => Number(value) || 0);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
    }
    return 0;
  };
  const readCachedRelease = () => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return cached?.savedAt && Date.now() - cached.savedAt < CACHE_TTL ? cached.release : null;
    } catch (_) { return null; }
  };
  const openRelease = async (url) => {
    const Browser = capacitor?.Plugins?.Browser;
    if (Browser?.open) await Browser.open({ url });
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  const showUpdateBanner = (release, currentVersion) => {
    if (!release || compareVersions(release.version, currentVersion) <= 0 || document.getElementById('panel-android-update-banner')) return;
    const asset = release.assets?.find((item) => String(item.name || '').toLowerCase().endsWith('.apk'));
    if (!asset?.browser_download_url) return;
    const banner = document.createElement('aside');
    banner.id = 'panel-android-update-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<strong>Este disponibilă o actualizare Panel Pro</strong><span>Versiunea ${release.version} este disponibilă. Ai instalată versiunea ${currentVersion}.</span><button type="button">Descarcă actualizarea</button><button type="button" aria-label="Închide">×</button>`;
    const style = document.createElement('style');
    style.textContent = '#panel-android-update-banner{position:fixed;left:12px;right:12px;bottom:14px;z-index:9999;display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:13px 15px;border:1px solid #22d3ee;border-radius:15px;background:#0f172a;color:#e2e8f0;box-shadow:0 14px 40px #020617cc;font:12px system-ui,sans-serif}#panel-android-update-banner span{grid-column:1/-1;color:#94a3b8}#panel-android-update-banner button{border:1px solid #334155;border-radius:9px;background:#172554;color:#e0f2fe;padding:8px 10px;font-weight:700}#panel-android-update-banner button:first-of-type{background:#0891b2;border-color:#22d3ee;color:#ecfeff}@media(max-width:560px){#panel-android-update-banner{grid-template-columns:1fr auto}#panel-android-update-banner button:first-of-type{grid-column:1}#panel-android-update-banner button:last-of-type{grid-column:2;grid-row:1}}';
    document.head.appendChild(style);
    document.body.appendChild(banner);
    banner.querySelector('button:first-of-type').onclick = () => openRelease(asset.browser_download_url);
    banner.querySelector('button:last-of-type').onclick = () => banner.remove();
  };
  const checkForUpdate = async () => {
    const appInfo = await capacitor?.Plugins?.App?.getInfo?.().catch?.(() => null);
    const currentVersion = String(appInfo?.version || '').trim();
    if (!currentVersion) return;
    let release = readCachedRelease();
    if (!release) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
        const releases = response.ok ? await response.json() : [];
        const item = Array.isArray(releases) ? releases.find((candidate) => !candidate.draft && candidate.assets?.some((asset) => String(asset.name || '').toLowerCase().endsWith('.apk'))) : null;
        release = item ? { version: String(item.tag_name || '').replace(/^v/i, ''), assets: item.assets } : null;
        if (release) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release }));
      } catch (_) { release = null; }
      clearTimeout(timer);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => showUpdateBanner(release, currentVersion), { once: true });
    else showUpdateBanner(release, currentVersion);
  };
  checkForUpdate();
})();
