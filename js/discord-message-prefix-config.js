(() => {
  const root = document.getElementById('webhooks') || document.getElementById('owner-webhooks');
  if (!root || document.getElementById('discord-message-prefix')) return;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const validId = (value) => /^\d{15,22}$/.test(String(value || '').trim());
  const normalize = (value) => {
    const rows = Array.isArray(value) ? value : [];
    return [...new Map(rows.map((item) => {
      const guildId = String(item?.guild_id || '').trim();
      const channelId = String(item?.channel_id || '').trim();
      if (!validId(guildId) || !validId(channelId)) return null;
      return [channelId, {
        guild_id: guildId,
        channel_id: channelId,
        channel_name: String(item?.channel_name || channelId).trim().slice(0, 120),
        guild_name: String(item?.guild_name || guildId).trim().slice(0, 120),
        enabled: item?.enabled !== false,
      }];
    }).filter(Boolean))].map(([, item]) => item);
  };

  let selected = normalize(window.discordMessagePrefixChannelsInitial || []);
  const selectedIds = () => new Set(selected.filter((item) => item.enabled !== false).map((item) => item.channel_id));
  const discoveredChannels = () => (typeof window.getDiscordDiscoveredChannels === 'function'
    ? window.getDiscordDiscoveredChannels()
    : []);
  const selectedFallbacks = () => selected.filter((item) => !discoveredChannels().some((channel) => String(channel.id) === item.channel_id));
  const allChannels = () => {
    const seen = new Set();
    return [...discoveredChannels(), ...selectedFallbacks()].filter((channel) => {
      const id = String(channel?.id || channel?.channel_id || '').trim();
      if (!validId(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map((channel) => ({
      ...channel,
      id: String(channel.id || channel.channel_id).trim(),
      guild_id: String(channel.guild_id || '').trim(),
      guild_name: String(channel.guild_name || channel.guild_id || '').trim(),
      name: String(channel.name || channel.channel_name || channel.id).trim(),
    }));
  };

  const section = document.createElement('section');
  section.id = 'discord-message-prefix';
  section.className = 'mt-4 rounded-xl border border-violet-700/60 bg-violet-950/20 p-4';
  section.innerHTML = '<div class="flex flex-wrap items-center justify-between gap-3"><div><h2 class="font-bold">Prefixare automată mesaje Discord</h2><p class="mt-1 text-xs text-slate-400">Selectează unul sau mai multe canale, din Discordul principal și/sau secundar. Botul păstrează mesajul original și trimite imediat o copie în formatul „Nume: mesaj”.</p></div><span class="rounded-lg border border-violet-700/60 px-3 py-2 text-xs font-bold text-violet-200" id="discord-message-prefix-count">0 canale selectate</span></div><p id="discord-message-prefix-status" class="mt-2 text-xs text-slate-400">Apasă „Încarcă canalele Discord” mai sus pentru a vedea canalele disponibile.</p><div id="discord-message-prefix-list" class="mt-3 grid gap-2 md:grid-cols-2"></div>';
  root.closest('details')?.before(section);
  const list = section.querySelector('#discord-message-prefix-list');
  const status = section.querySelector('#discord-message-prefix-status');
  const count = section.querySelector('#discord-message-prefix-count');

  const render = () => {
    const channels = allChannels();
    const ids = selectedIds();
    list.innerHTML = channels.length
      ? channels.map((channel) => `<label class="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs"><input type="checkbox" class="mt-0.5" data-prefix-channel="${escapeHtml(channel.id)}" ${ids.has(channel.id) ? 'checked' : ''}><span><b class="text-slate-200">#${escapeHtml(channel.name)}</b><small class="mt-1 block text-slate-400">${escapeHtml(channel.guild_name || channel.guild_id)}</small></span></label>`).join('')
      : '<div class="rounded-lg border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-400">Nu există canale încărcate. Folosește butonul „Încarcă canalele Discord” de mai sus.</div>';
    const selectedCount = ids.size;
    count.textContent = `${selectedCount} canal${selectedCount === 1 ? '' : 'e'} selectat${selectedCount === 1 ? '' : 'e'}`;
    status.textContent = channels.length
      ? 'Bifează canalele în care botul va adăuga automat numele autorului înaintea mesajului.'
      : 'Apasă „Încarcă canalele Discord” mai sus pentru a vedea canalele disponibile.';
    list.querySelectorAll('[data-prefix-channel]').forEach((checkbox) => {
      checkbox.onchange = () => {
        const channel = channels.find((item) => item.id === checkbox.dataset.prefixChannel);
        if (!channel) return;
        if (checkbox.checked) {
          selected = normalize([...selected.filter((item) => item.channel_id !== channel.id), {
            guild_id: channel.guild_id,
            channel_id: channel.id,
            channel_name: channel.name,
            guild_name: channel.guild_name,
            enabled: true,
          }]);
        } else {
          selected = selected.filter((item) => item.channel_id !== channel.id);
        }
        render();
      };
    });
  };

  window.getDiscordMessagePrefixChannels = () => normalize(selected);
  window.setDiscordMessagePrefixChannels = (value) => { selected = normalize(value); render(); };
  window.addEventListener('panel:discord-channels-updated', render);
  render();
})();
