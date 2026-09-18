# Sun's Kitchen

Helps you decide what dish to cook: browse/search recipes, save favorites, and
get an AI-picked recommendation (OpenAI) grounded in a real, fetchable recipe.

## Stack

- Frontend: React + TypeScript, built with Vite, styled with Tailwind CSS
- Data: hybrid recipe provider — tries
  [Spoonacular](https://spoonacular.com/food-api) first (richer catalog,
  especially for less-common cuisines), falls back transparently to
  [TheMealDB](https://www.themealdb.com/api.php) (free, no signup) if
  Spoonacular is unset, invalid, or its daily quota is used up. The app works
  fully on TheMealDB alone with zero setup — Spoonacular is a pure optional
  enhancement.
- Backend: [Vercel Serverless Functions](https://vercel.com/docs/functions) (`api/`)
  proxy both recipe providers + OpenAI so no key reaches the browser
- Auth + database: [Supabase](https://supabase.com) — Postgres for
  favorites/preferences, built-in email/password auth
- AI recommendation: OpenAI (Chat Completions API), called from `api/recommend-dish.ts`
- RecipeDetail image slideshow: the one real photo from the recipe provider,
  plus extra stock photos from [Wikimedia Commons](https://commons.wikimedia.org)
  (free, no API key needed at all) — neither recipe provider has more than
  one real photo per dish, so the extras are illustrative, not guaranteed to
  be the exact dish, and are labeled as such in the UI

Frontend and backend both deploy to Vercel as one project; Supabase is only
used for Auth + Postgres, not Edge Functions.

Because Spoonacular and TheMealDB use separate numeric id spaces (the same
number can mean two different dishes), every recipe reference carries a
`source: 'spoonacular' | 'mealdb'` tag — recipe URLs are `/recipe/:source/:id`,
and the `favorites` table has a matching `source` column.

## Setup

### 1. Env vars

```bash
cp .env.local.example .env.local
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`
(see comments in `.env.local.example` for where each comes from).
`MEALDB_API_KEY` is optional (defaults to `"1"`, TheMealDB's public test key).
`SPOONACULAR_API_KEY` is also optional — leave it blank to run on TheMealDB
alone, or set it to get Spoonacular's larger catalog as the primary source.
The RecipeDetail image slideshow needs no key at all — its extra stock photos
come from Wikimedia Commons.

Only the `VITE_`-prefixed vars get bundled into the browser. Everything else
is read server-side only, by the functions in `api/`.

### 2. Supabase project (Auth + Postgres only)

The Supabase CLI is a local dev dependency (pulled in by `npm install`), run
via `npx supabase <command>`.

```bash
npx supabase login
npx supabase init      # safe even though supabase/migrations already exists
                        # -- only adds the missing config.toml
npx supabase link --project-ref <your-project-ref>
npx supabase db push   # applies supabase/migrations/
```

The project ref is the `xxxx` in `https://xxxx.supabase.co`, shown on
Project Settings → API (also where you get `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` for step 1).

Get an OpenAI key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
and a Spoonacular key at [spoonacular.com/food-api](https://spoonacular.com/food-api)
(free tier: 150 requests/day — this is exactly why the app falls back to
TheMealDB once that's used up, rather than breaking).

### 3. Run

```bash
npm install
npm run dev
```

`npm run dev` runs the Vite dev server only — fine for frontend-only work,
but calls to `/api/*` will 404 since Vite doesn't run serverless functions.
To exercise the full app locally (search, recipe detail, AI recommendation):

```bash
npm run dev:full
```

This runs `vercel dev`, which serves the Vite frontend and the `api/`
functions together on one local port, reading `.env.local` for both.

### 4. Deploy

Push to a Git repo and import it in the Vercel dashboard, or run
`npx vercel` from this directory. Either way, set the same env vars from
`.env.local` in the Vercel project's Environment Variables settings —
Vercel injects them into both the static build (`VITE_*`) and the `api/`
function runtime (`OPENAI_API_KEY`, `MEALDB_API_KEY`, `SPOONACULAR_API_KEY`).

## Commands

- `npm run dev` — Vite dev server (frontend only)
- `npm run dev:full` — `vercel dev`, frontend + `api/` functions together
- `npm run build` — type-check (`tsc -b`, covers `src/` and `api/`) and build for production
- `npm run preview` — preview the production build locally
- `npm run lint` — run oxlint
- `npx supabase db push` — apply `supabase/migrations/` to the linked project
