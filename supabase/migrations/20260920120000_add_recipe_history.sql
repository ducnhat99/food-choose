-- Recently-viewed recipes per user, so a signed-in user can get back to a
-- dish they looked at without re-searching. One row per (user, source,
-- recipe) -- re-viewing an already-seen recipe updates `viewed_at` in place
-- (upsert on the unique constraint below) rather than creating a duplicate,
-- so it just moves back to the top of the list instead of appearing twice.
create table public.recipe_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id integer not null,
  source text not null,
  title text not null,
  image_url text,
  viewed_at timestamptz not null default now(),
  unique (user_id, source, recipe_id)
);

alter table public.recipe_history enable row level security;

create policy "Users can manage their own recipe history"
  on public.recipe_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Caps history at the 10 most recently viewed recipes per user, enforced
-- server-side (via trigger) rather than relying on every client to remember
-- to prune -- same reasoning as handle_new_user() in the init migration.
create function public.trim_recipe_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.recipe_history
  where user_id = new.user_id
    and id not in (
      select id from public.recipe_history
      where user_id = new.user_id
      order by viewed_at desc
      limit 10
    );
  return new;
end;
$$;

create trigger trim_recipe_history_after_upsert
  after insert or update on public.recipe_history
  for each row execute procedure public.trim_recipe_history();
