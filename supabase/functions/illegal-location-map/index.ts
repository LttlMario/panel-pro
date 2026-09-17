import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';

const PROJECT_URL = 'https://vkvsabbbawyiurnaiugo.supabase.co';
const serviceKey = () => String(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim() || (() => { try { return String(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '').trim(); } catch (_) { return ''; } })();
const maps: Record<string, { width: number; height: number; image: string; label: string }> = {
  ls: { width: 2560, height: 2560, image: 'https://wsrv.nl/?url=https%3A%2F%2Fpanel-pro.ro%2Fimg%2Fgtav.jpg&w=1280&q=60&output=jpg', label: 'Los Santos & Blaine County' },
  cayo: { width: 1122, height: 1060, image: 'https://wsrv.nl/?url=https%3A%2F%2Fpanel-pro.ro%2Fimg%2Fcayo.jpg&w=1122&q=65&output=jpg', label: 'Cayo Perico' },
  maldive: { width: 1440, height: 864, image: 'https://wsrv.nl/?url=https%3A%2F%2Fpanel-pro.ro%2Fimg%2Fmaldive.jpg&w=1200&q=65&output=jpg', label: 'Maldive' },
};
const categories: Record<string, { icon: string; color: string }> = {
  drugs: { icon: '🌿', color: '#ff5555' }, weapons: { icon: '⚙️', color: '#f59e0b' }, suppliers: { icon: '🧪', color: '#ec4899' }, deliveries: { icon: '🚐', color: '#a855f7' }, hospitals: { icon: '🏥', color: '#3b82f6' }, mushrooms: { icon: '🍄', color: '#10b981' }, smeltery: { icon: '🏭', color: '#f97316' },
};
const escapeXml = (value: unknown) => String(value ?? '').replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char] || char));
const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
};

Deno.serve(async (request) => {
  const key = String(new URL(request.url).searchParams.get('map') || 'ls').toLowerCase();
  const map = maps[key] || maps.ls;
  try {
    const db = createClient(PROJECT_URL, serviceKey());
    const { data, error } = await db.from('illegal_locations').select('title,x,y,map_key,category').eq('map_key', maps[key] ? key : 'ls').order('title').limit(100);
    if (error) throw error;
    const backgroundResponse = await fetch(map.image);
    if (!backgroundResponse.ok) throw new Error(`Harta nu a putut fi încărcată (${backgroundResponse.status}).`);
    const backgroundType = String(backgroundResponse.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const backgroundData = `data:${backgroundType};base64,${toBase64(new Uint8Array(await backgroundResponse.arrayBuffer()))}`;
    const pins = (data || []).map((location: any) => {
      const x = Math.max(0, Math.min(map.width, (Number(location.x) / 100) * map.width));
      const y = Math.max(0, Math.min(map.height, map.height - (Number(location.y) / 100) * map.height));
      const title = escapeXml(String(location.title || 'Locație'));
      const category = categories[String(location.category || '')] || { icon: '📍', color: '#ef4444' };
      const icon = escapeXml(category.icon);
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle cy="0" r="27" fill="#0b1220" stroke="${category.color}" stroke-width="5"/><text x="0" y="8" text-anchor="middle" font-family="Segoe UI Emoji,Arial,sans-serif" font-size="23">${icon}</text><text x="0" y="53" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#fff" stroke="#111827" stroke-width="7" paint-order="stroke">${title}</text></g>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}"><image href="${backgroundData}" xlink:href="${backgroundData}" x="0" y="0" width="${map.width}" height="${map.height}" preserveAspectRatio="none"/>${pins}</svg>`;
    return new Response(svg, { status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) {
    return new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="300"><rect width="100%" height="100%" fill="#111827"/><text x="30" y="150" fill="#fff" font-family="Arial" font-size="28">Harta nu a putut fi încărcată.</text></svg>`, { status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
});
