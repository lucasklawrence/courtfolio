-- OTF class-format resolution from the booking calendar (#453, Phase A).
--
-- WHY THIS EXISTS: `otf_sessions.class_type` is named as if it held the class
-- template but is derived from tread/row block presence in the OTbeat email
-- (#271). It cannot distinguish 2G from 3G, so every analysis grouped by it
-- silently mixes templates. The template appears in exactly one place — the
-- booking calendar, whose event titles read "Orange 60 Min 3G".
--
-- Inference was tried and does not work. A day-of-week rule (Mon/Wed/Thu -> 2G,
-- Sat -> 3G) mislabels 2026-07-22, a Wednesday 3G. Block-time inference fails
-- independently: that same 3G logged only 03:40 of rower time, well inside the
-- 2G range. And 2026-08-05 was "Orange HYROX 60 Min 2G", a program variant no
-- hardcoded taxonomy would have anticipated. The template must be READ from the
-- booking source, never inferred.
--
-- WHY A SEPARATE TABLE (not more columns on otf_sessions): bookings and
-- sessions are independent sources that can disagree. A booking with no session
-- (cancelled, no-show) and a session with no booking (drop-in — 2026-08-06 at
-- Mar Vista is one) are both real and both representable this way. Folding the
-- calendar into otf_sessions would make the first unrepresentable and the
-- second indistinguishable from a feed failure.
--
-- `format` is deliberately free text, NOT an enum. New templates appear without
-- warning (HYROX was unknown until 2026-08-05); a constrained column would have
-- dropped or misfiled it. Validate downstream, not at write time.
--
-- `class_format_source` is NOT decoration. Without it a hand-filled row is
-- indistinguishable from a successfully joined one, and the coverage monitor
-- stops being able to detect a broken calendar feed — a week where every
-- session reads `manual` means ingestion has failed even though class_format is
-- fully populated.
--
-- NOT DROPPED HERE: `otf_sessions.class_type_override`. This migration retires
-- it semantically (nothing reads or writes it after #453) but leaves the column
-- in place, because the currently-deployed `lib/data/otf-shared.ts` names it in
-- its select list — dropping it would 400 the live site the instant this
-- applies, before the PR's code reaches production. The physical drop is a
-- follow-up migration once readers are deployed (see #454, same ordering).
--
-- RLS mirrors otf_sessions: anon + authenticated SELECT only. Writes go through
-- the service-role key (the import script / GitHub Action) and bypass RLS.
--
-- All DDL is idempotent so re-applying on a fresh project or after a branch
-- reset is a safe no-op.

create table if not exists public.otf_bookings (
  id uuid primary key default gen_random_uuid(),
  -- Calendar event UID. The idempotency key: re-running the pull upserts on
  -- this, so a re-read of the same feed adds nothing.
  external_event_id text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- The event title verbatim, always stored even when parsing fails. Every
  -- parsed field below is derived from it and re-derivable if the grammar
  -- changes, so losing the raw string would be losing the source of truth.
  title_raw text not null,
  studio_raw text,
  studio text,
  program text,
  duration_min integer check (duration_min is null or duration_min > 0),
  format text,
  ingested_at timestamptz not null default now()
);

comment on table public.otf_bookings is
  'OrangeTheory class bookings read from the iCloud "Home" calendar (#453). One row per calendar event, keyed for idempotency by external_event_id (the event UID). Holds the class template ("2G", "3G", "HYROX 2G") that the OTbeat email does not carry at all. Separate from otf_sessions so a booking with no session (cancelled) and a session with no booking (drop-in) are both representable. Upsert-only; the pull never prunes.';

comment on column public.otf_bookings.title_raw is
  'Calendar event title verbatim, e.g. ''Orange HYROX 60 Min 2G''. Always populated, including when the title parser fails — the parsed columns go null and a warning is logged, but the row is never dropped and never guessed at.';

comment on column public.otf_bookings.format is
  'Parsed class template: ''2G'', ''3G'', ''Tread 50'', etc. Deliberately free text rather than an enum — OTF introduces templates without notice (HYROX first appeared 2026-08-05), and an enum would have rejected or misfiled it. Validate downstream.';

-- The reconcile pass looks up bookings by start time within a tolerance window,
-- then narrows by studio. Ordered on starts_at because that is the range scan.
create index if not exists otf_bookings_starts_at_idx
  on public.otf_bookings (starts_at desc);

alter table public.otf_bookings enable row level security;

-- Postgres has no `create policy if not exists`; use a DO block to swallow the
-- duplicate-object error so the migration stays re-runnable.
do $$
begin
  create policy "anon and authenticated can read otf bookings"
    on public.otf_bookings
    for select
    to anon, authenticated
    using (true);
exception when duplicate_object then null;
end $$;

alter table public.otf_sessions
  add column if not exists booking_id uuid references public.otf_bookings (id) on delete set null;

alter table public.otf_sessions
  add column if not exists class_format text;

alter table public.otf_sessions
  add column if not exists class_format_source text;

comment on column public.otf_sessions.booking_id is
  'The otf_bookings row this session was matched to by the reconcile pass, or null for a drop-in with no calendar event. ON DELETE SET NULL: re-pulling a calendar that no longer carries an old event must not delete session history.';

comment on column public.otf_sessions.class_format is
  'Resolved OTF class template (''2G'', ''3G'', ''HYROX 2G'', …). Sourced from the matched booking, or set by hand for a session with no booking. Null is a legitimate state — a session with no booking and no manual label stays null rather than being guessed at. Supersedes the retired class_type_override.';

comment on column public.otf_sessions.class_format_source is
  'Where class_format came from: ''booking'' (joined from otf_bookings) or ''manual'' (hand-entered for a drop-in). Required whenever class_format is set. Load-bearing for the coverage monitor: without it a hand-filled row looks identical to a successfully joined one, and a broken calendar feed stops being detectable.';

-- Closed set, unlike `format` — these are our own provenance values, not OTF's
-- vocabulary, so a typo here is a bug rather than a new template.
do $$
begin
  alter table public.otf_sessions
    add constraint otf_sessions_class_format_source_check
    check (class_format_source is null or class_format_source in ('booking', 'manual'));
exception when duplicate_object then null;
end $$;

-- The two columns are meaningless apart: a format with no provenance defeats
-- the coverage monitor, and a provenance with no format says nothing.
do $$
begin
  alter table public.otf_sessions
    add constraint otf_sessions_class_format_paired_check
    check ((class_format is null) = (class_format_source is null));
exception when duplicate_object then null;
end $$;
