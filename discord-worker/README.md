# Panel Pro · worker countdown roată

Workerul editează mesajul privat Discord la fiecare secundă, astfel încât să afișeze `HHh MMm SSs`, la fel ca timerul din panel.

Variabile necesare:

```text
SUPABASE_URL=https://vkvsabbbawyiurnaiugo.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
DISCORD_BOT_TOKEN=...
WHEEL_TIMER_INTERVAL_MS=1000
```

Pornire locală:

```text
node discord-worker/wheel-timer-worker.mjs
```

Pentru producție, folderul poate fi rulat ca serviciu Docker pe Railway, Render, VPS sau alt host care ține procesul pornit permanent.

## Regulament la intrarea pe server

`member-rules-worker.mjs` ascultă evenimentul `GUILD_MEMBER_ADD` și trimite membrului un DM cu link direct către canalul `rules` configurat în Panel Pro. Pentru acesta este necesar ca botul să aibă activat **Server Members Intent** în Discord Developer Portal și ca procesul worker să ruleze permanent.

Variabilele sunt aceleași: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` și `DISCORD_BOT_TOKEN`. Pornire:

```text
node discord-worker/member-rules-worker.mjs
```
