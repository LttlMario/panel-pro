const token = String(process.env.DISCORD_BOT_TOKEN || '').trim();
const applicationId = String(process.env.DISCORD_APPLICATION_ID || '').trim();
const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();

if (!token || !/^\d{15,22}$/.test(applicationId)) {
  console.error('Setează DISCORD_BOT_TOKEN și DISCORD_APPLICATION_ID înainte de rulare.');
  process.exit(1);
}

const commands = [{
  name: 'panel',
  description: 'Afișează meniul și informațiile Panel Pro',
  options: [
    { type: 1, name: 'status', description: 'Verifică toate canalele configurate', options: [] },
    {
      type: 1,
      name: 'publica',
      description: 'Publică un embed cu butoane în canalul configurat',
      options: [{
        type: 3,
        name: 'modul',
        description: 'Embedul pe care vrei să îl publici',
        required: true,
        choices: [
          ['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'],
          ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Contracte', 'contracts'], ['Status live', 'status_live'],
          ['Stash', 'stash'],
        ].map(([name, value]) => ({ name, value })),
      }],
    },
    {
      type: 1,
      name: 'config',
      description: 'Configurează canalul unui modul Panel Pro',
      options: [
        {
          type: 3,
          name: 'modul',
          description: 'Modulul pentru care salvezi canalul',
          required: true,
          choices: [
            ['Anunțuri organizație', 'organization'], ['Anunțuri angajați', 'departments'], ['Pontaj', 'pontaj'], ['Log pontaj', 'log_pontaj'],
            ['Învoiri organizație', 'requests_organization'], ['Învoiri angajați', 'requests_departments'], ['Log învoiri organizație', 'log_requests_organization'], ['Log învoiri angajați', 'log_requests_departments'],
            ['Contracte', 'contracts'], ['Log contracte', 'log_contracts'], ['Log acțiuni organizație', 'log_actions_organization'], ['Log acțiuni săptămânal', 'actions_organization_weekly'], ['Status live', 'status_live'],
            ['Stash', 'stash'], ['Log Stash', 'log_stash'], ['Cereri Stash', 'stash_requests'], ['Log cereri Stash', 'log_stash_requests'], ['Donații Stash', 'stash_donations'], ['Log donații Stash', 'log_stash_donations'],
          ].map(([name, value]) => ({ name, value })),
        },
        { type: 7, name: 'canal', description: 'Canalul pentru embedul cu butoane', required: true, channel_types: [0] },
        { type: 7, name: 'canal_log', description: 'Canalul pentru rezultatele și logurile modulului', required: false, channel_types: [0] },
      ],
    },
  ],
}];

const scope = guildId && /^\d{15,22}$/.test(guildId)
  ? `guilds/${guildId}`
  : 'commands';
const endpoint = `https://discord.com/api/v10/applications/${applicationId}/${scope}`;
const response = await fetch(endpoint, {
  method: 'PUT',
  headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(commands),
});

if (!response.ok) {
  console.error(`Discord a respins înregistrarea comenzilor (HTTP ${response.status}).`);
  console.error(await response.text());
  process.exit(1);
}

console.log(guildId
  ? `Comanda /panel a fost înregistrată pe serverul ${guildId}.`
  : 'Comanda /panel a fost înregistrată global. Propagarea poate dura până la o oră.');
