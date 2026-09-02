import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { isPlatformAdminAccount } from '../_shared/platform-admin.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { requestDiscordTarget } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const allowedKinds = new Set(['suggestion', 'rating']);
const allowedReactions = new Set(['👍', '❤️', '✅', '🤔', '❌']);
const site = 'https://panel-pro.ro';
const limitText = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
const normalizeKind = (value: unknown) => String(value ?? '').trim().toLowerCase();

const secretKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const channelSecretForTarget = async (db: any, kind: string, target: string) => {
  const prefix = kind === 'rating' ? 'public_rating_channel_' : 'public_community_channel_';
  const name = `${prefix}${target === 'secondary' ? 'secondary' : 'primary'}`;
  const channelId = String(await getPlatformSecret(db, name)).trim();
  if (!/^\d{15,22}$/.test(channelId)) return null;
  return { target, transport: 'bot' as const, channel_id: channelId };
};
const postUrl = (kind: string, id: string) => `${site}/${kind === 'rating' ? 'rate-panel.html' : 'suggestii.html'}?post=${encodeURIComponent(id)}`;
const stars = (rating: unknown) => {
  const value = Number(rating || 0);
  return value ? `${'★'.repeat(value)}${'☆'.repeat(5 - value)} (${value}/5)` : '';
};

async function buildEmbed(post: any) {
  const label = post.kind === 'rating' ? 'Evaluare Panel' : 'Sugestie nouă';
  const description = post.kind === 'rating'
    ? `${stars(post.rating)}\n\n${post.content}`
    : post.content;
  return {
    title: `${post.kind === 'rating' ? '⭐' : '💡'} ${post.title || label}`,
    description,
    color: post.kind === 'rating' ? 16766720 : 65334,
    url: postUrl(post.kind, post.id),
    fields: [
      { name: 'Autor', value: `${post.author_name} · ${post.author_organization_name || 'Organizație necunoscută'}`, inline: false },
      { name: 'Deschide în Panel Pro', value: `[Vezi postarea](${postUrl(post.kind, post.id)})`, inline: false },
    ],
    footer: { text: `${label} · Panel Pro` },
    timestamp: post.updated_at || post.created_at,
  };
}

async function syncDiscordEmbeds(db: any, post: any) {
  const embed = await buildEmbed(post);
  const existing = Array.isArray(post.discord_message_ids) ? post.discord_message_ids : [];
  const next: any[] = [];
  let sent = 0;
  let failed = 0;
  for (const target of ['primary', 'secondary']) {
    const destination = await channelSecretForTarget(db, post.kind, target);
    if (!destination) continue;
    const previous = existing.find((item: any) => item?.target === target && item?.id);
    try {
      if (previous) {
        const response = await requestDiscordTarget(db, destination, JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }), { method: 'PATCH', messageId: String(previous.id) });
        if (response.ok) { next.push({ target, id: String(previous.id) }); sent++; continue; }
      }
      const response = await requestDiscordTarget(db, destination, JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }));
      if (!response.ok) { failed++; continue; }
      const message = await response.json();
      if (message?.id) next.push({ target, id: String(message.id) });
      sent++;
    } catch (_) { failed++; }
  }
  const { error } = await db.from('platform_public_posts').update({ discord_message_ids: next }).eq('id', post.id);
  if (error) throw error;
  return { ids: next, sent, failed };
}

