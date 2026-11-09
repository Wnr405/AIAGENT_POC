-- FR-AUDIT-03 acceptance: "the database role for the app SHALL NOT have UPDATE/DELETE on the audit table".
-- Migrations run as the owner role; the API runs as `cms_app` (see cms-infra/postgres/init/01-roles.sql).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cms_app') THEN
    GRANT USAGE ON SCHEMA public TO cms_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cms_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON "audit_events" FROM cms_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cms_app;
  END IF;
END
$$;
