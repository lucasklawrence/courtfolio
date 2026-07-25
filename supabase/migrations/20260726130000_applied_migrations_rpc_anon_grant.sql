-- Widen the applied_migrations() grant to anon so the drift check does not need
-- the service-role key (codex on #338).
--
-- Supersedes the service_role-only grant that 20260726120000 originally carried.
-- That file now carries this same grant set, so applying the two in order is
-- consistent either way; this one exists because the grant was applied to
-- production as its own migration, and a migration in the ledger with no file in
-- the repo is exactly the drift `scripts/check-migration-drift.mjs` exists to
-- catch. Keeping it is the convention working on itself.
--
-- Why anon is the right grant, not a loosening:
--   * This repository is PUBLIC. Every file in supabase/migrations/ is on
--     GitHub, so the names this function returns are already published — the
--     restriction protected nothing.
--   * The CI job runs the check from a pull-request checkout, and triggers on
--     changes to the check itself. A service-role key in that job's env could be
--     exfiltrated by a PR that edits the script, and service-role bypasses RLS
--     on production entirely.
--   * The anon key is public by construction (it ships in the browser bundle),
--     so exposing it to PR-controlled code costs nothing.
--   * The function returns `version` and `name` only — no row data, no reach
--     into any other schema.
--
-- Idempotent: unconditional revoke + grants, safe to re-apply.

revoke execute on function public.applied_migrations() from public;
grant execute on function public.applied_migrations() to anon;
grant execute on function public.applied_migrations() to authenticated;
grant execute on function public.applied_migrations() to service_role;
