# Instalare Supabase – Panel multi-organizație

Schema proiectului este livrată prin fișierele din `migrations/`. Repository-ul nu conține dump-uri cu date de producție.

Pentru o instalare nouă, creează un proiect Supabase gol, verifică istoricul migrațiilor și aplică-le cu `supabase db push --linked`.

## Funcții Edge

```powershell
supabase link --project-ref PROJECT_REF
./supabase/deploy-functions.ps1 -ProjectRef PROJECT_REF
```

Configurează secretele în Supabase Dashboard: `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `PLATFORM_OWNER_DISCORD_IDS` și, unde este folosit, `CRON_SECRET`. Nu salva aceste valori în GitHub sau în fișierele publice ale panelului.

Pentru modificări noi, creează o migrare numerotată în `supabase/migrations`, testeaz-o pe staging, apoi aplic-o pe producție.
