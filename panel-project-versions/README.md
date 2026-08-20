# Arhive versiuni Panel

Acesta este indexul central pentru rollback și verificarea modificărilor.

Pentru fiecare actualizare există un folder `vX.Y.Z-nume-actualizare-data` care conține:

- `README.md` — rezumatul și pașii de rollback;
- `manifest.json` — versiunea, commit-ul, deploy-ul și lista fișierelor;
- `source/` — fișierele web modificate;
- `functions/` — funcțiile Supabase și fișierele comune folosite la deploy;
- `sql/` — istoricul SQL disponibil pentru versiunea respectivă.

Regula proiectului este ca orice modificare nouă să primească o versiune nouă și o arhivă nouă aici. Pentru rollback se folosește commit-ul din manifest, iar SQL-ul se rulează doar după verificarea diferențelor față de schema curentă.

Versiunea curentă: **v3.11.0**

- [v3.11.0 — administrare platformă și rollback](v3.11.0-platform-admin-rollback-20260820/README.md)
