# Backup SQL complet

Fișierul [BACKUP-COMPLET-BD.sql](BACKUP-COMPLET-BD.sql) conține schema inițială a panelului și toate migrările SQL locale, în ordine cronologică.

## Restaurare într-un proiect Supabase nou

1. Creează proiectul Supabase.
2. Deschide **SQL Editor**.
3. Copiază întregul fișier `BACKUP-COMPLET-BD.sql` și rulează-l o singură dată.
4. Configurează secretele Edge Functions din `edge-secrets.example.env`.
5. Publică funcțiile din `supabase/functions`.

Fișierul SQL recreează structura bazei, tabelele, indexurile, politicile RLS, trigger-ele și funcțiile SQL. Codul Edge Functions nu poate fi inclus ca SQL; el răm�ne în folderul `supabase/functions` și trebuie publicat separat.

Pentru o restaurare cu date reale, exportă separat datele din proiectul Supabase activ și importă-le după rularea acestui fișier.
