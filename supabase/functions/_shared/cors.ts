const PUBLIC_ORIGIN = 'https://lttlmario.github.io';
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i;

export function getCorsHeaders(request: Request) {
  const origin = String(request.headers.get('origin') || '').trim();
  const allowedOrigin = origin === PUBLIC_ORIGIN || LOCAL_ORIGIN.test(origin)
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
