-- Audit read-only pentru proiectul Panel Pro.
-- Nu șterge și nu modifică nimic.

-- 1) Dimensiunea tabelelor și a indicilor.
SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS estimated_rows,
  pg_size_pretty(pg_table_size(relid)) AS table_size,
  pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  COALESCE(last_analyze::text, 'niciodată') AS last_analyze,
  COALESCE(last_autoanalyze::text, 'niciodată') AS last_autoanalyze
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- 2) Ce indici ocupă cel mai mult spațiu.
SELECT
  schemaname,
  relname AS table_name,
  indexrelname AS index_name,
  idx_scan AS scans,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- 3) Obiectele din Supabase Storage, grupate pe bucket.
SELECT
  bucket_id,
  COUNT(*) AS object_count,
  pg_size_pretty(COALESCE(SUM((metadata->>'size')::bigint), 0)) AS logical_size,
  MIN(created_at) AS oldest_object,
  MAX(created_at) AS newest_object
FROM storage.objects
GROUP BY bucket_id
ORDER BY COALESCE(SUM((metadata->>'size')::bigint), 0) DESC;

-- 4) Bucket-uri configurate.
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
FROM storage.buckets
ORDER BY name;

-- 5) Tabelele care au coloane de timp utile pentru retenție.
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema IN ('public', 'storage')
  AND column_name IN (
    'created_at', 'updated_at', 'created_on', 'updated_on',
    'timestamp', 'event_at', 'expires_at', 'ended_at', 'archived_at',
    'deleted_at', 'resolved_at', 'handled_at', 'reviewed_at', 'start_at', 'end_at'
  )
ORDER BY table_schema, table_name, column_name;

-- 6) Cron-uri active (dacă extensia pg_cron este disponibilă).
SELECT jobid, schedule, command, active
FROM cron.job
ORDER BY jobid;

-- 7) Dimensiunea totală a schemelor principale.
SELECT
  schemaname,
  pg_size_pretty(SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass))) AS total_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass)) DESC;
