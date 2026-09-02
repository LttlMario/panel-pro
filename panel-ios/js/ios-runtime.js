(() => {
  'use strict';
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return;
  document.documentElement.classList.add('panel-ios-device');
  const ensureMeta = (name, content) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = name;
      document.head.appendChild(meta);
    }
    meta.content = content;
  };
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = 'manifest.webmanifest';
    document.head.appendChild(manifest);
  }
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
    document.documentElement.classList.add('panel-ios-standalone');
  }
  const keepViewportStable = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    document.documentElement.style.setProperty('--ios-visible-height', `${Math.round(viewport.height)}px`);
  };
  window.visualViewport?.addEventListener('resize', keepViewportStable, { passive: true });
  window.visualViewport?.addEventListener('scroll', keepViewportStable, { passive: true });
  keepViewportStable();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    const reloadKey = 'panel_ios_updated_once';
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (sessionStorage.getItem(reloadKey) === '1') return;
      sessionStorage.setItem(reloadKey, '1');
      location.reload();
    });
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
        sessionStorage.removeItem(reloadKey);
        await registration.update();
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      } catch (error) {
        console.warn('Actualizarea automată iOS nu a putut fi verificată.', error);
      }
    }, { once: true });
  }
})();
