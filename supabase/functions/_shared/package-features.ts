export const PACKAGE_FEATURES = Object.freeze({
  core: { label: 'Dashboard și Pontaj', pages: ['index.html', 'pontaj.html'] },
  announcements: { label: 'Anunțuri și sondaje', pages: ['anunturi.html'] },
  announcements_departments: { label: 'Anunțuri · Angajați', pages: ['anunturi.html', 'anunturi-angajati.html'] },
  announcements_organization: { label: 'Anunțuri · Organizație', pages: ['anunturi.html', 'anunturi-organizatie.html'] },
  requests: { label: 'Învoiri', pages: ['cereri.html'] },
  requests_departments: { label: 'Învoiri · Angajați', pages: ['cereri.html', 'cereri-angajati.html'] },
  requests_organization: { label: 'Învoiri · Organizație', pages: ['cereri.html', 'cereri-organizatie.html'] },
  contracts: { label: 'Contracte', pages: ['contracte.html'] },
  reports: { label: 'Rapoarte', pages: ['rapoarte.html'] },
  event_reminders: { label: 'Evenimente și remindere', pages: ['organizatie-evenimente.html'] },
  legal_marketplace: { label: 'Marketplace legal', pages: ['marketplace.html'] },
  legal_tools: { label: 'Resurse legale', pages: ['calculator.html', 'bucatarie.html'] },
  assistant: { label: 'Asistentul panelului', pages: ['asistent.html'] },
  status_live: { label: 'Status Live', pages: ['status-live.html'] },
  discipline_departments: { label: 'Avertismente și sancțiuni · Angajați', pages: ['anunturi.html', 'anunturi-angajati.html'] },
  discipline_organization: { label: 'Avertismente și sancțiuni · Organizație', pages: ['anunturi.html', 'anunturi-organizatie.html'] },
  actions_organization: { label: 'Acțiuni · Organizație', pages: ['anunturi.html', 'anunturi-organizatie.html'] },
  stash: { label: 'Stash organizație', pages: ['stash.html'] },
  illegal_calculator: { label: 'Calculator ilegal', pages: ['calculatorilegal.html'] },
  illegal_locations: { label: 'Locații ilegale', pages: ['locatiiilegale.html'] },
  illegal_marketplace: { label: 'Marketplace ilegal', pages: ['marketplace-ilegal.html'] },
  illegal_minigames: { label: 'Minigames', pages: ['minigames.html'] }
});

export const STANDARD_PACKAGE_FEATURES = Object.freeze([
  'core', 'contracts', 'reports', 'legal_marketplace', 'legal_tools',
  'announcements_departments', 'requests_departments', 'discipline_departments', 'event_reminders'
]);

export const FULL_PACKAGE_FEATURES = Object.freeze(Object.keys(PACKAGE_FEATURES));
export const OPERATIONS_PACKAGE_FEATURES = Object.freeze([
  'core', 'announcements_organization', 'requests_organization', 'reports', 'discipline_organization',
  'actions_organization', 'event_reminders',
  'illegal_calculator', 'illegal_locations', 'illegal_marketplace', 'illegal_minigames'
]);

export function resolvePackageFeatures(packageValue: any = {}) {
  // Discord-only tenants are intentionally blocked from the web by
  // packageAllowsPage(), but the Discord interaction runtime still needs a
  // feature catalog so its buttons can operate without a web subscription.
  if (packageValue?.code === 'discord') return [...FULL_PACKAGE_FEATURES];
  if (packageValue?.code === 'full') return [...FULL_PACKAGE_FEATURES];
  if (packageValue?.code === 'operations') return [...OPERATIONS_PACKAGE_FEATURES];
  // Standard is intentionally closed: a stored JSON value must never be able
  // to unlock Full-only pages or organization-level discipline by accident.
  return [...STANDARD_PACKAGE_FEATURES];
}

export function packageLabel(packageValue: any = {}) {
  return packageValue?.code === 'full' ? 'Full' : packageValue?.code === 'operations' ? 'Operations' : 'Standard';
}

export function packageAllowsPage(page: string, packageValue: any = {}) {
  if (packageValue?.code === 'discord') return false;
  if (page === 'index.html' || page === 'pontaj.html') return true;
  const enabledFeatures = resolvePackageFeatures(packageValue);
  const pageFeatures = Object.entries(PACKAGE_FEATURES)
    .filter(([, config]: any) => config.pages.includes(page))
    .map(([feature]) => feature);
  return pageFeatures.some((feature) => enabledFeatures.includes(feature));
}

export function packageCatalogForClient() {
  return Object.fromEntries(Object.entries(PACKAGE_FEATURES).map(([key, config]: any) => [key, { label: config.label, pages: [...config.pages], standard: STANDARD_PACKAGE_FEATURES.includes(key), operations: OPERATIONS_PACKAGE_FEATURES.includes(key), full: true }]));
}
