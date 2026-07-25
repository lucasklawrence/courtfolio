-- Expose the migration ledger to the drift check (#334 follow-up).
--
-- `scripts/check-migration-drift.mjs` compares the .sql files in this directory
-- against the migrations actually recorded as applied. The ledger lives in
-- `supabase_migrations.schema_migrations`, which PostgREST does not expose —
-- only `public` and `graphql_public` are — so a REST read returns
-- PGRST106 "Invalid schema". This function is the read path.
--
-- SECURITY DEFINER because the caller must reach a schema outside the exposed
-- set, with `search_path` pinned to '' so every reference is schema-qualified
-- and the body can't be redirected by a caller-controlled path.
--
-- EXECUTE is revoked from the default PUBLIC grant and given to service_role
-- only. The check runs with the service-role key (locally from .env.local, in CI
-- from repo secrets); anon and authenticated must not be able to enumerate the
-- schema history, which would leak table and feature names ahead of release.
--
-- Idempotent: `create or replace` plus unconditional grants, so re-applying on a
-- fresh project or a branch reset is a safe no-op.

create or replace function public.applied_migrations()
returns table (version text, name text)
language sql
security definer
set search_path to ''
as $function$
  select m.version, m.name
  from supabase_migrations.schema_migrations m
  order by m.version
$function$;

comment on function public.applied_migrations is
  'Migration ledger (supabase_migrations.schema_migrations) exposed for the drift check in scripts/check-migration-drift.mjs, since PostgREST only serves the public schema. SECURITY DEFINER, service_role only — not for application use.';

revoke execute on function public.applied_migrations() from public;
revoke execute on function public.applied_migrations() from anon;
revoke execute on function public.applied_migrations() from authenticated;
grant execute on function public.applied_migrations() to service_role;
