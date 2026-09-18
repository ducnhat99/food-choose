-- Recipes can now come from either Spoonacular or TheMealDB, both of which
-- use plain numeric ids from separate id spaces. Without this column, the
-- same id number could resolve to two unrelated dishes depending on source.
alter table public.favorites add column source text not null default 'mealdb';

alter table public.favorites drop constraint favorites_user_id_spoonacular_recipe_id_key;
alter table public.favorites
  add constraint favorites_user_id_source_recipe_id_key
  unique (user_id, source, spoonacular_recipe_id);
