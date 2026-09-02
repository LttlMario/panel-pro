import { createClient } from 'jsr:@supabase/supabase-js@2.112.3';
import { requirePanelSession } from '../_shared/panel-session.ts';
import { getPlatformSecret } from '../_shared/platform-secrets.ts';
import { deliverDiscordRoute, routeCandidates } from '../_shared/discord-delivery.ts';

const headers = {
  'Access-Control-Allow-Origin': 'https://panel-pro.ro',
  'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-panel-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default;
const clean = (value: unknown, max = 500) => String(value || '').trim().slice(0, max);
const validDiscordId = (value: unknown) => /^\d{15,22}$/.test(clean(value, 30));
const normalizeCnp = (value: unknown) => clean(value, 120);

function validateCnp(value: unknown) {
  const cnp = normalizeCnp(value);
  if (!cnp) throw new Error('CNP-ul sau identificatorul angajatului este obligatoriu.');
  return cnp;
}

function contractExportChunks(lines: string[], maxLength = 1800) {
  const result: string[] = [];
  let current = '';
  for (const line of lines) {
    if (current && current.length + line.length + 1 > maxLength) { result.push(current); current = ''; }
    current += `${current ? '\n' : ''}${line}`;
  }
  if (current) result.push(current);
  return result;
}

async function discordMemberState(guildId: string, discordId: string, botToken: string): Promise<boolean | null> {
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (response.ok) return true;
    if (response.status === 404) return false;
  } catch (_) {}
  return null;
}

async function syncEmployees(db: any, organizationId: string, botToken = '') {
  const [{ data: employees, error: employeesError }, { data: members, error: membersError }] = await Promise.all([
    db.from('organization_employees').select('id,discord_id,status,archived_at').eq('organization_id', organizationId).is('archived_at', null),
    db.from('organization_members').select('discord_id,active').eq('organization_id', organizationId),
  ]);
  if (employeesError) throw employeesError;
  if (membersError) throw membersError;

  const { data: guilds } = botToken
    ? await db.from('organization_guilds').select('guild_id').eq('organization_id', organizationId).eq('enabled', true)
    : { data: [] };
  const guildIds = [...new Set((guilds || []).map((guild: any) => clean(guild.guild_id, 40)).filter(Boolean))];
  if (botToken && guildIds.length) {
    const now = new Date().toISOString();
    for (const employee of employees || []) {
      const discordId = clean(employee.discord_id, 30);
      if (!discordId) continue;
      let found = false;
      let known = false;
      for (const guildId of guildIds) {
        const state = await discordMemberState(guildId, discordId, botToken);
        if (state === true) { found = true; known = true; break; }
        if (state === false) known = true;
      }
      if (!known) continue;
      const patch: Record<string, unknown> = found
        ? { status: 'active', left_at: null, last_discord_seen_at: now, updated_at: now }
        : { status: 'inactive', left_at: employee.status === 'active' ? now : undefined, updated_at: now };
      if (patch.left_at === undefined) delete patch.left_at;
      const { error } = await db.from('organization_employees').update(patch).eq('id', employee.id).eq('organization_id', organizationId);
      if (error) throw error;
      const { error: memberError } = await db.from('organization_members').update({ active: found, last_verified_at: now }).eq('organization_id', organizationId).eq('discord_id', discordId);
      if (memberError) throw memberError;
    }
    return;
  }

  const activeMemberIds = new Set((members || []).filter((row: any) => row.active === true).map((row: any) => String(row.discord_id)));
  const now = new Date().toISOString();
  for (const employee of employees || []) {
    const discordId = clean(employee.discord_id, 30);
    if (!discordId) continue;
    const isActive = activeMemberIds.has(discordId);
    const patch: Record<string, unknown> = { last_discord_seen_at: isActive ? now : employee.last_discord_seen_at, updated_at: now };
    if (isActive && employee.status !== 'active') {
      patch.status = 'active';
      patch.left_at = null;
    } else if (!isActive && employee.status === 'active') {
      patch.status = 'inactive';
      patch.left_at = now;
    }
    if (Object.keys(patch).length > 2) {
      const { error } = await db.from('organization_employees').update(patch).eq('id', employee.id).eq('organization_id', organizationId);
      if (error) throw error;
    }
  }
}

