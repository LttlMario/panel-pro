# Instalare complet separată pentru o mafie nouă

Această instalare trebuie să aibă propriul proiect Supabase, propriul repository/site și propriii boți Discord. Nu reutiliza proiectul Supabase, cheile sau fișierul `js/supabase-config.js` al mafiei existente.

## 1. Creează proiectele

1. Creează un proiect Supabase nou și notează Project Ref, Project URL, Publishable Key și Service Role/Secret Key.
2. Creează un repository GitHub nou copiind conținutul panelului, fără fișiere `.env` completate.
3. Activează GitHub Pages pentru repository-ul nou și notează URL-ul public.
4. Creează aplicația Discord, botul și OAuth Redirect pentru URL-ul nou (`.../login.html`).

## 2. Instalează baza

1. În Supabase SQL Editor rulează `supabase/INSTALARE-NOUA-COMPLETA.sql` o singură dată.
2. Nu copia ID-urile rolurilor din altă mafie. Rolurile se completează ulterior din configurator.

## 3. Configurează site-ul public

1. Copiază `supabase/supabase-config.template.js` peste `js/supabase-config.js`.
2. Introdu Project URL și Publishable Key din proiectul nou.
3. Nu introduce Service Role/Secret Key în niciun fișier public.
4. Publică repository-ul și verifică dacă `login.html` este accesibil.

## 4. Publică Edge Functions

Autentifică Supabase CLI și rulează din rădăcina repository-ului:

```powershell
./supabase/deploy-functions.ps1 -ProjectRef PROJECT_REF_NOU
```

Sunt necesare toate cele șase funcții: `sync-discord-role`, `manage-discord-config`, `manage-community-posts`, `send-discord-notification`, `close-expired-shifts` și `manage-admin-center`.

## 5. Configurează secretele

1. Copiază `supabase/edge-secrets.example.env` ca `edge-secrets.local.env` în afara repository-ului sau păstrează-l ignorat de Git.
2. Completează Service Role/Secret Key, tokenurile boților și un `CRON_SECRET` aleatoriu.
3. Aplică secretele:

```powershell
./supabase/apply-edge-secrets.ps1 -ProjectRef PROJECT_REF_NOU -EnvFile CALEA_CATRE_edge-secrets.local.env
```

4. Nu urca niciodată fișierul completat pe GitHub.

## 6. Configurează jobul automat

Completează cele trei valori din `supabase/CONFIGURARE-CRON-TEMPLATE.sql`, apoi rulează fișierul în SQL Editor. `CRON_SECRET` trebuie să fie identic cu cel aplicat la Edge Functions.

## 7. Prima autentificare și configurarea Discord

1. Adaugă manual primul administrator în tabela `users`, cu `discord_id` corect și rol/nivel de Coordonator (7).
2. Autentifică-te pe panelul nou.
3. Deschide Configurare Discord și completează organizația, serverul principal, opțional serverul secundar, exact cele șapte roluri și webhook-urile.
4. Salvează configurarea și rulează Verificare sistem.

## 8. Izolarea față de instalația existentă

Instalația este separată numai dacă are simultan: alt proiect Supabase, alt `js/supabase-config.js`, alt repository/site și secrete Discord proprii. Un deploy făcut cu Project Ref-ul nou nu modifică proiectul vechi. Verifică întotdeauna Project Ref-ul înainte de deploy.

## Checklist final

- `js/supabase-config.js` indică proiectul nou.
- Cele șase Edge Functions sunt publicate în proiectul nou.
- Secretele nu există în GitHub.
- Botul este prezent pe serverul corect.
- OAuth Redirect indică site-ul nou.
- Există exact șapte mapări, nivelurile 1–7.
- Joburile cron `panel-cleanup-after-30-days`, `close-expired-shifts-in-database` și `invoke-close-expired-shifts` sunt active.
- Verificare sistem nu raportează erori.