async function deleteDiscordEmbeds(db: any, post: any) {
  const refs = Array.isArray(post.discord_message_ids) ? post.discord_message_ids : [];
  await Promise.all(refs.map(async (ref: any) => {
    if (!ref?.target || !ref?.id) return;
    const destination = await channelSecretForTarget(db, post.kind, String(ref.target));
    if (!destination) return;
    try { await requestDiscordTarget(db, destination, null, { method: 'DELETE', messageId: String(ref.id) }); } catch (_) {}
  }));
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = secretKey();
    if (!key) throw new Error('Cheia serverului Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request);
    const platformAdmin = session.is_platform_admin || await isPlatformAdminAccount(db, session.discord_id);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'list').trim();
    const { data: allowed, error: rateError } = await db.rpc('consume_panel_rate_limit', {
      p_key: `public-feedback:${session.discord_id}`,
      p_limit: 120,
      p_window_seconds: 900,
    });
    if (rateError) throw rateError;
    if (allowed === false) return reply({ error: 'Ai atins limita temporară. Încearcă din nou mai târziu.' }, 429);

    if (action === 'access') return reply({ read: true, write: true, platform_admin: platformAdmin });

    if (action === 'list') {
      const { data: posts, error: postError } = await db.from('platform_public_posts').select('*').order('created_at', { ascending: false }).limit(500);
      if (postError) throw postError;
      const ids = (posts || []).map((item: any) => item.id).filter(Boolean);
      const { data: reactions, error: reactionError } = ids.length
        ? await db.from('platform_public_reactions').select('*').in('post_id', ids)
        : { data: [], error: null };
      if (reactionError) throw reactionError;
      return reply({ posts: (posts || []).map((post: any) => ({
        ...post,
        reactions: (reactions || []).filter((item: any) => item.post_id === post.id),
        can_edit: platformAdmin || String(post.author_discord_id) === session.discord_id,
        can_delete: platformAdmin || String(post.author_discord_id) === session.discord_id,
      })) });
    }

    if (action === 'test_bot_channel') {
      if (!platformAdmin) return reply({ error: 'Doar administratorul platformei poate testa canalele globale ale botului.' }, 403);
      const target = String(body.target || 'primary') === 'secondary' ? 'secondary' : 'primary';
      const destination = await channelSecretForTarget(db, 'suggestion', target);
      if (!destination) return reply({ error: `Canalul global ${target} nu este configurat în Secrete platformă.` }, 409);
      const response = await requestDiscordTarget(db, destination, JSON.stringify({ content: '✅ Test canal bot global Panel Pro.', allowed_mentions: { parse: [] } }));
      if (!response.ok) return reply({ error: `Discord a răspuns cu HTTP ${response.status}.` }, 400);
      return reply({ ok: true });
    }

    if (action === 'create') {
      const kind = normalizeKind(body.kind);
      if (!allowedKinds.has(kind)) return reply({ error: 'Tip de feedback invalid.' }, 400);
      const content = limitText(body.content, 4000);
      const rating = kind === 'rating' ? Number(body.rating) : null;
      if (!content) return reply({ error: 'Completează mesajul.' }, 400);
      if (kind === 'rating' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return reply({ error: 'Alege o notă între 1 și 5.' }, 400);
      const [{ data: user }, { data: organization }] = await Promise.all([
        db.from('users').select('display_name,username').eq('discord_id', session.discord_id).maybeSingle(),
        db.from('organizations').select('name').eq('id', session.organization_id).maybeSingle(),
      ]);
      const authorName = limitText(user?.display_name || user?.username || session.discord_id, 120);
      const title = limitText(body.title || (kind === 'rating' ? 'Evaluare Panel Pro' : 'Sugestie'), 140);
      const { data: post, error } = await db.from('platform_public_posts').insert({
        kind, title, content, rating, author_discord_id: session.discord_id,
        author_name: authorName, author_organization_id: session.organization_id,
        author_organization_name: limitText(organization?.name || '', 160),
      }).select('*').single();
      if (error) throw error;
      const discord = await syncDiscordEmbeds(db, post);
      return reply({ post: { ...post, reactions: [], can_edit: true, can_delete: true }, discord });
    }

    const postId = String(body.post_id || '').trim();
    if (!postId) return reply({ error: 'Postarea nu a fost identificată.' }, 400);
    const { data: post, error: postError } = await db.from('platform_public_posts').select('*').eq('id', postId).maybeSingle();
    if (postError) throw postError;
    if (!post) return reply({ error: 'Postarea nu mai există.' }, 404);

    if (action === 'react') {
      const reaction = String(body.reaction || '');
      if (!allowedReactions.has(reaction)) return reply({ error: 'Reacție invalidă.' }, 400);
      const key = { post_id: postId, user_discord_id: session.discord_id, reaction };
      const { data: existing } = await db.from('platform_public_reactions').select('id').match(key).maybeSingle();
      const result = existing
        ? await db.from('platform_public_reactions').delete().eq('id', existing.id)
        : await db.from('platform_public_reactions').insert(key);
      if (result.error) throw result.error;
      return reply({ ok: true });
    }

    const canManage = platformAdmin || String(post.author_discord_id) === session.discord_id;
    if (!canManage) return reply({ error: 'Poți administra doar postările tale.' }, 403);

    if (action === 'update') {
      const kind = normalizeKind(body.kind || post.kind);
      const content = limitText(body.content, 4000);
      const rating = kind === 'rating' ? Number(body.rating) : null;
      if (kind !== post.kind) return reply({ error: 'Tipul postării nu poate fi schimbat.' }, 400);
      if (!content) return reply({ error: 'Completează mesajul.' }, 400);
      if (kind === 'rating' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) return reply({ error: 'Alege o notă între 1 și 5.' }, 400);
      const { data: updated, error } = await db.from('platform_public_posts').update({ title: limitText(body.title || post.title, 140), content, rating, updated_at: new Date().toISOString() }).eq('id', postId).select('*').single();
      if (error) throw error;
      const discord = await syncDiscordEmbeds(db, updated);
      return reply({ ok: true, post: updated, discord });
    }

    if (action === 'delete') {
      await deleteDiscordEmbeds(db, post);
      const { error } = await db.from('platform_public_posts').delete().eq('id', postId);
      if (error) throw error;
      return reply({ ok: true, deleted_id: postId });
    }

    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    console.error('manage-public-feedback:', error);
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    return reply({ error: message }, /Sesiunea|Autentifică-te/i.test(message) ? 401 : 400);
  }
});
