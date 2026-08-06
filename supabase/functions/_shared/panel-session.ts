export type PanelSession = { organization_id: string; discord_id: string; permission_level: number };

const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');

export async function requirePanelSession(db: any, request: Request, minimumLevel = 0, allowInactiveOrganization = false): Promise<PanelSession> {
  const token = String(request.headers.get('x-panel-session') || '').trim();
  if (!token) throw new Error('Sesiunea securizată a panelului lipsește. Autentifică-te din nou.');
  const { data, error } = await db.from('panel_sessions').select('organization_id,discord_id,permission_level,expires_at,revoked_at')
    .eq('token_hash', await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) throw new Error('Sesiunea panelului a expirat. Autentifică-te din nou.');
  const { data: organization } = await db.from('organizations').select('active').eq('id', data.organization_id).maybeSingle();
  if (!allowInactiveOrganization && !organization?.active) throw new Error('Organizația este dezactivată sau a expirat. Contactează administratorul platformei.');
  const { data: access } = await db.from('app_settings').select('value').eq('organization_id', data.organization_id).eq('key', 'organization_access').maybeSingle();
  const organizationExpiresAt = String(access?.value?.expires_at || '');
  if (!allowInactiveOrganization && organizationExpiresAt && Date.parse(organizationExpiresAt) <= Date.now()) {
    await db.from('organizations').update({ active: false, updated_at: new Date().toISOString() }).eq('id', data.organization_id);
    throw new Error('Perioada de activare a organizației a expirat. Contactează administratorul platformei pentru prelungire.');
  }
  if (Number(data.permission_level) < minimumLevel) throw new Error(`Este necesar nivelul ${minimumLevel}.`);
  return { organization_id: String(data.organization_id), discord_id: String(data.discord_id), permission_level: Number(data.permission_level) };
}
