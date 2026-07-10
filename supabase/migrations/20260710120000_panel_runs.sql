-- Live judge-panel run ledger + cache (#241).
--
-- One table pays double rent for the public /api/panel/run endpoint — the
-- repo's only paid endpoint strangers can trigger:
--
--   * Rate-limit ledger: admission is insert-then-count (the route inserts a
--     'running' row first, then counts each window including itself), so a
--     concurrent race can only over-count and reject — fail closed, a run is
--     never executed un-metered.
--   * Run cache: the newest non-degraded 'completed' row within the TTL is
--     replayed to subsequent visitors as a zero-cost stream, so N visitors in
--     an hour cost one real run.
--
-- Volume is tiny by construction (the global cap is 25 real runs/day plus
-- rejected rows), so rows are retained indefinitely — no pruning job.
--
-- All DDL is idempotent (if not exists) so re-applying on a fresh dev project
-- or after a branch reset is a safe no-op.

create table if not exists public.panel_runs (
  id uuid primary key default gen_random_uuid(),
  target_id text not null,
  ip_hash text,
  status text not null check (status in ('running', 'completed', 'failed', 'rejected')),
  persona_failure_count integer not null default 0,
  result jsonb,
  error_type text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

comment on table public.panel_runs is
  'Ledger + cache for live judge-panel runs (#241). One row per admission attempt on POST /api/panel/run: running -> completed (result stored, replayed to later visitors) | failed (starts the retry cooldown) | rejected (refused by a rate limit; spent nothing). Service-role access only.';

comment on column public.panel_runs.ip_hash is
  'sha256(client IP + PANEL_IP_HASH_SALT). Never the raw IP — the hash only needs to bucket requests for the per-IP window count.';

comment on column public.panel_runs.persona_failure_count is
  'How many personas were benched (failed model calls) in this run. Only runs with 0 are served from the shared cache — a degraded panel is never the showcase.';

comment on column public.panel_runs.result is
  'The full PanelResult JSON for completed runs; replayed byte-identical through the same wire protocol a live run streams.';

comment on column public.panel_runs.error_type is
  'Error constructor name only (never a message — messages can carry payloads). StaleRunTimeout marks rows swept after a crashed function held ''running'' too long.';

-- Window counts: global (created_at) and per-IP (ip_hash, created_at).
create index if not exists panel_runs_created_at_idx
  on public.panel_runs (created_at desc);

create index if not exists panel_runs_ip_created_idx
  on public.panel_runs (ip_hash, created_at desc);

-- Single-flight: at most one live run per target at a time. Two first
-- visitors racing a cache miss can't both trigger a paid run — the second
-- insert hits this index and is refused.
create unique index if not exists panel_runs_one_running_idx
  on public.panel_runs (target_id)
  where status = 'running';

-- Service-role only: RLS on with zero policies denies anon/authenticated
-- access entirely; the route uses the service-role client, which bypasses RLS.
alter table public.panel_runs enable row level security;
