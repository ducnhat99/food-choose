-- The previous migration's `alter function increment_ai_usage(...) rename
-- to increment_recipe_usage` renamed the FUNCTION but not what's INSIDE it
-- -- a `language sql` function's body is stored as plain text and is not
-- rewritten when a table it references is renamed (unlike a view, which
-- Postgres does track and update). Confirmed live: calling
-- increment_recipe_usage afterward failed with `relation "public.ai_usage"
-- does not exist`, and the daily limit silently failed open for every
-- request as a result (recordAndCheckRecipeUsage treats any RPC error as
-- "allowed", by design, so no request was ever blocked -- and nothing was
-- ever actually recorded either, since the insert itself never ran).
--
-- CREATE OR REPLACE with the corrected body, still referencing the same
-- (already renamed) recipe_usage table.
create or replace function public.increment_recipe_usage(p_identity text, p_delta integer default 1)
returns integer
language sql
security definer set search_path = public
as $$
  insert into public.recipe_usage (identity, usage_date, count)
  values (p_identity, (now() at time zone 'utc')::date, p_delta)
  on conflict (identity, usage_date)
  do update set count = public.recipe_usage.count + p_delta
  returning count;
$$;
