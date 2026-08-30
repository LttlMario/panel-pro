const serverStatusUrl = 'https://fivem.gta5.ro/dynamic.json';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'GET') return reply({ error: 'Metodă invalidă.' }, 405);

  try {
    const response = await fetch(serverStatusUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) throw new Error(`Serverul FiveM a răspuns cu HTTP ${response.status}.`);

    const data = await response.json();
    const players = Number(data.clients);
    const maxPlayers = Number(data.sv_maxclients);

    if (!Number.isFinite(players) || !Number.isFinite(maxPlayers)) {
      throw new Error('Răspunsul serverului nu conține numărul de jucători.');
    }

    return reply({
      online: true,
      players: Math.max(0, Math.round(players)),
      maxPlayers: Math.max(0, Math.round(maxPlayers)),
    });
  } catch (error) {
    console.error('FIVEM STATUS ERROR', error instanceof Error ? error.message : error);
    return reply({ online: false, players: null, maxPlayers: null });
  }
});
