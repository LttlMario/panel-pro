// Configuratie publica pentru autentificarea Discord.
// O singura aplicatie OAuth autentifica utilizatorul. Serverele din care se
// citesc rolurile sunt configurate separat in Supabase: guild_id si
// guild_id_secondary din discord_panel_config.

window.PANEL_DISCORD_CONFIG = Object.freeze({
    organization: Object.freeze({
        id: "familia-es-todo"
    }),

    clientId: "1531023771211792384",

    scopes: Object.freeze([
        "identify",
        "guilds",
        "guilds.members.read"
    ])
});