async function listContracts(db: any, organizationId: string) {
  await syncEmployees(db, organizationId, await getPlatformSecret(db, 'discord_bot_token'));
  const [{ data: employees, error: employeesError }, { data: contracts, error: contractsError }, { data: batches, error: batchesError }, { data: members, error: membersError }] = await Promise.all([
    db.from('organization_employees').select('id,discord_id,full_name,cnp,status,joined_at,left_at,last_discord_seen_at,created_at,updated_at').eq('organization_id', organizationId).is('archived_at', null).order('status').order('full_name'),
    db.from('organization_contracts').select('id,employee_id,contract_number,phone,position,salary,schedule,start_date,created_at,created_by_discord_id').eq('organization_id', organizationId).order('created_at', { ascending: false }),
    db.from('contract_export_batches').select('id,created_at,row_count,completed_at').eq('organization_id', organizationId).eq('export_type', 'manual').eq('status', 'completed').order('created_at', { ascending: false }).limit(100),
    db.from('organization_members').select('discord_id,active,panel_role').eq('organization_id', organizationId).eq('active', true).order('discord_id'),
  ]);
  if (employeesError) throw employeesError;
  if (contractsError) throw contractsError;
  if (batchesError) throw batchesError;
  if (membersError) throw membersError;

  const batchIds = (batches || []).map((batch: any) => batch.id);
  const { data: exportedItems, error: exportedItemsError } = batchIds.length
    ? await db.from('contract_export_items').select('employee_id,batch_id,created_at').in('batch_id', batchIds)
    : { data: [], error: null };
  if (exportedItemsError) throw exportedItemsError;
  const exportMap = new Map<string, { count: number; last: string }>();
  for (const item of exportedItems || []) {
    const previous = exportMap.get(String(item.employee_id)) || { count: 0, last: '' };
    previous.count += 1;
    if (!previous.last || String(item.created_at) > previous.last) previous.last = String(item.created_at);
    exportMap.set(String(item.employee_id), previous);
  }

  const memberIds = [...new Set((members || []).map((member: any) => String(member.discord_id)).filter(Boolean))];
  const { data: users, error: usersError } = memberIds.length
    ? await db.from('users').select('discord_id,display_name,username').in('discord_id', memberIds)
    : { data: [], error: null };
  if (usersError) throw usersError;
  const userMap = new Map((users || []).map((user: any) => [String(user.discord_id), user]));

  return {
    employees: (employees || []).map((employee: any) => ({
      ...employee,
      has_manual_export: (exportMap.get(String(employee.id))?.count || 0) > 0,
      last_manual_export_at: exportMap.get(String(employee.id))?.last || null,
    })),
    contracts: contracts || [],
    discord_members: (members || []).map((member: any) => {
      const user = userMap.get(String(member.discord_id));
      return { discord_id: String(member.discord_id), display_name: user?.display_name || user?.username || String(member.discord_id), panel_role: member.panel_role || '' };
    }),
    last_manual_export: batches?.[0] || null,
  };
}

async function deleteEmployee(db: any, session: any, body: any) {
  const employeeId = clean(body.employee_id, 80);
  if (!employeeId) throw new Error('Angajatul selectat nu este valid.');
  const { data: employee, error: employeeError } = await db.from('organization_employees').select('id').eq('id', employeeId).eq('organization_id', session.organization_id).is('archived_at', null).maybeSingle();
  if (employeeError) throw employeeError;
  if (!employee) throw new Error('Angajatul nu mai există în lista organizației.');
  const now = new Date().toISOString();
  const { error } = await db.from('organization_employees').update({ archived_at: now, status: 'inactive', discord_id: null, left_at: now, updated_at: now }).eq('id', employeeId).eq('organization_id', session.organization_id);
  if (error) throw error;
  return { employee_id: employeeId };
}

