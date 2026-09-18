# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server, frontend only (`/api/*` calls will 404)
- `npm run dev:full` — `vercel dev`, runs the frontend and `api/` serverless functions together (needs `.env.local`)
- `npm run build` — type-check (`tsc -b`, covers `src/` via tsconfig.app.json and `api/` via tsconfig.api.json) then production build via Vite
- `npm run lint` — oxlint over the source
- `npm run preview` — preview the production build
- `npx supabase db push` — apply `supabase/migrations/` to the linked project

There is no test runner configured yet.

## Architecture

Sun's Kitchen is a Vite + React + TypeScript SPA with a Vercel-hosted backend.
Both frontend and backend deploy together as one Vercel project. Two categories
of external data:

1. **Recipes** — a hybrid of two providers, both fetched only through `api/*.ts`
   Vercel Serverless Functions, never directly from the browser:
   - **Spoonacular**: tried first when `SPOONACULAR_API_KEY` is set. Richer
     catalog (especially for less-common cuisines), but a 150 req/day free
     quota.
   - **TheMealDB**: the fallback, and the only provider used when
     `SPOONACULAR_API_KEY` is unset. Its public test key (`"1"`, the default
     for `MEALDB_API_KEY`) needs no signup, but the catalog is much smaller.
   - `api/_lib/spoonacular.ts`'s functions return `null` specifically to mean
     "Spoonacular failed or isn't configured" (a legitimate empty result set
     is `[]`, not `null`), so `api/search.ts` and `api/recommend-dish.ts` can
     do `(await spoonacularSearch(...)) ?? (await mealdbSearch(...))` without
     caring why Spoonacular didn't answer. `api/_lib/mealdb.ts` has no
     further fallback to signal to (it's the last resort), so it just
     returns `[]` on its own failures too. `api/recipe.ts` doesn't fall back
     between providers at all (see below) since that's impossible in
     principle once you already have a specific id.
2. **Supabase** (Postgres + Auth only, no Edge Functions) — accessed directly
   from the client via `supabase-js`, protected by Row Level Security (each
   user only sees their own `preferences`/`favorites` rows).

**Every recipe reference carries a `source: 'spoonacular' | 'mealdb'` tag.**
This is load-bearing, not decorative: both providers use plain numeric ids
from separate id spaces, so the same number can mean two unrelated dishes.
`RecipeSummary`/`RecipeDetail` (`src/lib/api.ts`) both have `source`; the
route is `/recipe/:source/:id` (`src/App.tsx`); `favorites` has a `source`
column (`supabase/migrations/20260917010000_add_favorites_source.sql`). Any
new code that builds a recipe link or saves/looks up a recipe must carry
`source` through — an id alone is not a valid recipe reference in this app.
`api/recipe.ts` requires `source` explicitly rather than guessing from the
id, and never falls back to the other provider on failure, because if
Spoonacular is down and the id is a Spoonacular id, TheMealDB cannot look it
up at all (different id space, not just a different name for the same dish).

TheMealDB's data is much smaller/patchier than Spoonacular's and shapes real
constraints in `api/_lib/mealdb.ts` and `src/lib/cuisines.ts`:

- `CUISINES` combines two verified sources: a subset of TheMealDB areas that
  actually have recipes (checked live against the API — TheMealDB's own
  `list.php?a=list` endpoint returns all ~195 UN countries regardless of
  whether any have recipes, so that raw list is never used directly), plus
  Spoonacular's own supported cuisine vocabulary (verified live against
  spoonacular.com/food-api/docs) for the regional/style names TheMealDB has
  no data for (Asian, Mediterranean, Korean, etc.). A cuisine name not in
  Spoonacular's vocabulary must never be sent to it as the `cuisine` param —
  confirmed live that Spoonacular returns HTTP 200 with an empty result set
  for an unrecognized value rather than an error, which is indistinguishable
  from a genuine "no matches" and would silently defeat the mealdb fallback
  for real TheMealDB countries like Jamaican/Kenyan/Polish (their real
  recipes would never be reached). `api/_lib/spoonacular.ts`'s
  `isKnownSpoonacularCuisine` guards against this in both
  `spoonacularSearch` and `spoonacularRandom`.
- There's no diet-restriction concept in TheMealDB (Vegetarian/Vegan exist
  only as two of the 14 fixed `CATEGORIES`, alongside things like
  Beef/Dessert/Seafood) and no combined multi-filter search — TheMealDB's
  half of `api/recommend-dish.ts`'s `search_recipes` tool can only use one of
  query/area/category/mainIngredient per call. When Spoonacular answers
  instead, `mapCategoryToSpoonacular` in `api/recommend-dish.ts` translates
  TheMealDB's category vocabulary onto Spoonacular's `diet`/`type`/
  `includeIngredients` params as a best-effort mapping (e.g. "Vegetarian" →
  `diet=vegetarian`, "Beef" → `includeIngredients=beef`) — the tool's
  LLM-facing schema never changes, only which provider and params answer it.
