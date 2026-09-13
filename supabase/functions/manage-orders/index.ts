import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';

const headers = { 'Access-Control-Allow-Origin': 'https://panel-pro.ro', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session', 'Content-Type': 'application/json' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const text = (value: unknown, max = 4000) => String(value ?? '').trim().slice(0, max);
const validUuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const orderTypes = ['Gloante', 'Arme', 'Model', 'Seminte', 'Armuri', 'Echipament', 'Medicamente', 'Altele'];

const actorName = async (db: any, discordId: string) => {
  const { data } = await db.from('users').select('display_name,username').eq('discord_id', discordId).maybeSingle();
  return text(data?.display_name || data?.username || discordId, 120);
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
    const db = createClient(Deno.env.get('SUPABASE_URL')!, service);
    const session = await requirePanelSession(db, request);
    const organizationId = String(session.organization_id || '');
    const body = await request.json().catch(() => ({}));
    const action = text(body.action, 40) || 'load';
    const [{ data: settings, error: settingsError }, { data: member, error: memberError }, { data: guilds, error: guildsError }, { data: mappings, error: mappingsError }] = await Promise.all([
      db.from('app_settings').select('key,value').eq('organization_id', organizationId).in('key', ['page_permissions', 'action_permissions', 'organization_package']),
      db.from('organization_members').select('panel_role').eq('organization_id', organizationId).eq('discord_id', session.discord_id).eq('active', true).maybeSingle(),
      db.from('organization_guilds').select('guild_id,kind,enabled').eq('organization_id', organizationId),
      db.from('organization_role_mappings').select('discord_role_id,guild_id,panel_role').eq('organization_id', organizationId).eq('enabled', true),
    ]);
    if (settingsError || memberError || guildsError || mappingsError) throw settingsError || memberError || guildsError || mappingsError;
    const values = Object.fromEntries((settings || []).map((row: any) => [row.key, row.value || {}]));
    if (!session.is_platform_admin && String(values.organization_package?.code || '').toLowerCase() !== 'full') return reply({ error: 'Comenzile sunt disponibile doar pentru organizațiile cu pachetul Full.' }, 403);
    const roleIds = new Set((session.discord_role_ids || []).map(String));
    if (member?.panel_role) {
      for (const row of (mappings || []).filter((item: any) => String(item.panel_role || '') === String(member.panel_role))) roleIds.add(String(row.discord_role_id));
    }
    const primaryGuild = (guilds || []).find((guild: any) => guild.kind === 'primary' && guild.enabled !== false) || (guilds || []).find((guild: any) => guild.enabled !== false);
    const secondaryGuild = (guilds || []).find((guild: any) => guild.kind === 'secondary' && guild.enabled !== false && String(guild.guild_id) !== String(primaryGuild?.guild_id || ''));
    const organizationGuildId = String(secondaryGuild?.guild_id || primaryGuild?.guild_id || '');
    const organizationRoleIds = new Set((mappings || []).filter((mapping: any) => String(mapping.guild_id || '') === organizationGuildId).map((mapping: any) => String(mapping.discord_role_id)));
    const owner = session.is_platform_admin || Number(session.permission_level || 0) >= 7;
    const canRead = session.is_platform_admin || owner || (Array.isArray(values.page_permissions?.['comenzi.html']) && values.page_permissions['comenzi.html'].some((id: any) => roleIds.has(String(id))));
    const hasOrganization = (permission: string) => session.is_platform_admin || (Array.isArray(values.action_permissions?.[`orders.${permission}`]) && values.action_permissions[`orders.${permission}`].some((id: any) => organizationRoleIds.has(String(id)) && roleIds.has(String(id))));
    const canWrite = session.is_platform_admin || (values.action_permissions?.['orders.write_all'] === true && [...roleIds].some((id) => organizationRoleIds.has(String(id)))) || hasOrganization('write');
    const canApprove = hasOrganization('approve');
    if (!canRead && !canWrite && !canApprove) return reply({ error: 'Nu ai acces la pagina Comenzi.' }, 403);
    const name = await actorName(db, session.discord_id);
    if (action === 'load') {
      const { data, error } = await db.from('organization_orders').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return reply({ ok: true, orders: data || [], order_types: orderTypes, actor_name: name, access: { read: canRead || canWrite || canApprove, write: canWrite, approve: canApprove } });
    }
    if (action === 'create') {
      if (!canWrite) return reply({ error: 'Nu ai permisiunea de a scrie comenzi.' }, 403);
      const orderType = text(body.order_type, 80);
      const itemName = text(body.item_name, 160);
      const quantity = Number(body.quantity);
      if (!orderTypes.includes(orderType)) return reply({ error: 'Tipul comenzii nu este valid.' }, 400);
      if (itemName.length < 2) return reply({ error: 'Completează articolul sau modelul dorit.' }, 400);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return reply({ error: 'Cantitatea nu este validă.' }, 400);
      const { data, error } = await db.from('organization_orders').insert({ organization_id: organizationId, order_type: orderType, item_name: itemName, quantity, notes: text(body.notes), requested_by_discord_id: session.discord_id, requested_by_name: name }).select('*').single();
      if (error) throw error;
      return reply({ ok: true, order: data });
    }
    if (action === 'review') {
      if (!canApprove) return reply({ error: 'Nu ai permisiunea de a accepta sau respinge comenzi.' }, 403);
      const id = text(body.id, 50);
      const status = body.status === 'approved' ? 'approved' : body.status === 'rejected' ? 'rejected' : '';
      if (!validUuid(id) || !status) return reply({ error: 'Comanda sau statusul sunt invalide.' }, 400);
      const { data, error } = await db.from('organization_orders').update({ status, reviewed_by_discord_id: session.discord_id, reviewed_by_name: name, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('organization_id', organizationId).eq('id', id).eq('status', 'pending').select('*').maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: 'Comanda nu mai este în așteptare.' }, 409);
      return reply({ ok: true, order: data });
    }
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : 'Operația nu a putut fi finalizată.' }, 400); }
});
