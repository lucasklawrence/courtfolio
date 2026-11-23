-- Order notices stay off the review list (#502 review, round 2).
--
-- event_emails_review was meant to skip order notices, which carry no event
-- details by design, but it only skipped them in its "unmatched" branch.
-- Every notice is stored at confidence 0, so the "low confidence" branch
-- listed it anyway, and it counted towards the importer's review log line and
-- Wrapped's emails_needing_review. A notice is now excluded from both
-- branches.
--
-- Same columns, so `create or replace` is enough and re-applying is a no-op.

create or replace view public.event_emails_review
with (security_invoker = true) as
select gmail_message_id, platform, kind, subject, received_at, confidence, note, event_id
from public.event_emails
where kind <> 'notice'
  and (event_id is null or confidence < 0.7)
order by received_at desc;

comment on view public.event_emails_review is
  'Ticket emails that could not be matched to an event or were read with confidence below 0.7 (#502). Order notices are stored but never listed: they carry no event details by design.';

revoke all on public.event_emails_review from anon, authenticated;
