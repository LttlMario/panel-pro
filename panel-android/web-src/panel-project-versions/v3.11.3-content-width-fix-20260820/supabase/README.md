# Supabase database workflow

The repository intentionally contains migrations and deployment scripts only.

Production data, webhook URLs, vouchers, panel sessions, Discord identifiers and
user records must never be committed to this public repository. Use the Supabase
Dashboard or `supabase db pull` locally when a private, temporary snapshot is
needed, and keep that snapshot outside the repository.

Before deploying, verify the migration history with `supabase migration list`.
