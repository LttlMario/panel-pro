import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates, requestDiscordTarget } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json'
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const text = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max);
const validId = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const validNumber = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

const webhookUrlPattern = /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\//;
const routeTargets = (route: any, legacyUrl = '') => {
  const targets = ['primary', 'secondary']
    .map((key) => ({ key, item: route?.[key] }))
    .filter((target) => target.item?.enabled === true && webhookUrlPattern.test(String(target.item.url || '')))
    .map((target) => ({ key: target.key, url: String(target.item.url).trim() }));
  if (!targets.length && webhookUrlPattern.test(String(legacyUrl || '').trim())) targets.push({ key: 'legacy', url: String(legacyUrl).trim() });
  return targets;
};

const syncDiscordWebhook = async (db: any, organizationId: string, routeKey: string, embed: any, existingMessageIds: any = {}, createIfMissing = true, itemId = '') => {
  const { data: settings, error } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  const destinations = routeCandidates(settings, routeKey);
  if (!destinations.some((item) => item.candidates.length)) return { route: routeKey, configured: false, sent: 0, edited: 0, failed: 0, message_ids: {} };
  if (!createIfMissing) return { route: routeKey, configured: true, sent: 0, edited: 0, failed: 0, message_ids: {} };
  const delivery = await deliverDiscordRoute(db, settings, routeKey, JSON.stringify(itemId
    ? { username: 'Panel Pro · Stash', embeds: [embed], allowed_mentions: { parse: [] }, components: [{ type: 1, components: [{ type: 2, style: 4, label: 'Șterge articolul', custom_id: `panel:stash:delete_item:${itemId}` }] }] }
    : { username: 'Panel Pro · Stash', embeds: [embed], allowed_mentions: { parse: [] } }), { messageIds: existingMessageIds });
  const messageIds: Record<string, string> = {};
  for (const item of delivery.results || []) if (item.id) messageIds[item.target] = String(item.id);
  return { route: routeKey, configured: true, sent: delivery.results.filter((item: any) => !existingMessageIds?.[item.target]).length, edited: delivery.results.filter((item: any) => existingMessageIds?.[item.target]).length, failed: delivery.failures.length, message_ids: messageIds };
};

const syncAndStoreWebhook = async (db: any, table: string, row: any, organizationId: string, routeKey: string, embed: any) => {
  const webhook = await syncDiscordWebhook(db, organizationId, routeKey, embed, row?.discord_message_ids || {}, true, table === 'organization_stash_items' ? String(row.id) : '');
  if (Object.keys(webhook.message_ids || {}).length) {
    const { error } = await db.from(table).update({ discord_message_ids: { ...(row?.discord_message_ids || {}), ...webhook.message_ids } }).eq('id', row.id);
    if (error) throw error;
  }
  return webhook;
};

const deleteStoredWebhookMessages = async (db: any, organizationId: string, routeKey: string, messageIds: any = {}) => {
  const { data: settings, error } = await db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  const targets = routeCandidates(settings, routeKey).flatMap((item) => item.candidates);
  let deleted = 0;
  let failed = 0;
  await Promise.all(targets.map(async (target: any) => {
    const messageId = text(messageIds?.[target.key], 100);
    if (!messageId) return;
    try {
      const response = await requestDiscordTarget(db, target, null, { method: 'DELETE', messageId });
      if (response.ok || response.status === 404) deleted += 1;
      else failed += 1;
    } catch (_) { failed += 1; }
  }));
  return { route: routeKey, configured: targets.length > 0, deleted, failed };
};

const actorDisplayName = async (db: any, discordId: string) => {
  const { data } = await db.from('users').select('display_name,username').eq('discord_id', discordId).maybeSingle();
  return text(data?.display_name || data?.username || discordId, 120);
};

