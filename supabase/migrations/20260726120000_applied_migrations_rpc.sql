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
-- EXECUTE is granted to anon as well as service_role, deliberately. The obvious
-- instinct is to restrict this to service_role so the schema history can't be
-- enumerated — but this repository is PUBLIC, so every file in
-- supabase/migrations/ is already on GitHub and the names this function returns
-- are public by construction. Restricting it would buy nothing and cost a great
-- deal: the drift check would need the service-role key, and CI runs it from a
-- pull-request checkout, so any PR that edited the check could exfiltrate a
-- credential that bypasses RLS entirely on production. Reading with the anon key
-- (itself public — it ships in the client bundle) keeps that key out of
-- PR-controlled code completely.
--
-- The function returns only `version` and `name`. It exposes no row data and
-- cannot be used to reach any other schema.
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
  'Migration ledger (supabase_migrations.schema_migrations) exposed for the drift check in scripts/check-migration-drift.mjs, since PostgREST only serves the public schema. SECURITY DEFINER, readable with the anon key — the migration names are already public in this open-source repo, and requiring the service-role key would put an RLS-bypassing credential in reach of pull-request code. Returns names only, no row data. Not for application use.';

-- Drop the blanket PUBLIC grant that `create function` adds by default, then
-- name the roles explicitly rather than relying on it.
revoke execute on function public.applied_migrations() from public;
grant execute on function public.applied_migrations() to anon;
grant execute on function public.applied_migrations() to authenticated;
grant execute on function public.applied_migrations() to service_role;
