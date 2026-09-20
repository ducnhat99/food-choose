-- The previous migration's `revoke update (role) on public.profiles from
-- authenticated` did NOT actually work -- confirmed live via a real
-- self-escalation attempt (a genuine signed-in session, not the service
-- role) that still succeeded afterward. Root cause: `authenticated` already
-- has a broad TABLE-level UPDATE grant (from Supabase's default `grant all
-- ... to authenticated` at project setup), and Postgres's privilege model
-- doesn't let a column-level REVOKE narrow a privilege that was granted at
-- the table level -- the table-level grant simply still applies to every
-- column, `role` included.
--
-- The correct fix: revoke the table-level UPDATE entirely, then re-grant it
-- only for the column(s) a user should be able to change on their own row
-- (display_name). Re-verified live afterward: the same self-escalation
-- attempt now fails with a column-privilege error, while a plain
-- display_name update on your own row still succeeds.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
