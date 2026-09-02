export type PanelSession = {
  organization_id: string;
  discord_id: string;
  permission_level: number;
  discord_role_ids: string[];
  is_platform_admin: boolean;
};

const recordSystemAccessEvent = async (db: any, organizationId: string, action: string, details: Record<string, unknown>) => {
  try {
    await Promise.all([
      db.from('admin_audit_log').insert({
        organization_id: organizationId,
        actor_discord_id: null,
        actor_name: 'system',
        action,
        target_type: 'organization',
        target_id: organizationId,
        details,
      }),
      db.from('organization_lifecycle_events').insert({
        organization_id: organizationId,
        event_type: action,
        actor_discord_id: null,
        details,
      }),
    ]);
  } catch (error) {
    console.error('Could not record system organization access event:', error);
  }
};

const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requirePanelSession(db: any, request: Request, minimumLevel = 0, allowInactiveOrganization = false): Promise<PanelSession> {
  const token = String(request.headers.get('x-panel-session') || '').trim();
  if (!token) throw new Error('Sesiunea securizată a panelului lipsește. Autentifică-te din nou.');
  const { data, error } = await db.from('panel_sessions').select('organization_id,discord_id,permission_level,discord_role_ids,is_platform_admin,expires_at,revoked_at')
    .eq('token_hash', await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) throw new Error('Sesiunea panelului a expirat. Autentifică-te din nou.');
  if (!UUID_RE.test(String(data.organization_id || ''))) throw new Error('Sesiunea panelului este veche sau invalidă. Autentifică-te din nou.');
  const { data: organization } = await db.from('organizations').select('active,deactivation_reason').eq('id', data.organization_id).maybeSingle();
  const { data: access } = await db.from('app_settings').select('value').eq('organization_id', data.organization_id).eq('key', 'organization_access').maybeSingle();
  const organizationExpiresAt = String(access?.value?.expires_at || '');
  if (!allowInactiveOrganization && organizationExpiresAt && Date.parse(organizationExpiresAt) <= Date.now()) {
    const now = new Date().toISOString();
    const { data: changedOrganization, error: updateError } = await db.from('organizations')
      .update({
        active: false,
        deactivation_reason: 'expired',
        deactivated_at: now,
        deactivated_by_discord_id: null,
        updated_at: now,
      })
      .eq('id', data.organization_id)
      .eq('active', true)
      .select('id')
      .maybeSingle();
    if (updateError) throw updateError;
    if (changedOrganization) {
      await recordSystemAccessEvent(db, data.organization_id, 'organization_access_expired', {
        expires_at: organizationExpiresAt,
        source: 'require_panel_session',
      });
    }
    throw new Error('Perioada de activare a organizației a expirat. Contactează administratorul platformei pentru prelungire.');
  }
  if (!allowInactiveOrganization && !organization?.active && organization?.deactivation_reason === 'expired' && organizationExpiresAt && Date.parse(organizationExpiresAt) > Date.now()) {
    const now = new Date().toISOString();
    const { data: repairedOrganization, error: repairError } = await db.from('organizations')
      .update({ active: true, deactivation_reason: null, deactivated_at: null, deactivated_by_discord_id: null, updated_at: now })
      .eq('id', data.organization_id)
      .eq('active', false)
      .eq('deactivation_reason', 'expired')
      .select('id')
      .maybeSingle();
    if (repairError) throw repairError;
    if (repairedOrganization) {
      organization.active = true;
      organization.deactivation_reason = null;
      await recordSystemAccessEvent(db, data.organization_id, 'organization_access_reconciled', {
        expires_at: organizationExpiresAt,
        source: 'require_panel_session',
      });
    }
  }
  if (!allowInactiveOrganization && !organization?.active) throw new Error('Organizația este dezactivată. Contactează administratorul platformei.');
  if (Number(data.permission_level) < minimumLevel) throw new Error(`Este necesar nivelul ${minimumLevel}.`);
  return {
    organization_id: String(data.organization_id),
    discord_id: String(data.discord_id),
    permission_level: Number(data.permission_level),
    discord_role_ids: Array.isArray(data.discord_role_ids) ? data.discord_role_ids.map(String) : [],
    is_platform_admin: data.is_platform_admin === true
  };
}
