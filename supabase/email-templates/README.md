# Template-uri email Panel Pro

Aceste fișiere sunt template-urile pentru Supabase Auth:

- `confirm-email.html` → Authentication → Email Templates → Confirm signup
- `reset-password.html` → Authentication → Email Templates → Reset Password

Subiecte recomandate:

- `Confirmă adresa de email – Panel Pro`
- `Resetare parolă – Panel Pro`

Supabase folosește variabila `{{ .ConfirmationURL }}` pentru linkul securizat. Fișierele se păstrează în repository pentru versiune și pot fi copiate în dashboard-ul Supabase; migrarea SQL nu modifică template-urile de email.