const isOrganizationOwner = async (db: any, organizationId: string, discordId: string) => {
  const { data: guild, error: guildError } = await db.from('organization_guilds')
    .select('guild_id')
    .eq('organization_id', organizationId)
    .eq('kind', 'primary')
    .eq('enabled', true)
    .maybeSingle();
  if (guildError || !guild?.guild_id) return false;
  const botToken = await getPlatformSecret(db, 'discord_bot_token');
  if (!botToken) return false;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guild.guild_id}`, {
      headers: { Authorization: `Bot ${botToken}`, 'User-Agent': 'PanelManagement/1.0 (+https://panel-management.netlify.app)' }
    });
    if (!response.ok) return false;
    const discordGuild = await response.json();
    return String(discordGuild?.owner_id || '') === String(discordId);
  } catch (_) {
    return false;
  }
};

const itemEmbed = (item: any, title = 'Actualizare Stash', withdrawals: any[] = []) => ({
  title,
  color: 0x22c55e,
  fields: [
    { name: 'Articol', value: text(item.title, 1024), inline: true },
    { name: 'Categorie', value: text(item.category, 1024), inline: true },
    { name: 'Număr iteme', value: String(item.quantity), inline: true },
    { name: 'Status', value: ({ available: 'Disponibil', reserved: 'Rezervat', out: 'Epuizat', archived: 'Arhivat' } as any)[item.status] || text(item.status, 100), inline: true },
    { name: 'Detalii', value: text(item.description || 'Fără detalii.', 1024), inline: false },
    { name: 'Retrageri recente', value: withdrawals.length ? withdrawals.slice(0, 5).map((row: any) => `• ${text(row.recipient_name, 120)} — ${row.quantity} iteme${row.note ? ` · ${text(row.note, 180)}` : ''}`).join('\n').slice(0, 1024) : 'Nu au fost înregistrate retrageri.' }
  ],
  footer: { text: `Postat de ${text(item.created_by_name, 120)}` },
  timestamp: new Date().toISOString()
});

const itemEmbedWithHistory = async (db: any, item: any, title: string) => {
  const { data, error } = await db.from('organization_stash_withdrawals').select('quantity,recipient_name,note,created_at').eq('organization_id', item.organization_id).eq('stash_item_id', item.id).order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.warn('Jurnalul retragerilor nu este încă disponibil; embedul va fi sincronizat fără istoric.', error.message);
    return itemEmbed(item, title, []);
  }
  return itemEmbed(item, title, data || []);
};

const requestEmbed = (request: any, statusLabel = 'Cerere nouă din Stash') => ({
  title: statusLabel,
  color: statusLabel === 'Cerere aprobată' ? 0x22c55e : statusLabel === 'Cerere respinsă' ? 0xef4444 : 0xf59e0b,
  fields: [
    { name: 'Articol', value: text(request.item_title, 1024), inline: true },
    { name: 'Cantitate', value: String(request.quantity), inline: true },
    { name: 'Solicitat de', value: text(request.requested_by_name, 1024), inline: true },
    { name: 'Status', value: text(request.status, 100), inline: true },
    { name: 'Notă', value: text(request.note || 'Fără notă.', 1024), inline: false }
  ],
  timestamp: new Date().toISOString()
});

const donationEmbed = (donation: any, title = 'Donație Stash') => ({
  title,
  color: title === 'Donație aprobată' ? 0x38bdf8 : title === 'Donație respinsă' ? 0xef4444 : 0xa78bfa,
  fields: [
    { name: 'Articol', value: text(donation.title, 1024), inline: true },
    { name: 'Categorie', value: text(donation.category, 1024), inline: true },
    { name: 'Număr iteme', value: String(donation.quantity), inline: true },
    { name: 'Donat de', value: text(donation.donated_by_name, 1024), inline: true },
    { name: 'Status', value: text(donation.status, 100), inline: true },
    { name: 'Notă', value: text(donation.note || 'Fără notă.', 1024), inline: false }
  ],
  timestamp: new Date().toISOString()
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    if (!key) throw new Error('Cheia Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, req);
    const organizationId = session.organization_id;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 40);
    const [settingsResult, mappingResult, memberResult] = await Promise.all([
      db.from('app_settings').select('key,value').eq('organization_id', organizationId).in('key', ['page_permissions', 'action_permissions', 'organization_package']),
      db.from('organization_role_mappings').select('discord_role_id,panel_role,enabled').eq('organization_id', organizationId).eq('enabled', true),
      db.from('organization_members').select('panel_role').eq('organization_id', organizationId).eq('discord_id', session.discord_id).eq('active', true).maybeSingle()
    ]);
    if (settingsResult.error || mappingResult.error || memberResult.error) throw settingsResult.error || mappingResult.error || memberResult.error;
    const settingMap = Object.fromEntries((settingsResult.data || []).map((row: any) => [row.key, row.value || {}]));
    if (!session.is_platform_admin && String(settingMap.organization_package?.code || 'standard').toLowerCase() !== 'full') {
      return reply({ error: 'Stash este disponibil doar pentru organizațiile cu pachetul Full.' }, 403);
    }
    const roleIds = new Set(session.discord_role_ids.map(String));
    if (memberResult.data?.panel_role) {
      (mappingResult.data || []).filter((row: any) => String(row.panel_role || '') === String(memberResult.data.panel_role)).forEach((row: any) => roleIds.add(String(row.discord_role_id)));
    }
    const allowed = (permission: string) => {
      if (session.is_platform_admin) return true;
      const ids = permission === 'read'
        ? settingMap.page_permissions?.['stash.html']
        : settingMap.action_permissions?.[`stash.${permission}`];
      return Array.isArray(ids) && ids.some((id: any) => roleIds.has(String(id)));
    };
    const need = (permission: string) => {
      if (!allowed(permission)) throw new Error('Nu ai permisiunea necesară pentru această acțiune.');
    };
    const name = await actorDisplayName(db, session.discord_id);
    const isOwner = session.is_platform_admin || await isOrganizationOwner(db, organizationId, session.discord_id);
    const canDeleteOwn = (row: any, field: string, permission = 'write') => session.is_platform_admin || isOwner || allowed(permission) || String(row?.[field] || '') === String(session.discord_id);
    const access = {
      read: allowed('read') || isOwner,
      write: allowed('write'),
      request: allowed('request'),
      manage_requests: allowed('manage_requests'),
      donate: allowed('donate'),
      approve_donation: allowed('approve_donation'),
      log: allowed('log') || isOwner,
      owner: isOwner
    };

    if (action === 'load') {
      if (!access.read && !access.request && !access.donate && !access.approve_donation && !access.log) need('read');
      const [itemsResult, requestsResult, donationsResult, archivesResult] = await Promise.all([
        access.read
          ? db.from('organization_stash_items').select('*').eq('organization_id', organizationId).neq('status', 'archived').order('created_at', { ascending: false }).limit(300)
          : Promise.resolve({ data: [], error: null }),
        access.manage_requests || access.request || isOwner
          ? db.from('organization_stash_requests').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300)
          : Promise.resolve({ data: [], error: null }),
        access.approve_donation || access.donate || isOwner
          ? db.from('organization_stash_donations').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300)
          : Promise.resolve({ data: [], error: null }),
        access.log
          ? db.from('organization_stash_items').select('*').eq('organization_id', organizationId).eq('status', 'archived').order('updated_at', { ascending: false }).limit(300)
          : Promise.resolve({ data: [], error: null })
      ]);
      if (itemsResult.error || requestsResult.error || donationsResult.error || archivesResult.error) throw itemsResult.error || requestsResult.error || donationsResult.error || archivesResult.error;
      const requests = access.manage_requests || isOwner ? requestsResult.data || [] : (requestsResult.data || []).filter((row: any) => row.requested_by_discord_id === session.discord_id);
      const donations = access.approve_donation || isOwner ? donationsResult.data || [] : (donationsResult.data || []).filter((row: any) => row.donated_by_discord_id === session.discord_id);
      return reply({
        ok: true,
        access,
        items: (itemsResult.data || []).map((row: any) => ({ ...row, can_delete: canDeleteOwn(row, 'created_by_discord_id', 'write') })),
        requests: requests.map((row: any) => ({ ...row, can_delete: canDeleteOwn(row, 'requested_by_discord_id', 'request') })),
        donations: donations.map((row: any) => ({ ...row, can_delete: canDeleteOwn(row, 'donated_by_discord_id', 'donate') })),
        archives: (archivesResult.data || []).map((row: any) => ({ ...row, can_delete: canDeleteOwn(row, 'created_by_discord_id', 'write') }))
      });
    }

    if (action === 'create_item') {
      need('write');
      const title = text(body.title, 140), category = text(body.category || 'General', 60), unit = text(body.unit || 'buc.', 20), description = text(body.description, 4000);
      const quantity = validNumber(body.quantity, 0, 100000000);
      if (title.length < 2 || category.length < 2 || !quantity || unit.length < 1) return reply({ error: 'Completează articolul, categoria și o cantitate validă.' }, 400);
      const { data, error } = await db.from('organization_stash_items').insert({ organization_id: organizationId, title, category, quantity, unit, description, status: ['available', 'reserved', 'out'].includes(body.status) ? body.status : 'available', source_type: 'manual', created_by_discord_id: session.discord_id, created_by_name: name, updated_by_discord_id: session.discord_id }).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_items', data, organizationId, 'log_stash', await itemEmbedWithHistory(db, data, 'Articol nou în Stash'));
      return reply({ ok: true, item: data, webhook });
    }

    if (action === 'update_item') {
      need('write');
      if (!validId(body.id)) return reply({ error: 'Articolul este invalid.' }, 400);
      const updates: any = { updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() };
      if (body.title !== undefined) updates.title = text(body.title, 140);
      if (body.category !== undefined) updates.category = text(body.category, 60);
      if (body.unit !== undefined) updates.unit = text(body.unit, 20);
      if (body.description !== undefined) updates.description = text(body.description, 4000);
      if (body.quantity !== undefined) updates.quantity = validNumber(body.quantity, 0, 100000000);
      if (body.status !== undefined && ['available', 'reserved', 'out', 'archived'].includes(body.status)) updates.status = body.status;
      if (updates.title !== undefined && updates.title.length < 2) return reply({ error: 'Titlul este prea scurt.' }, 400);
      if (updates.quantity === null) return reply({ error: 'Cantitatea este invalidă.' }, 400);
      const { data, error } = await db.from('organization_stash_items').update(updates).eq('organization_id', organizationId).eq('id', body.id).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_items', data, organizationId, 'log_stash', await itemEmbedWithHistory(db, data, 'Stash actualizat'));
      return reply({ ok: true, item: data, webhook });
    }

    if (action === 'withdraw_item') {
      need('write');
      if (!validId(body.id)) return reply({ error: 'Articolul este invalid.' }, 400);
      const quantity = validNumber(body.quantity, 0.01, 100000000);
      const recipientName = text(body.recipient_name, 160);
      if (!quantity || recipientName.length < 2) return reply({ error: 'Completează o cantitate și beneficiarul retragerii.' }, 400);
      const { data: item, error: itemError } = await db.from('organization_stash_items').select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
      if (itemError) throw itemError;
      if (!item || item.status === 'archived') return reply({ error: 'Articolul nu mai este disponibil în Stash.' }, 400);
      if (quantity > Number(item.quantity)) return reply({ error: `Stoc insuficient. Mai sunt ${item.quantity} ${item.unit}.` }, 409);
      const nextQuantity = Number((Number(item.quantity) - quantity).toFixed(2));
      const { data: changed, error: updateError } = await db.from('organization_stash_items').update({ quantity: nextQuantity, status: nextQuantity <= 0 ? 'out' : 'available', updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', body.id).eq('quantity', item.quantity).select('*').maybeSingle();
      if (updateError) throw updateError;
      if (!changed) return reply({ error: 'Stocul s-a modificat între timp. Reîncarcă Stash-ul și încearcă din nou.' }, 409);
      const { error: logError } = await db.from('organization_stash_withdrawals').insert({ organization_id: organizationId, stash_item_id: changed.id, quantity, recipient_discord_id: text(body.recipient_discord_id, 30) || null, recipient_name: recipientName, note: text(body.note, 2000), withdrawn_by_discord_id: session.discord_id, withdrawn_by_name: name });
      if (logError) {
        await db.from('organization_stash_items').update({ quantity: item.quantity, status: item.status, updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', changed.id).eq('quantity', changed.quantity);
        throw logError;
      }
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_items', changed, organizationId, 'log_stash', await itemEmbedWithHistory(db, changed, nextQuantity <= 0 ? 'Stash epuizat' : 'Stoc Stash actualizat'));
      return reply({ ok: true, item: changed, webhook });
    }

    if (action === 'archive_item') {
      need('write');
      if (!validId(body.id)) return reply({ error: 'Articolul este invalid.' }, 400);
      const { data, error } = await db.from('organization_stash_items').update({ status: 'archived', updated_by_discord_id: session.discord_id, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', body.id).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_items', data, organizationId, 'log_stash', await itemEmbedWithHistory(db, data, 'Articol arhivat din Stash'));
      return reply({ ok: true, item: data, webhook });
    }

    if (action === 'delete_item') {
      if (!validId(body.id)) return reply({ error: 'Articolul este invalid.' }, 400);
      const { data: item, error: itemError } = await db.from('organization_stash_items').select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
      if (itemError) throw itemError;
      if (!item) return reply({ error: 'Articolul nu mai există.' }, 404);
      if (!canDeleteOwn(item, 'created_by_discord_id', 'write')) return reply({ error: 'Doar rolurile care pot scrie, proprietarul organizației sau administratorul global pot șterge acest articol.' }, 403);
      const { error } = await db.from('organization_stash_items').delete().eq('organization_id', organizationId).eq('id', body.id);
      if (error) throw error;
      const webhook = await deleteStoredWebhookMessages(db, organizationId, 'log_stash', item.discord_message_ids || {});
      return reply({ ok: true, deleted_id: body.id, webhook });
    }

    if (action === 'create_request') {
      need('request');
      const itemId = validId(body.stash_item_id) ? String(body.stash_item_id) : null;
      let itemTitle = text(body.item_title, 140);
      if (itemId) {
        const { data: item, error } = await db.from('organization_stash_items').select('id,title,status').eq('organization_id', organizationId).eq('id', itemId).maybeSingle();
        if (error) throw error;
        if (!item || item.status === 'archived') return reply({ error: 'Articolul selectat nu mai este disponibil.' }, 400);
        itemTitle = item.title;
      }
      const quantity = validNumber(body.quantity, 0.01, 100000000);
      if (itemTitle.length < 2 || !quantity) return reply({ error: 'Alege un articol și o cantitate validă.' }, 400);
      const { data, error } = await db.from('organization_stash_requests').insert({ organization_id: organizationId, stash_item_id: itemId, item_title: itemTitle, quantity, note: text(body.note, 2000), requested_by_discord_id: session.discord_id, requested_by_name: name }).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_requests', data, organizationId, 'log_stash_requests', requestEmbed(data));
      return reply({ ok: true, request: data, webhook });
    }

    if (action === 'update_request') {
      need('manage_requests');
      if (!validId(body.id) || !['pending', 'approved', 'rejected', 'completed'].includes(body.status)) return reply({ error: 'Cererea sau statusul sunt invalide.' }, 400);
      const { data, error } = await db.from('organization_stash_requests').update({ status: body.status, handled_by_discord_id: session.discord_id, handled_by_name: name, handled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', body.id).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_requests', data, organizationId, 'log_stash_requests', requestEmbed(data, body.status === 'approved' ? 'Cerere aprobată' : body.status === 'rejected' ? 'Cerere respinsă' : 'Cerere actualizată'));
      return reply({ ok: true, request: data, webhook });
    }

    if (action === 'delete_request') {
      if (!validId(body.id)) return reply({ error: 'Cererea este invalidă.' }, 400);
      const { data: request, error: requestError } = await db.from('organization_stash_requests').select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
      if (requestError) throw requestError;
      if (!request) return reply({ error: 'Cererea nu mai există.' }, 404);
      if (!canDeleteOwn(request, 'requested_by_discord_id', 'request')) return reply({ error: 'Doar rolurile care pot trimite cereri, proprietarul organizației sau administratorul global pot șterge această cerere.' }, 403);
      const { error } = await db.from('organization_stash_requests').delete().eq('organization_id', organizationId).eq('id', body.id);
      if (error) throw error;
      const webhook = await syncDiscordWebhook(db, organizationId, 'log_stash_requests', requestEmbed({ ...request, status: 'deleted' }, 'Cerere ștearsă din Stash'), request.discord_message_ids || {}, false);
      return reply({ ok: true, deleted_id: body.id, webhook });
    }

    if (action === 'create_donation') {
      need('donate');
      const title = text(body.title, 140), category = text(body.category || 'Donație', 60), unit = text(body.unit || 'buc.', 20), note = text(body.note, 4000);
      const quantity = validNumber(body.quantity, 0.01, 100000000);
      if (title.length < 2 || category.length < 2 || !quantity || !unit.length) return reply({ error: 'Completează articolul donat și o cantitate validă.' }, 400);
      const { data, error } = await db.from('organization_stash_donations').insert({ organization_id: organizationId, title, category, quantity, unit, note, donated_by_discord_id: session.discord_id, donated_by_name: name }).select('*').single();
      if (error) throw error;
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_donations', data, organizationId, 'log_stash_donations', donationEmbed(data, 'Donație nouă în așteptarea aprobării'));
      return reply({ ok: true, donation: data, webhook });
    }

    if (action === 'update_donation') {
      need('approve_donation');
      if (!validId(body.id) || !['approved', 'rejected'].includes(body.status)) return reply({ error: 'Donația sau statusul sunt invalide.' }, 400);
      const { data: donation, error: donationError } = await db.from('organization_stash_donations').select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
      if (donationError) throw donationError;
      if (!donation || donation.status !== 'pending') return reply({ error: 'Donația nu mai este în așteptare.' }, 400);
      let updated = donation;
      let itemWebhook = null;
      if (body.status === 'approved') {
        const { data: item, error: itemError } = await db.from('organization_stash_items').insert({ organization_id: organizationId, title: donation.title, category: donation.category, quantity: donation.quantity, unit: donation.unit, description: donation.note, status: 'available', source_type: 'donation', created_by_discord_id: donation.donated_by_discord_id, created_by_name: donation.donated_by_name, updated_by_discord_id: session.discord_id }).select('*').single();
        if (itemError) throw itemError;
        const { data: changed, error } = await db.from('organization_stash_donations').update({ status: 'approved', reviewed_by_discord_id: session.discord_id, reviewed_by_name: name, reviewed_at: new Date().toISOString(), stash_item_id: item.id, updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', donation.id).select('*').single();
        if (error) throw error;
        updated = changed;
        itemWebhook = await syncAndStoreWebhook(db, 'organization_stash_items', item, organizationId, 'log_stash', await itemEmbedWithHistory(db, item, 'Donație aprobată și adăugată în Stash'));
      } else {
        const { data: changed, error } = await db.from('organization_stash_donations').update({ status: 'rejected', reviewed_by_discord_id: session.discord_id, reviewed_by_name: name, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', donation.id).select('*').single();
        if (error) throw error;
        updated = changed;
      }
      const webhook = await syncAndStoreWebhook(db, 'organization_stash_donations', updated, organizationId, 'log_stash_donations', donationEmbed(updated, body.status === 'approved' ? 'Donație aprobată' : 'Donație respinsă'));
      return reply({ ok: true, donation: updated, webhook, item_webhook: itemWebhook });
    }

    if (action === 'delete_donation') {
      if (!validId(body.id)) return reply({ error: 'Donația este invalidă.' }, 400);
      const { data: donation, error: donationError } = await db.from('organization_stash_donations').select('*').eq('organization_id', organizationId).eq('id', body.id).maybeSingle();
      if (donationError) throw donationError;
      if (!donation) return reply({ error: 'Donația nu mai există.' }, 404);
      if (!canDeleteOwn(donation, 'donated_by_discord_id', 'donate')) return reply({ error: 'Doar rolurile care pot înregistra donații, proprietarul organizației sau administratorul global pot șterge această donație.' }, 403);
      const { error } = await db.from('organization_stash_donations').delete().eq('organization_id', organizationId).eq('id', body.id);
      if (error) throw error;
      const webhook = await syncDiscordWebhook(db, organizationId, 'log_stash_donations', donationEmbed({ ...donation, status: 'deleted' }, 'Donație ștearsă din Stash'), donation.discord_message_ids || {}, false);
      return reply({ ok: true, deleted_id: body.id, webhook });
    }

    return reply({ error: 'Acțiunea Stash este necunoscută.' }, 400);
  } catch (error) {
    console.error(error);
    return reply({ error: error instanceof Error ? error.message : 'Eroare internă.' }, 500);
  }
});