async function createContract(db: any, session: any, body: any) {
  const organizationId = session.organization_id;
  const fullName = clean(body.employee_name, 200);
  if (fullName.length < 2) throw new Error('Numele angajatului este obligatoriu.');
  const cnp = validateCnp(body.cnp);
  const contractNumber = clean(body.contract_number, 80);
  const contractText = clean(body.contract_text, 50000);
  if (!contractNumber) throw new Error('Numărul contractului este obligatoriu.');
  if (!contractText) throw new Error('Textul contractului este obligatoriu.');
  const discordId = validDiscordId(body.discord_id) ? clean(body.discord_id, 30) : null;
  const now = new Date().toISOString();

  const employeePatch: Record<string, unknown> = {
    organization_id: organizationId,
    full_name: fullName,
    cnp,
    status: 'active',
    left_at: null,
    archived_at: null,
    updated_at: now,
  };
  if (discordId) employeePatch.discord_id = discordId;
  const { data: employee, error: employeeError } = await db.from('organization_employees').upsert(employeePatch, { onConflict: 'organization_id,cnp' }).select('id,discord_id,full_name,cnp,status').single();
  if (employeeError) throw employeeError;

  const { data: contract, error: contractError } = await db.from('organization_contracts').insert({
    organization_id: organizationId,
    employee_id: employee.id,
    contract_number: contractNumber,
    contract_text: contractText,
    phone: clean(body.phone, 80) || null,
    position: clean(body.position, 120) || null,
    salary: clean(body.salary, 120) || null,
    schedule: clean(body.schedule, 120) || null,
    start_date: clean(body.start_date, 40) || null,
    created_by_discord_id: session.discord_id,
  }).select('id,employee_id,contract_number,created_at').single();
  if (contractError) {
    if (contractError.code === '23505') throw new Error('Numărul contractului există deja. Reîncarcă pagina și generează din nou.');
    throw contractError;
  }
  return { employee, contract };
}

async function manualExport(db: any, session: any, body: any) {
  const ids = [...new Set((Array.isArray(body.employee_ids) ? body.employee_ids : []).map(String).filter(Boolean))];
  if (!ids.length) throw new Error('Selectează cel puțin un angajat pentru export.');
  const { data: employees, error: employeesError } = await db.from('organization_employees').select('id,full_name,cnp,status').eq('organization_id', session.organization_id).is('archived_at', null).in('id', ids).order('full_name');
  if (employeesError) throw employeesError;
  if ((employees || []).length !== ids.length) throw new Error('Unul dintre angajații selectați nu aparține organizației active.');

  const now = new Date().toISOString();
  const { data: batch, error: batchError } = await db.from('contract_export_batches').insert({
    organization_id: session.organization_id,
    export_type: 'manual',
    status: 'processing',
    created_by_discord_id: session.discord_id,
  }).select('id,created_at').single();
  if (batchError) throw batchError;
  const items = (employees || []).map((employee: any) => ({ batch_id: batch.id, employee_id: employee.id, full_name: employee.full_name, cnp: employee.cnp }));
  const { error: itemError } = await db.from('contract_export_items').insert(items);
  if (itemError) {
    await db.from('contract_export_batches').update({ status: 'failed', error: itemError.message, completed_at: now }).eq('id', batch.id);
    throw itemError;
  }
  const text = (employees || []).map((employee: any) => `${employee.full_name}\t${employee.cnp}`).join('\n');
  const { error: finishError } = await db.from('contract_export_batches').update({ status: 'completed', row_count: employees?.length || 0, completed_at: now }).eq('id', batch.id);
  if (finishError) throw finishError;
  return { batch_id: batch.id, row_count: employees?.length || 0, text, employees };
}

