-- Defence in depth (11 §4): the website's server is the only door to the data.
-- Row Level Security is on with no policies, so any role other than the table owner sees nothing.
-- The server connects as the owner, so it is not affected.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
  -- Supabase's API roles get no access to the app schema. These roles don't exist in local PGlite, so skip there.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA app FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated';
  END IF;
END $$;
