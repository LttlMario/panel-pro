# Instalare Supabase – Panel multi-organizație

## Schema master

`MASTER-MULTI-ORGANIZATIE.sql` este dump-ul generat din proiectul Supabase activ `web-complex`. Conține schema publică actuală: tabele, coloane, indexuri, constrângeri, politici RLS, trigger-e și funcții PostgreSQL disponibile în schema publică.

Pentru o instalare nouă, creează un proiect Supabase gol și execută fișierul în SQL Editor sau prin PostgreSQL client. Fișierul poate conține obiecte Supabase gestionate automat; verifică erorile de obiecte deja existente înainte de rerulare.

## Funcții Edge

După instalarea schemei, leagă proiectul și publică funcțiile din `supabase/functions`:

```powershell
supabase link --project-ref PROJECT_REF
supabase functions deploy sync-discord-role
supabase functions deploy manage-organizations
supabase functions deploy manage-admin-center
supabase functions deploy manage-discord-config
supabase functions deploy manage-community-posts
supabase functions deploy send-discord-notification
supabase functions deploy close-expired-shifts
supabase functions deploy create-voucher-organization
supabase functions deploy get-organization-status
supabase functions deploy finalize-organization
supabase functions deploy manage-draft-organization
supabase functions deploy discover-draft-roles
supabase functions deploy save-draft-roles
```

Configurează secretele în Supabase: `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `PLATFORM_OWNER_DISCORD_IDS` și, unde este folosit, `CRON_SECRET`. Nu salva aceste valori în GitHub sau în fișierele publice ale panelului.

## Migrare viitoare

Nu modifica dump-ul master pentru schimbări incrementale. Pentru o modificare nouă, creează o migrare numerotată în `supabase/migrations`, testeaz-o pe o bază de staging, apoi aplic-o pe producție. După fiecare schimbare majoră, regenerează dump-ul master din baza activă.
