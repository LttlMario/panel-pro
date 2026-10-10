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