- Recipe detail has no prep time or serving count in TheMealDB — RecipeDetail
  shows Category/Area badges instead. TheMealDB's `strInstructions` is plain
  text; Spoonacular's is HTML, stripped to plain text in
  `api/_lib/spoonacular.ts`'s `htmlToPlainText` so both providers produce the
  same shape and RecipeDetail can render everything with `whitespace-pre-line`
  (no HTML sanitization needed either way).
- TheMealDB ingredients are `strIngredient1..20`/`strMeasure1..20` flat fields
  (empty string OR `null` depending on position) with a free-text measure
  like `"3/4 cup"`; Spoonacular's `extendedIngredients[]` has separate
  `amount`/`unit` fields, collapsed into one `measure` string
  (`` `${amount} ${unit}` ``) so both providers match the same
  `RecipeDetail.ingredients` shape.

```text
src/lib/supabaseClient.ts   — supabase-js client (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
src/lib/api.ts              — thin wrappers calling api/*.ts via plain fetch('/api/...'); defines RecipeSource
src/lib/cuisines.ts         — CUISINES (verified TheMealDB areas) / CATEGORIES (TheMealDB's fixed category list) + VI label maps + findMatchingOption (case-insensitive match of free-text saved preferences against one of these lists), used by Search's filter and Home's form
src/hooks/                  — React Query hooks per concern (useRecipes, useFavorites, usePreferences, useRecommendDish); useTranslatedTexts is only for Favorites' saved titles
src/context/AuthContext.tsx — wraps the Supabase auth session, exposed via useAuth()
src/context/LanguageContext.tsx — EN/VI toggle state (persisted to localStorage), exposes t(key) for static UI strings
src/i18n/translations.ts    — { key: { en, vi } } dictionary for static UI text (nav, labels, buttons, errors)
src/components/Layout.tsx        — nav shell (React Router <Outlet />) + language toggle button
src/components/ProtectedRoute.tsx — redirects to /login if unauthenticated
src/pages/                  — one file per route, wired up in src/App.tsx (recipe route is /recipe/:source/:id).
                               Home and Search both pre-fill their Cuisine dropdown from the signed-in
                               user's saved Preferences (findMatchingOption in cuisines.ts) on first
                               load only -- a later manual change to the dropdown is never overwritten,
                               since the effect only sets state when the field is still empty

api/
  _lib/translate.ts         — translateToVietnamese/translateToEnglish: shared OpenAI batch-
                               translation helpers, provider-agnostic
  _lib/glossary.ts          — translateIngredientName/translateMeasure: a static lookup table for
                               units (cup, tbsp, gram, ...) and common ingredient names (chicken,
                               garlic, fish sauce, ...). These have exactly one correct Vietnamese
                               term each, so asking the AI translator for them was a source of
                               inconsistent/wrong wording; the glossary is checked first in
                               finalize.ts and only unmatched names/measures fall through to
                               translateToVietnamese. Returns null (not a guess) on anything not in
                               the table, including compound measures like "1 (10 oz) can"
  _lib/mealdb.ts            — mealdbSearch/mealdbRecipe/mealdbRandom: TheMealDB fetch +
                               normalization to the shared RecipeSummary/RecipeDetail shape
                               (source: 'mealdb'). mealdbRandom composes random.php (no cuisine
                               filter exists) with the existing area-filter search + a random pick
                               when a cuisine is requested
  _lib/spoonacular.ts       — spoonacularSearch/spoonacularRecipe/spoonacularRandom: same shared
                               shape (source: 'spoonacular'); all return null on ANY failure
                               (missing/invalid key, quota exhausted, network error) so callers
                               fall back without needing to know why. spoonacularRandom uses
                               /recipes/random's native include-tags param for the cuisine filter.
                               A module-level cooldown (30 min after a 402, 1 min after any other
                               failure) makes every function here return null immediately without
                               even attempting the request once one has failed, instead of wasting
                               a network round-trip re-trying a call already known to fail -- matters
                               most for recommend-dish.ts, whose search_recipes tool can run up to
                               8 times in one request (verified live: without this, a single
                               recommendation with a few search rounds logged one Spoonacular
                               failure per round; with it, one failure total). The cooldown resets
                               only by its own timer expiring, not on the next success, and is
                               per warm function instance -- it isn't guaranteed to persist between
                               separate serverless invocations
  _lib/finalize.ts          — finalizeRecipe: the shared last step for any RecipeDetail regardless
                               of how it was fetched (by id, or a random pick) -- attaches
                               _lib/images.ts stock photos and translates to Vietnamese when
                               requested (title/instructions/category/area always via AI; each
                               ingredient name/measure tries _lib/glossary.ts first and only sends
                               the leftovers to the AI batch, preserving the original
                               name/measure order when merging results back). Used by both
                               recipe.ts and random.ts so this logic exists in exactly one place
  _lib/images.ts            — searchDishImages: extra stock photos for RecipeDetail's slideshow,
                               sourced from Wikimedia Commons (no API key needed at all). Neither
                               recipe provider has more than one real photo per dish, so this is a
                               purely cosmetic enhancement (never throws, returns [] on any
                               failure) -- results are NOT guaranteed to be the exact dish, and for
                               obscure/invented-sounding recipe titles often come back empty, which
                               is the correct, honest outcome (better than an unrelated result). A
                               `filetype:bitmap` search filter excludes non-photo files (PDF scans,
                               diagrams) that would otherwise sometimes match on stray title words
  search.ts                 — query -> search.php?s= / complexSearch?query=, else cuisine ->
                               filter.php?a= / complexSearch?cuisine= (query wins if both are set,
                               matching TheMealDB's more limited API; Spoonacular natively supports
                               both together, that combined-filter capability is the main reason
                               Spoonacular is tried first); translates the query EN->VI first and
                               result titles back after, regardless of which provider answered
  recipe.ts                 — requires an explicit `source` in the request body, calls that
                               provider's lookup directly, then _lib/finalize.ts's finalizeRecipe
                               for photos + translation. Deliberately does NOT fall back to the
                               other provider on failure (unlike search.ts/random.ts/
                               recommend-dish.ts) -- Spoonacular and TheMealDB ids are different
                               numbers for different dishes, so there's no equivalent id to try on
                               the other side. If a Spoonacular-sourced id fails while quota is
                               exhausted (e.g. an old favorite), the 404 says so explicitly rather
                               than implying the recipe doesn't exist
  random.ts                 — a random dish, optionally scoped to a cuisine: tries
                               spoonacularRandom, falls back to mealdbRandom, then the same
                               finalizeRecipe as recipe.ts. The frontend pre-fills RecipeDetail's
                               React Query cache with this response (useRandomRecipe.ts) and
                               navigates straight to /recipe/:source/:id, so there's no second
                               fetch or loading flash
  recommend-dish.ts         — the AI recommendation feature: calls OpenAI's Chat Completions API
                               with a search_recipes tool (query/area/category/mainIngredient,
                               mapped onto whichever provider actually answers) and a
                               recommend_dish tool that terminates the loop with {recipeId,
                               reasoning}; this keeps suggestions grounded in a real, fetchable
                               recipe instead of the model hallucinating a dish that doesn't exist
                               in either catalog. Tracks which provider returned each id in a
                               `Map` during the round loop so the final response can tag `source`
                               correctly. A system prompt asks the model to write `reasoning` in
                               Vietnamese when the request's language is 'vi'. `dietaryRestrictions`/
                               `dislikedIngredients` (from the user's saved Preferences, sent
                               automatically by Home -- see below) are framed as hard requirements
                               in the prompt, not soft hints, and can override a conflicting typed
                               ingredient (e.g. "chicken" on hand + a saved vegetarian restriction
                               steers the pick away from chicken). If the model stops calling tools
                               without ever calling recommend_dish but already has real candidates
                               from search_recipes, the handler pushes one more user turn telling
                               it to commit to one instead of failing outright -- verified live that
                               without this, a genuinely conflicting request (contradictory
                               ingredient + restriction) reliably exhausted the round budget with no
                               recommendation at all. Also never trusts a recipeId the model names
                               in recommend_dish unless it actually appeared in one of that
                               request's own search_recipes results (rejects and asks it to retry
                               otherwise) -- guards against sending the user to a recipe page for an
                               id that was never verified to exist
  translate.ts              — thin endpoint around _lib/translate.ts, used client-side only by
                               Favorites (translating saved titles, which come from Supabase, not a
                               fresh provider call)

supabase/migrations/        — SQL schema (profiles, preferences, favorites — all RLS-scoped to auth.uid(); favorites also has a source column, see above)
```

