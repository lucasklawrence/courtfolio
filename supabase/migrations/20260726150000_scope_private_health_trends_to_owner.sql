-- Scope the private health trends to the owner, not all authenticated (#345).
--
-- CORRECTIVE MIGRATION for 20260726140000, which is already applied — per
-- CLAUDE.md § Database migrations the fix ships as its own file rather than an
-- edit to that one, so the repo still records what was actually run.
--
-- THE BUG: 20260726140000 moved bodyweight and sleep from `anon, authenticated`
-- to `authenticated` with `using (true)`, on the assumption that
-- `authenticated` meant "the owner". It does not. The magic-link flow
-- (`app/admin/login/actions.ts`) deliberately lets *anyone* sign in — the
-- allowlist is enforced afterwards, at the `/api/admin/*` layer, so a non-admin
-- can hold a valid session and simply get 403s from the admin API. Such a
-- session carries the `authenticated` role, so `using (true)` handed every
-- body-mass and sleep row to anyone who requested a magic link and clicked it.
-- That defeated the entire point of restricting these two tables.
--
-- THE FIX: match on the owner's user id. `auth.uid()` is the signed-in user's
-- UUID, so the policy now passes only for the account that owns the data.
--
-- WHY A UUID AND NOT AN EMAIL: this repository is public. A bare UUID
-- identifies the row to Postgres while disclosing nothing to a reader, whereas
-- `auth.jwt() ->> 'email' = '…'` would publish a personal address in a
-- committed file. It also can't drift out of sync with a rename.
--
-- Adding a second admin means adding their id here (and to `ADMIN_EMAILS`);
-- there is deliberately no lookup table, because one row of indirection is not
-- worth it for a single-owner site.
--
-- Anon is unaffected — it has no policy on these tables at all and continues to
-- read zero rows. Writes are unaffected: the ingest path uses the service-role
-- client, which bypasses RLS.
--
-- This file is the canonical record of the migration; it is also applied to the
-- `court-vision` Supabase project (`ryxbnvhxxkrmsrmocume`) via the Supabase
-- tooling. Idempotent — drop-then-create — so re-applying is a safe no-op.

drop policy if exists "authenticated can read body mass trend"
  on public.cardio_body_mass_trend;

create policy "owner can read body mass trend"
  on public.cardio_body_mass_trend
  for select
  to authenticated
  using (auth.uid() = 'b82e447c-0814-408c-92be-c6dd4abdf6e4'::uuid);

drop policy if exists "authenticated can read sleep trend"
  on public.cardio_sleep_trend;

create policy "owner can read sleep trend"
  on public.cardio_sleep_trend
  for select
  to authenticated
  using (auth.uid() = 'b82e447c-0814-408c-92be-c6dd4abdf6e4'::uuid);
