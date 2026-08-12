# Migrare la platforma multi-organizație

Versiunea se publică numai după backup. Migrarea păstrează datele actuale și le atașează automat primei organizații.

## Înainte de deploy

1. În Supabase Dashboard creează un backup al bazei sau exportă tabelele.
2. Notează Discord ID-ul proprietarului platformei.
3. Confirmă că botul actual este online și poate citi membrii și rolurile serverului existent.
4. Invită același bot pe fiecare server nou folosind permisiunea de citire a membrilor/rolurilor. În Discord Developer Portal activează `Server Members Intent`.

## 1. Baza de date

În SQL Editor rulează, o singură dată:

`supabase/MASTER-MULTI-ORGANIZATIE.sql`

Migrarea creează organizațiile, serverele, mapările normalizate, membrii, sesiunile securizate și politicile RLS. Datele existente primesc automat organizația inițială.

## 2. Secrete Edge Functions

Adaugă în Supabase Dashboard → Edge Functions → Secrets:

- `SUPABASE_SERVICE_ROLE_KEY`: Service Role/Secret Key din proiect.
- `DISCORD_BOT_TOKEN`: tokenul botului comun.
- `PLATFORM_OWNER_DISCORD_IDS`: Discord ID-ul tău; mai multe ID-uri se separă prin virgulă.
- `CRON_SECRET`: valoarea lungă deja folosită de jobul cron.

`SUPABASE_URL` este furnizat automat de Supabase.

## 3. Edge Functions

Din rădăcina proiectului:

```powershell
./supabase/deploy-functions.ps1 -ProjectRef PROJECT_REF
```

Rulează `supabase/deploy-functions.ps1`; acesta publică toate funcțiile Edge active și evită menținerea unei liste duplicate în documentație.

## 4. Site-ul

Încarcă toate fișierele versiunii multi-organizație în repository și așteaptă publicarea GitHub Pages. Nu schimba proiectul Supabase din `js/supabase-config.js` pentru migrarea instalației actuale.

După publicare, șterge datele site-ului/localStorage din browser sau folosește Logout, apoi autentifică-te din nou. Loginul nou trebuie să returneze `panel_session_token` și organizația activă.

## 5. Prima verificare

1. Autentifică-te cu utilizatorul din `PLATFORM_OWNER_DISCORD_IDS`.
2. Deschide `organizatii.html`.
3. Verifică organizația migrată și serverul principal.
4. Deschide Configurare Discord și salvează din nou cele șapte roluri.
5. Rulează Verificare sistem.
6. Testează pontaj, absență, marketplace, anunț, raport și administrarea unui membru.

## Adăugarea unei mafii noi

1. Invită botul comun pe serverul noii mafii.
2. Deschide `organizatii.html` și apasă „Organizație nouă”.
3. Completează numele, codul, Guild ID-ul și URL-ul public comun.
4. Apasă „Verifică și citește rolurile”.
5. Alege rolul Discord pentru nivelurile 1–7 și salvează.
6. Configurează webhook-urile organizației.
7. La următorul login, membrii serverului sunt identificați automat. Dacă o persoană aparține mai multor mafii, selectorul de organizație apare în antet.

## Reguli de izolare

- Browserul nu poate alege arbitrar un `organization_id`; RLS îl extrage din tokenul opac al sesiunii.
- Tokenurile sunt stocate numai ca hash SHA-256 și expiră după 12 ore.
- Un membru vede doar datele organizației active.
- Setările și locațiile pot fi modificate numai de nivelul 7.
- Acțiunile comunității, notificările și administrarea trec prin Edge Functions.
- Schimbarea rolului sau kick-ul revocă sesiunile utilizatorului în organizația respectivă.

## Revenire

Nu șterge tabelele vechi imediat. Dacă deploy-ul trebuie anulat, publică din nou versiunea anterioară a site-ului și a Edge Functions, apoi restaurează backup-ul bazei. Migrarea nu elimină tabelele sau datele vechi de configurare.
