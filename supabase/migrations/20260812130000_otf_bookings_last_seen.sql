-- Feed-liveness column for otf_bookings, and retire the class_type_override
-- comment (#453, review follow-ups to 20260812120000_otf_bookings.sql).
--
-- WHY last_seen_at: `findBookingFeedSilence` answers "is the booking feed still
-- producing?", and it cannot ask that of `starts_at`. Bookings reach into the
-- future, so a healthy pull on Monday stores classes for the next month; if the
-- credential is revoked on Tuesday, every one of those rows still satisfies
-- `starts_at >= now() - 14 days` and the gate reports green for weeks — through
-- exactly the window it exists to cover, since revocation typically follows a
-- successful pull. `ingested_at` can't stand in either: it records only the
-- first sighting, so a feed re-serving unchanged events would look dead.
--
-- `last_seen_at` is rewritten by every upsert, so it means "the feed produced
-- this row on that date", which is the liveness question. Defaults to now() so
-- existing rows start from a truthful-enough baseline rather than NULL.
--
-- WHY the comment change: #453 retired `class_type_override` in code — nothing
-- selects, validates, or reads it after PR #458 — but the column stays until
-- readers are deployed (#454 drops it). Its in-database comment is the
-- discovery surface when hovering the column in the Supabase table editor, and
-- it still instructs the reader to set it to a real format name. Following that
-- instruction now does nothing: the chip keeps showing the inferred label, the
-- session still reports as missing a class_format, and #454 then drops the
-- column and destroys the edit. Re-comment so the stale instruction can't be
-- acted on.
--
-- All DDL is idempotent so re-applying is a safe no-op.

alter table public.otf_bookings
  add column if not exists last_seen_at timestamptz not null default now();

comment on column public.otf_bookings.last_seen_at is
  'When the calendar feed last produced this event. Rewritten by every upsert, unlike ingested_at which records only the first sighting. This is the feed''s liveness signal: findBookingFeedSilence compares it against recent sessions, because counting by starts_at would let already-stored future bookings mask a dead feed.';

-- Ordering index for the liveness query, which asks for rows newer than a cutoff.
create index if not exists otf_bookings_last_seen_at_idx
  on public.otf_bookings (last_seen_at desc);

comment on column public.otf_sessions.class_type_override is
  'RETIRED (#453) — do not set. Superseded by class_format + class_format_source; nothing in the application reads this column any more, so a value written here has no effect anywhere and will be lost when the column is dropped (#454). To label a session by hand, set class_format and class_format_source = ''manual''.';
