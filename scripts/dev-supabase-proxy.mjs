import http from 'node:http';

const remoteUrl = process.env.PANEL_SUPABASE_URL || 'https://vkvsabbbawyiurnaiugo.supabase.co';
const port = Number(process.env.PANEL_SUPABASE_PROXY_PORT || 8787);

const isLocalOrigin = (origin) => origin === 'null' || /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/i.test(origin || '');

const server = http.createServer(async (request, response) => {
  const origin = String(request.headers.origin || '');
  const allowOrigin = isLocalOrigin(origin) ? (origin === 'null' ? '*' : origin) : '*';
  const requestedHeaders = String(request.headers['access-control-request-headers'] || '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  const allowedHeaders = [...new Set([
    'authorization', 'apikey', 'content-type', 'x-panel-session', 'x-cron-secret',
    ...requestedHeaders,
  ])].join(',');
  const cors = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (request.method === 'OPTIONS') {
    response.writeHead(204, cors);
    response.end();
    return;
  }

  const target = new URL(request.url || '/', remoteUrl);
  const headers = { ...request.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method || '') ? undefined : Buffer.concat(chunks),
    });
    const outputHeaders = { ...cors };
    for (const [key, value] of upstream.headers) {
      if (!['access-control-allow-origin', 'access-control-allow-headers', 'access-control-allow-methods', 'content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        outputHeaders[key] = value;
      }
    }
    response.writeHead(upstream.status, outputHeaders);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(502, { ...cors, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: `Proxy Supabase indisponibil: ${error instanceof Error ? error.message : 'eroare necunoscută'}` }));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Proxy Supabase local activ pe http://127.0.0.1:${port} → ${remoteUrl}`);
});
