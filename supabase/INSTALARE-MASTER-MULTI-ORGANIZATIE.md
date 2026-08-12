# Instalare Supabase – Panel multi-organizație

## Schema master

`MASTER-MULTI-ORGANIZATIE.sql` este dump-ul generat din proiectul Supabase activ `web-complex`. Conține schema publică actuală: tabele, coloane, indexuri, constrângeri, politici RLS, trigger-e și funcții PostgreSQL disponibile în schema publică.

Pentru o instalare nouă, creează un proiect Supabase gol și execută fișierul în SQL Editor sau prin PostgreSQL client. Fișierul poate conține obiecte Supabase gestionate automat; verifică erorile de obiecte deja existente înainte de rerulare.

## Funcții Edge

După instalarea schemei, leagă proiectul și publică toate funcțiile active cu scriptul unic al proiectului:

```powershell
supabase link --project-ref PROJECT_REF
./supabase/deploy-functions.ps1 -ProjectRef PROJECT_REF
```

Configurează secretele în Supabase: `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_BOT_TOKEN`, `PLATFORM_OWNER_DISCORD_IDS` și, unde este folosit, `CRON_SECRET`. Nu salva aceste valori în GitHub sau în fișierele publice ale panelului.

## Migrare viitoare

Nu modifica dump-ul master pentru schimbări incrementale. Pentru o modificare nouă, creează o migrare numerotată în `supabase/migrations`, testeaz-o pe o bază de staging, apoi aplic-o pe producție. După fiecare schimbare majoră, regenerează dump-ul master din baza activă.
