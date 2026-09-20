-- Caches the video(s) finalizeRecipe resolves for a given recipe, so the
-- SAME video shows up every time that recipe is viewed again, instead of a
-- fresh YouTube search.list call potentially returning a different "best
-- match" on a later visit (YouTube's search ranking isn't guaranteed
-- stable across separate calls) -- confirmed as the cause of a "different
-- video each time I revisit a recipe" report. Keyed by (source, recipe_id),
-- same scoping as every other per-recipe table in this app (favorites,
-- recipe_history) -- all three sources share one plain integer id space
-- per source, not globally. Caches even an empty result (no video found),
-- so a recipe with no good match doesn't keep spending YouTube's limited
-- search quota on every view either.
--
-- RLS enabled with zero policies, same as ai_recipes/recipe_usage -- only
-- the server-only admin client (api/_lib/supabaseAdmin.ts) ever touches
-- this table; nothing here is scoped to a particular user, so there's no
-- per-user policy to write anyway.
create table public.recipe_video_cache (
  source text not null,
  recipe_id integer not null,
  video_urls jsonb not null,
  created_at timestamptz not null default now(),
  primary key (source, recipe_id)
);

alter table public.recipe_video_cache enable row level security;