async function manualDiscordExport(db: any, session: any, body: any) {
  const ids = [...new Set((Array.isArray(body.employee_ids) ? body.employee_ids : []).map(String).filter(Boolean))];
  if (!ids.length) throw new Error('Selectează cel puțin un angajat pentru trimiterea pe Discord.');

  const [{ data: employees, error: employeesError }, { data: settings, error: settingsError }, { data: organization, error: organizationError }] = await Promise.all([
    db.from('organization_employees').select('id,full_name,cnp,status').eq('organization_id', session.organization_id).is('archived_at', null).in('id', ids).order('full_name'),
    db.from('organization_settings').select('webhook_routes,discord_channel_routes').eq('organization_id', session.organization_id).maybeSingle(),
    db.from('organizations').select('name').eq('id', session.organization_id).maybeSingle(),
  ]);
  if (employeesError) throw employeesError;
  if (settingsError) throw settingsError;
  if (organizationError) throw organizationError;
  if ((employees || []).length !== ids.length) throw new Error('Unul dintre angajații selectați nu aparține organizației active.');

  if (!routeCandidates(settings, 'contract_identity_weekly').some((item) => item.candidates.length)) throw new Error('Canalul Discord al botului pentru exportul nume + CNP nu este configurat sau nu este activ.');

  const now = new Date();
  const { data: batch, error: batchError } = await db.from('contract_export_batches').insert({
    organization_id: session.organization_id,
    export_type: 'manual',
    status: 'processing',
    created_by_discord_id: session.discord_id,
  }).select('id').single();
  if (batchError) throw batchError;

  const exportItems = (employees || []).map((employee: any) => ({ batch_id: batch.id, employee_id: employee.id, full_name: employee.full_name, cnp: employee.cnp }));
  const { error: itemError } = await db.from('contract_export_items').insert(exportItems);
  if (itemError) {
    await db.from('contract_export_batches').update({ status: 'failed', error: itemError.message, completed_at: now.toISOString() }).eq('id', batch.id);
    throw itemError;
  }

  const chunks = contractExportChunks((employees || []).map((employee: any) => `${employee.full_name}\t${employee.cnp}`));
  const failures: string[] = [];
  let successfulPosts = 0;
  for (const content of chunks) {
    const delivery = await deliverDiscordRoute(db, settings, 'contract_identity_weekly', JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        title: '📋 Export manual angajați',
        description: `Organizație: **${organization?.name || ''}**\n\n\`\`\`text\n${content}\n\`\`\``,
        color: 3447003,
        timestamp: now.toISOString(),
      }],
    }));
    if (delivery.results.length) successfulPosts += delivery.results.length;
    failures.push(...(delivery.failures || []));
  }

  if (!successfulPosts) {
    const errorMessage = failures.join(' | ') || 'Discord nu a acceptat exportul.';
    await db.from('contract_export_batches').update({ status: 'failed', error: errorMessage, completed_at: new Date().toISOString() }).eq('id', batch.id);
    throw new Error(errorMessage);
  }

  await db.from('contract_export_batches').update({ status: 'completed', row_count: exportItems.length, completed_at: new Date().toISOString(), error: failures.length ? failures.join(' | ') : null }).eq('id', batch.id);
  return { batch_id: batch.id, row_count: exportItems.length, sent_messages: successfulPosts, partial: failures.length > 0 };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Metodă invalidă.' }, 405);
  try {
    const key = serviceKey();
    if (!key) throw new Error('Cheia secretă Supabase lipsește.');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, key);
    const session = await requirePanelSession(db, request, 1);
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 40) || 'list';
    if (action === 'create_contract') return reply({ ok: true, ...(await createContract(db, session, body)) });
    if (action === 'manual_export') return reply({ ok: true, ...(await manualExport(db, session, body)) });
    if (action === 'manual_discord_export') return reply({ ok: true, ...(await manualDiscordExport(db, session, body)) });
    if (action === 'delete_employee') return reply({ ok: true, ...(await deleteEmployee(db, session, body)) });
    if (action === 'list') return reply({ ok: true, ...(await listContracts(db, session.organization_id)) });
    return reply({ error: 'Acțiune necunoscută.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare internă.';
    return reply({ error: message }, /sesiunea|autentifică|organizația|nivelul/i.test(message) ? 403 : 400);
  }
});