Recipe *content* is English-only in both providers; the Vietnamese translation
is a live OpenAI call per unique recipe/search (cached by React Query via the
`language` value in each hook's query key: `useRecipe`/`useSearchRecipes` in
`src/hooks/useRecipes.ts`), not static data — quality depends on the model and
costs a small amount of OpenAI usage per unique item viewed in Vietnamese mode.
When adding a new translatable field to a recipe response, add it to the
`texts` array built in `api/recipe.ts` (or `search.ts`) — don't add a
parallel client-side translation call, or fields will silently stay
untranslated the way ingredient units once did.

Frontend and `api/` functions share one origin once deployed (or under
`vercel dev` locally), so there's no CORS handling in `api/*.ts` — same-origin
`fetch('/api/...')` calls from `src/lib/api.ts` just work.

`OPENAI_API_KEY` and `SPOONACULAR_API_KEY` are `api/`-only and must never get
a `VITE_` prefix (Vite inlines any `VITE_*` var into the browser bundle).
`MEALDB_API_KEY` is optional too (defaults to `"1"`, TheMealDB's public key).
The image slideshow's Wikimedia Commons calls need no key/env var at all.
These live in the same `.env.local` locally, and in the same Vercel project's
Environment Variables in production, alongside `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` — only the `VITE_` ones get bundled client-side.

Full setup steps (creating the Supabase project, pushing the schema, running
locally with `vercel dev`, deploying) are in [README.md](README.md).
