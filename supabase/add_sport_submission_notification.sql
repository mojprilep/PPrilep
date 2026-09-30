-- ════════════════════════════════════════════════════════════════════════════
--  Allow 'sport_submission' notifications (a club applied → ping the admins).
--
--  /api/sport/submit inserts one for every admin, but the type was never added
--  to notifications_type_check, so the insert failed silently and no admin
--  ever got the bell row or the push. Same list as
--  add_event_submission_notification.sql, plus 'sport_submission'.
--
--  Run ONCE in the Supabase SQL editor. Takes effect immediately, no deploy.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'issue_comment','issue_affected','issue_helper','issue_help_comment',
    'issue_help_vote','idea_upvote','comment_like','comment_reply',
    'issue_in_district','issue_status','issue_for_agency','agency_post',
    'agency_alert','issue_resolved_by_citizen','event_submission',
    'sport_submission'
  ));

notify pgrst, 'reload schema';
