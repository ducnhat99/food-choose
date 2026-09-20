-- Recipes fully invented by AI (Suggest a dish / Random dish / Search, when
-- the AI-mode toggle is on) instead of fetched from Spoonacular/TheMealDB.
-- Persisted so a generated recipe survives a page refresh, can be
-- favorited, and the app builds a real catalog over time instead of
-- discarding every generation.
create table public.ai_recipes (
  id integer generated always as identity primary key,
  title text not null,
  category text not null,
  area text not null,
  instructions text not null,
  ingredients jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_recipes enable row level security;

-- Deliberately no policies: RLS enabled with zero policies denies ALL direct
-- client access (anon and authenticated alike). Only server code using the
-- service role key (which bypasses RLS) can read or write this table --
-- consistent with the app never letting the browser talk to a recipe
-- source directly (Spoonacular/TheMealDB are also only ever reached via
-- api/*.ts, never from the client).
