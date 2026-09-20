-- Roles: 'user' (default, everyone signs up as this) or 'admin'. Admins are
-- exempt from the daily AI-generation limit below entirely; everyone else --
-- including anonymous/unauthenticated callers, who have no profiles row at
-- all -- is capped, since every AI-mode generation call costs real OpenAI
-- usage the app owner pays for.
alter table public.profiles add column role text not null default 'user';

-- Promote the app owner's own account to admin, so adding this limit here
-- doesn't also block their own testing/usage of the app.
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'ducnhatnguyenvan@gmail.com');

-- Tracks how many AI-generated recipes a given identity has produced on a
-- given UTC date -- one row per (identity, day). `identity` is either
-- `user:<uuid>` for a signed-in caller or `ip:<address>` for an anonymous
-- one (api/_lib/auth.ts resolves this; a serverless function has no other
-- durable per-caller identity for a logged-out visitor). RLS enabled with
-- zero policies, same as ai_recipes -- only the server-only admin client
-- (api/_lib/supabaseAdmin.ts) ever touches this table.
create table public.ai_usage (
  identity text not null,
  usage_date date not null,
  count integer not null default 0,
  primary key (identity, usage_date)
);

alter table public.ai_usage enable row level security;

-- Atomically records `p_delta` more AI-generated recipes for `p_identity`
-- today (UTC) and returns the new running total, in one round trip -- a
-- plain select-then-upsert from application code would race under
-- concurrent requests (two requests both reading count=4 and both writing
-- count=5, losing an increment). `p_delta` is >1 for api/search.ts's AI
-- mode, which generates several recipes (AI_SEARCH_RESULT_COUNT) in a
-- single call -- each one counts toward the limit, not just the call itself.
create function public.increment_ai_usage(p_identity text, p_delta integer default 1)
returns integer
language sql
security definer set search_path = public
as $$
  insert into public.ai_usage (identity, usage_date, count)
  values (p_identity, (now() at time zone 'utc')::date, p_delta)
  on conflict (identity, usage_date)
  do update set count = public.ai_usage.count + p_delta
  returning count;
$$;
