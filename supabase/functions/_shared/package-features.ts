export const PACKAGE_FEATURES = Object.freeze({
  core: { label: 'Dashboard și Pontaj', pages: ['index.html', 'pontaj.html'] },
  announcements: { label: 'Anunțuri și sondaje', pages: ['anunturi.html'] },
  requests: { label: 'Cereri și absențe', pages: ['cereri.html'] },
  contracts: { label: 'Contracte', pages: ['contracte.html'] },
  reports: { label: 'Rapoarte', pages: ['rapoarte.html'] },
  legal_marketplace: { label: 'Marketplace legal', pages: ['marketplace.html'] },
  legal_tools: { label: 'Resurse legale', pages: ['calculator.html', 'bucatarie.html', 'craftmecanics.html'] },
  assistant: { label: 'Asistentul panelului', pages: ['asistent.html'] },
  status_live: { label: 'Status Live', pages: ['status-live.html'] },
  illegal_calculator: { label: 'Calculator ilegal', pages: ['calculatorilegal.html'] },
  illegal_locations: { label: 'Locații ilegale', pages: ['locatiiilegale.html'] },
  illegal_marketplace: { label: 'Marketplace ilegal', pages: ['marketplace-ilegal.html'] }
});

export const STANDARD_PACKAGE_FEATURES = Object.freeze([
  'core', 'announcements', 'requests', 'contracts', 'reports',
  'legal_marketplace', 'legal_tools', 'assistant', 'status_live'
]);

export const FULL_PACKAGE_FEATURES = Object.freeze(Object.keys(PACKAGE_FEATURES));

export function resolvePackageFeatures(packageValue: any = {}) {
  if (packageValue?.code === 'full') return [...FULL_PACKAGE_FEATURES];
  const explicit = Array.isArray(packageValue?.features)
    ? [...new Set(packageValue.features.map(String).filter((feature) => Object.prototype.hasOwnProperty.call(PACKAGE_FEATURES, feature)))]
    : [];
  return [...new Set([...STANDARD_PACKAGE_FEATURES, ...explicit])];
}

export function packageAllowsPage(page: string, packageValue: any = {}) {
  if (page === 'index.html' || page === 'pontaj.html') return true;
  const feature = Object.entries(PACKAGE_FEATURES).find(([, config]: any) => config.pages.includes(page))?.[0];
  return Boolean(feature && resolvePackageFeatures(packageValue).includes(feature));
}

export function packageCatalogForClient() {
  return Object.fromEntries(Object.entries(PACKAGE_FEATURES).map(([key, config]: any) => [key, { label: config.label, pages: [...config.pages], standard: STANDARD_PACKAGE_FEATURES.includes(key), full: true }]));
}
