# Configurare și mutare Discord

Acesta este punctul unic de verificare când panelul este mutat pe alt server Discord.

## 1. Aplicația Discord și autentificarea

- Modifică `clientId` în `js/discord-config.js` numai dacă folosești altă aplicație Discord.
- În Discord Developer Portal adaugă adresa exactă a paginii `login.html` la OAuth2 Redirects.
- Scope-urile necesare sunt deja centralizate în același fișier: `identify`, `email` și `guilds.members.read`.

## 2. Serverul și secretele Supabase

În Supabase Dashboard, la Edge Functions > Secrets, configurează toate denumirile din `supabase/functions/.env.example`.

- `DISCORD_GUILD_ID` — ID-ul noului server.
- `DISCORD_FAMILY_ROLE_ID` — rolul menționat pentru Familie.
- `DISCORD_MECHANICS_ROLE_ID` — rolul menționat pentru Mecanici.
- Webhook-urile pentru Familie, Mecanici și Pontaj.
- `PANEL_PUBLIC_URL` — adresa publică a panelului, fără `/` la final.

Nu salva URL-urile webhook în acest ghid și nu le publica pe GitHub.

## 3. Maparea celor șapte roluri

În Supabase Table Editor deschide `discord_role_mappings` și înlocuiește `discord_role_id` cu ID-urile rolurilor de pe serverul nou. Păstrează nivelurile:

1. El Mecanico
2. Șef Mecanic
3. Familia
4. Manager
5. Co Lider
6. Lider
7. Coordonator

## 4. Configuratorul din panel

După instalarea migrării și deploy-ul funcțiilor, intră în Panou Admin și deschide „Configurare server Discord”. Formularul actualizează serverul, rolurile, adresa publică și webhook-urile. Paginile trimit notificările prin Edge Function și nu mai conțin URL-uri webhook publice.

## 5. Funcții care trebuie redeployate

- `sync-discord-role`
- `manage-community-posts`
- `close-expired-shifts`, dacă ai schimbat webhook-ul pentru pontaj
- `manage-discord-config`
- `send-discord-notification`

## 6. Test final

1. Autentifică un membru cu rol mic și verifică numele și nivelul.
2. Autentifică un Coordonator și verifică accesul de nivel 7.
3. Publică un anunț de test pentru Familie și unul pentru Mecanici.
4. Pornește și oprește un pontaj de test.
5. Verifică mențiunile și linkurile din mesajele Discord.
