(() => {
  const start = () => {
    const form = document.getElementById('discord-setup-form');
    const host = document.getElementById('roles');
    const config = window.PANEL_SUPABASE_CONFIG;
    if (!form || !host || !config) return;

    const freshForm = form.cloneNode(true);
    form.replaceWith(freshForm);
    const currentForm = document.getElementById('discord-setup-form');
    const rowsHost = document.getElementById('roles');
    let rows = [];
    let primaryRoles = [];
    let secondaryRoles = [];

    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
    const call = async (body) => {
      const session = await window.ensurePanelSession();
      const response = await fetch(`${config.url}/functions/v1/manage-discord-config`, {
        method:'POST',
        headers:{'Content-Type':'application/json', apikey:config.publishableKey, Authorization:`Bearer ${config.publishableKey}`, 'x-panel-session':session},
        body:JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Operațiunea a eșuat.');
      return result;
    };
    const selected = (roleList, value) => `<option value="">Alege rolul Discord</option>${roleList.map((role) => `<option value="${esc(role.id)}">${esc(role.name)}</option>`).join('')}`;

    const render = () => {
      rowsHost.innerHTML = rows.map((row, index) => `
        <div class="role-row dynamic-role-row" data-index="${index}">
          <label>Nivel numeric<input class="dynamic-level" type="number" min="1" max="99" value="${Number(row.permission_level) || 1}"></label>
          <label>Nume în panel<input class="dynamic-panel-role" value="${esc(row.panel_role || '')}" placeholder="Ex: Coordonator"></label>
          <label>Rol Discord principal<select class="dynamic-primary-role">${selected(primaryRoles, row.discord_role_id)}</select></label>
          <label>Rol Discord secundar<select class="dynamic-secondary-role">${selected(secondaryRoles, row.discord_role_id_secondary)}</select></label>
          <button type="button" class="remove-dynamic-role" ${rows.length === 1 ? 'disabled' : ''}>−</button>
        </div>`).join('');
      rowsHost.querySelectorAll('.dynamic-role-row').forEach((element, index) => {
        element.querySelector('.dynamic-level').oninput = (event) => { rows[index].permission_level = Math.max(1, Math.min(99, Number(event.target.value) || 1)); };
        element.querySelector('.dynamic-panel-role').oninput = (event) => { rows[index].panel_role = event.target.value; };
        element.querySelector('.dynamic-primary-role').onchange = (event) => { const role = primaryRoles.find((item) => item.id === event.target.value); rows[index].discord_role_id = role?.id || ''; rows[index].discord_role_name = role?.name || ''; };
        element.querySelector('.dynamic-secondary-role').onchange = (event) => { const role = secondaryRoles.find((item) => item.id === event.target.value); rows[index].discord_role_id_secondary = role?.id || ''; rows[index].discord_role_name_secondary = role?.name || ''; };
        element.querySelector('.remove-dynamic-role').onclick = () => { if (rows.length === 1) return; rows.splice(index, 1); render(); };
      });
    };

    const addButton = document.createElement('button');
    addButton.type = 'button'; addButton.className = 'config-action'; addButton.textContent = '+ Adaugă grad';
    addButton.onclick = () => { rows.push({ permission_level: Math.max(0, ...rows.map((row) => Number(row.permission_level) || 0)) + 1, panel_role:'Grad nou', discord_role_id:'', discord_role_name:'', discord_role_id_secondary:'', discord_role_name_secondary:'' }); render(); };
    rowsHost.before(addButton);

    const discover = async (kind) => {
      const id = document.getElementById(kind === 'primary' ? 'guild_id_primary' : 'guild_id_secondary')?.value.trim();
      const status = document.getElementById(kind === 'primary' ? 'primary-discord-status' : 'secondary-discord-status');
      if (!/^\d{15,22}$/.test(id || '')) { if (status) status.textContent = 'Completează un Guild ID valid.'; return; }
      if (status) status.textContent = 'Se citesc rolurile Discord...';
      try {
        const result = await call({ action:'discover_discord_roles', kind, guild_id:id });
        if (kind === 'primary') primaryRoles = result.roles || []; else secondaryRoles = result.roles || [];
        if (status) status.textContent = `${result.guild?.name || id}: ${(result.roles || []).length} roluri disponibile.`;
        render();
      } catch (error) { if (status) status.textContent = error.message; }
    };
    ['primary','secondary'].forEach((kind) => {
      const id = kind === 'primary' ? 'guild_id_primary' : 'guild_id_secondary';
      const existingButton = kind === 'secondary' ? document.getElementById('discover-secondary-discord') : null;
      const button = existingButton || document.createElement('button');
      button.type='button'; button.className='config-action'; button.textContent=`Citește rolurile ${kind === 'primary' ? 'principalului server' : 'serverului secundar'}`;
      if (!existingButton) document.getElementById(id)?.closest('.field')?.appendChild(button);
      button.onclick = () => discover(kind);
      let status = document.getElementById(`${kind}-discord-status`);
      if (!status) { status = document.createElement('p'); status.id = `${kind}-discord-status`; status.className = 'text-xs text-slate-400'; document.getElementById(id)?.closest('.field')?.appendChild(status); }
    });

    currentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('setup-status');
      try {
        if (!rows.length || rows.some((row) => !row.discord_role_id || !row.panel_role || Number(row.permission_level) < 1 || Number(row.permission_level) > 99)) throw new Error('Completează fiecare grad cu nivel, nume și rol Discord principal.');
        status.textContent = 'Se salvează gradele...';
        await call({ action:'save', config:{
          discord_client_id:document.getElementById('discord_client_id_primary').value.trim(),
          guild_id:document.getElementById('guild_id_primary').value.trim(),
          guild_id_secondary:document.getElementById('guild_id_secondary').value.trim(),
          discord_client_id_secondary:document.getElementById('guild_id_secondary').value.trim() ? document.getElementById('discord_client_id_primary').value.trim() : '',
          panel_public_url:document.getElementById('panel_public_url').value.trim(),
          organization_name:document.getElementById('organization_name').value.trim()
        }, mappings:rows });
        status.textContent = 'Gradele au fost salvate și aplicate.';
      } catch (error) { status.textContent = `Eroare: ${error.message}`; }
    });

    const load = async () => {
      try {
        const result = await call({ action:'get' });
        const mappings = result.mappings || [];
        rows = mappings.map((mapping) => ({ permission_level:Number(mapping.permission_level), panel_role:mapping.panel_role || mapping.discord_role_name || `Grad ${mapping.permission_level}`, discord_role_id:mapping.discord_role_id || '', discord_role_name:mapping.discord_role_name || '', discord_role_id_secondary:mapping.discord_role_id_secondary || '', discord_role_name_secondary:mapping.discord_role_name_secondary || '' }));
        if (!rows.length) rows = [{ permission_level:1, panel_role:'Membru', discord_role_id:'', discord_role_name:'', discord_role_id_secondary:'', discord_role_name_secondary:'' }];
        render();
      } catch (error) { document.getElementById('setup-status').textContent = error.message; }
    };
    rows = [{ permission_level:1, panel_role:'Membru', discord_role_id:'', discord_role_name:'', discord_role_id_secondary:'', discord_role_name_secondary:'' }];
    render();
    load();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
})();
