-- The daily generation limit now applies to catalog-mode recipes too, not
-- just AI-mode ones (per explicit request -- Suggest a dish / Random dish /
-- Search all cost real resources regardless of mode: OpenAI usage for AI
-- mode, and Spoonacular's own limited free-tier quota for catalog mode).
-- Renamed so the schema stays accurate to what it now actually tracks --
-- "ai_usage" would be actively misleading once it's counting real
-- Spoonacular/TheMealDB fetches too.
alter table public.ai_usage rename to recipe_usage;
alter function public.increment_ai_usage(text, integer) rename to increment_recipe_usage;
