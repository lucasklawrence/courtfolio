-- Restrict anon reads of otf_bookings to classes that have already happened
-- (#453, review follow-up to 20260812120000_otf_bookings.sql).
--
-- THE PROBLEM: the original policy was `using (true)`, copied from
-- otf_sessions. On otf_sessions that is fine — it holds *past* attendance. On
-- otf_bookings it is not: the table reaches into the future, so an anon reader
-- could `GET /rest/v1/otf_bookings?select=starts_at,studio_raw` and learn where
-- the owner will physically be, and when, days ahead. The site ships
-- NEXT_PUBLIC_SUPABASE_ANON_KEY to every browser, so "anon" means "anyone".
--
-- That is a new exposure class for this project, and it cuts against the
-- precedent already codified in lib/data/otf-shared.ts, where `coach` is
-- deliberately excluded from the session read because the OTF view is publicly
-- reachable and "anything read here is served to anyone, in bulk" (#345).
--
-- WHY NOT REVOKE ANON ENTIRELY: scripts/sync-staging.mjs reads production with
-- the anon key, and otf_sessions.booking_id is a foreign key into this table —
-- staging cannot accept a session whose booking is missing. Every booking a
-- session references is necessarily in the past, so a past-only policy keeps
-- the sync whole while publishing nothing about the future.
--
-- Net effect: anon sees exactly what otf_sessions already reveals — where the
-- owner has been — and nothing about where they will be.
--
-- Idempotent: the policy is dropped by name before being recreated, so
-- re-applying is a safe no-op.

drop policy if exists "anon and authenticated can read otf bookings" on public.otf_bookings;

do $$
begin
  create policy "anon and authenticated can read past otf bookings"
    on public.otf_bookings
    for select
    to anon, authenticated
    using (starts_at < now());
exception when duplicate_object then null;
end $$;

comment on table public.otf_bookings is
  'OrangeTheory class bookings read from the iCloud "Home" calendar (#453). One row per calendar event, keyed for idempotency by external_event_id (the event UID). Holds the class template ("2G", "3G", "HYROX 2G") that the OTbeat email does not carry at all. Separate from otf_sessions so a booking with no session (cancelled) and a session with no booking (drop-in) are both representable. Upsert-only; the pull never prunes. RLS exposes only bookings whose start time has passed — a future booking would publish the owner''s whereabouts in advance, which otf_sessions never does.';
