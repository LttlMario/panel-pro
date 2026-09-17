import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const PROJECT_URL = 'https://vkvsabbbawyiurnaiugo.supabase.co';
const serviceKey = () => String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim() || (() => { try { return String(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '').trim(); } catch (_) { return ''; } })();
const maps: Record<string, { width: number; height: number; image: string; label: string }> = {
  ls: { width: 2560, height: 2560, image: 'https://panel-pro.ro/img/gtav.jpg', label: 'Los Santos & Blaine County' },
  cayo: { width: 1122, height: 1060, image: 'https://panel-pro.ro/img/cayo.jpg', label: 'Cayo Perico' },
  maldive: { width: 1440, height: 864, image: 'https://panel-pro.ro/img/maldive.jpg', label: 'Maldive' },
};
const escapeXml = (value: unknown) => String(value ?? '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));

Deno.serve(async (request) => {
  const key = String(new URL(request.url).searchParams.get('map') || 'ls').toLowerCase();
  const map = maps[key] || maps.ls;
  try {
    const db = createClient(PROJECT_URL, serviceKey());
    const { data, error } = await db.from('illegal_locations').select('title,x,y,map_key').eq('map_key', maps[key] ? key : 'ls').order('title').limit(100);
    if (error) throw error;
    const pins = (data || []).map((location: any) => {
      const x = Math.max(0, Math.min(map.width, (Number(location.x) / 100) * map.width));
      const y = Math.max(0, Math.min(map.height, map.height - (Number(location.y) / 100) * map.height));
      const title = escapeXml(String(location.title || 'Locație'));
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle cy="-13" r="13" fill="#ef4444" stroke="#fff" stroke-width="4"/><circle cy="-13" r="4" fill="#fff"/><path d="M-7 -3 L0 12 L7 -3" fill="#ef4444" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><text x="0" y="34" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="700" fill="#fff" stroke="#111827" stroke-width="7" paint-order="stroke">${title}</text></g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}"><image href="${map.image}" xlink:href="${map.image}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="none"/>${pins}</svg>`;
    return new Response(svg, { status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) {
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="100%" height="100%" fill="#111827"/><text x="30" y="150" fill="#fff" font-family="Arial" font-size="28">Harta nu a putut fi încărcată.</text></svg>`, { status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
});
