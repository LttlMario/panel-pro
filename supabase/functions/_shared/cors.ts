// Domeniul public al panelului. Toate răspunsurile CORS trebuie să reflecte
// originea reală din browser, altfel autentificarea este blocată la preflight.
const PUBLIC_ORIGIN = 'https://panel-pro.ro';
const FALLBACK_ORIGINS = new Set([
  PUBLIC_ORIGIN,
  'https://lttlmario.github.io',
]);
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i;

export function getCorsHeaders(request: Request) {
  const origin = String(request.headers.get('origin') || '').trim();
  const allowedOrigin = FALLBACK_ORIGINS.has(origin) || LOCAL_ORIGIN.test(origin)
    ? origin
    : PUBLIC_ORIGIN;

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

export function corsOptions(request: Request) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
