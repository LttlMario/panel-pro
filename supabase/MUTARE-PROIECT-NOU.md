# Mutarea panelului pe un proiect Supabase nou

1. Creează proiectul Supabase și configurează URL-ul, cheia publishable/anon și secretele server-side.
2. Verifică istoricul și aplică migrațiile din `supabase/migrations` cu Supabase CLI.
3. Publică funcțiile din folderul `functions` cu `deploy-functions.ps1`.
4. Configurează Discord Client ID, guild-urile, rolurile și webhook-urile numai din Dashboard/configurator.
5. Adaugă URL-ul `.../login.html` în Discord Developer Portal → OAuth2 → Redirects.

Nu încărca niciodată cheia `service_role`, fișierul `.env` completat, tokenurile Discord sau exporturi de producție în GitHub.
