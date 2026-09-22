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
   - **AI** (`source: 'ai'`): a third recipe source, toggled globally
     (`src/context/RecipeModeContext.tsx`, `localStorage`-persisted like
     `LanguageContext`) rather than per-request — when on, Suggest a dish /
     Random dish / Search all invent a recipe from scratch via OpenAI
     (`api/_lib/aiRecipe.ts`) instead of querying Spoonacular/TheMealDB, for
     when the two providers' combined catalog doesn't have what someone
     wants. Generated recipes are persisted to a Supabase table
     (`ai_recipes`) via a server-only admin client
     (`api/_lib/supabaseAdmin.ts`, `SUPABASE_SERVICE_ROLE_KEY`) so a
     generated recipe survives a refresh, can be favorited, and the app
     accumulates a real catalog of AI dishes over time instead of
     discarding every generation — see the `api/_lib/aiRecipe.ts` /
     `api/_lib/aiRecipeStore.ts` entries below for the full design.

   **Every recipe fetch/generation is capped at BOTH `DAILY_RECIPE_LIMIT`
   (5, per UTC day) AND `MONTHLY_RECIPE_LIMIT` (15, per UTC calendar month)
   per identity, for every non-admin caller, signed in or not -- regardless
   of catalog or AI mode.** Initially this only covered AI mode (which costs
   real OpenAI usage), but catalog mode isn't actually free either --
   Spoonacular's own free-tier quota is just as finite, and
   `api/recommend-dish.ts`'s catalog path *also* calls OpenAI (the
   tool-calling loop that grounds a pick in a real search result), so it was
   never truly AI-free to begin with. The monthly cap was added on top of
   the daily one specifically because 15/month is well under 5×30 -- a
   caller using their full daily allowance for just 3 days already exhausts
   the whole month, so the monthly limit is often the one that actually
   binds for an active user, not the daily one (the daily cap alone still
   matters for capping a single-day burst early in the month). One shared
   pair of counters covers Suggest a dish / Random dish / Search combined,
   either mode. See `api/_lib/recipeUsage.ts` / `api/_lib/auth.ts` below for
   how identity/role is resolved and both limits enforced, and
   `src/components/RecipeLimitModal.tsx`
   for the user-facing side.
2. **Supabase** (Postgres + Auth only, no Edge Functions) — accessed directly
   from the client via `supabase-js`, protected by Row Level Security (each
   user only sees their own `preferences`/`favorites`/`recipe_history` rows).
   `api/` also has its own server-only Supabase access
   (`api/_lib/supabaseAdmin.ts`, using the service role key, which bypasses
   RLS) for the `ai_recipes`/`recipe_usage` tables and the `profiles.role`
   lookup above — every other read/write still goes through the browser's
   own `supabase-js` client with the anon key and RLS.

**User roles** (`profiles.role`, `'user'` default / `'admin'`) gate the
daily/monthly recipe limits above and back an admin-only user management page
(`/admin`, `src/pages/AdminUsers.tsx`) where an admin can list every
signed-up user and change their role. **`role` can only ever be changed
through `api/admin-set-role.ts`** (which itself re-checks the caller is
admin server-side via `resolveCaller`, never trusting a client-side check
alone) -- a plain signed-in session has no ability to update that column at
all, enforced at the Postgres privilege level (not just RLS), see
`supabase/migrations/20260922*.sql`. That pair of migrations exists because
the *first* attempt at this lock (`revoke update (role) ... from
authenticated`) silently didn't work: `authenticated` already had a broad
table-level UPDATE grant from Supabase's default project setup, and a
column-level REVOKE cannot narrow a privilege granted at the table level --
confirmed live with a real self-escalation attempt
(`supabase.from('profiles').update({ role: 'admin' })` from an authenticated
session) that still succeeded after the first migration. The second
migration fixes it correctly: revoke the table-level UPDATE entirely, then
re-grant it only for `display_name`. Re-verified live afterward that the
same self-escalation attempt now fails while a legitimate `display_name`
update on your own row still works. **Any future column added to
`profiles` that only an admin/server process should write needs the same
table-level-revoke-then-column-level-regrant treatment** -- a bare
column-level REVOKE is not sufficient on its own once a table-level GRANT
already exists.

**Every recipe reference carries a `source: 'spoonacular' | 'mealdb' | 'ai'`
tag.** This is load-bearing, not decorative: all three sources use plain
numeric ids from separate id spaces (an AI recipe's id is just
`ai_recipes.id`), so the same number can mean three unrelated dishes.
`RecipeSummary`/`RecipeDetail` (`src/lib/api.ts`) both have `source`; the
route is `/recipe/:source/:id` (`src/App.tsx`); `favorites` has a `source`
column (`supabase/migrations/20260917010000_add_favorites_source.sql`, a
plain `text` column with no CHECK constraint, so `'ai'` needed zero schema
change there). Any new code that builds a recipe link or saves/looks up a
recipe must carry `source` through — an id alone is not a valid recipe
reference in this app. `api/recipe.ts` requires `source` explicitly rather
than guessing from the id, and never falls back to another source on
failure, because if Spoonacular is down and the id is a Spoonacular id,
neither TheMealDB nor `ai_recipes` can look it up at all (different id
space, not just a different name for the same dish).

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
  only as two of the 15 fixed `CATEGORIES`, alongside things like
  Beef/Dessert/Seafood) and no combined multi-filter search — TheMealDB's
  half of `api/recommend-dish.ts`'s `search_recipes` tool can only use one of
  query/area/category/mainIngredient per call. When Spoonacular answers
  instead, `mapCategoryToSpoonacular` in `api/recommend-dish.ts` translates
  TheMealDB's category vocabulary onto Spoonacular's `diet`/`type`/
  `includeIngredients` params as a best-effort mapping (e.g. "Vegetarian" →
  `diet=vegetarian`, "Beef" → `includeIngredients=beef`) — the tool's
  LLM-facing schema never changes, only which provider and params answer it.
- `CATEGORIES` includes "Beverage", which — like the Spoonacular-only
  cuisines above — is Spoonacular-only: TheMealDB's Meal database has zero
  drink recipes of any kind (verified live: `filter.php?c=Drink`/`Beverage`/
  `Cocktail` all return 0 meals; drinks are a wholly separate database,
  TheCocktailDB, not used here). Confirmed live against Spoonacular's docs
  and a real `complexSearch` call that `type=beverage` (and the synonym
  `type=drink`) returns real results (204 total). `mapCategoryToSpoonacular`
  maps "Beverage" to `{ type: 'beverage' }` explicitly — it must not fall
  into the generic `includeIngredients` catch-all used for
  Beef/Chicken/Goat/Lamb/Pork/Seafood/Pasta/Miscellaneous, since "beverage"
  isn't an ingredient and that would return nonsense results.
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
src/lib/api.ts              — thin wrappers calling api/*.ts via plain fetch('/api/...'); defines RecipeSource.
                               invoke() attaches the caller's current Supabase session as a Bearer
                               token on every request (api/_lib/auth.ts reads it, for the daily
                               recipe limit) and throws ApiError (not a plain Error) on a non-ok
                               response, carrying the raw backend `error` string as `.code` --
                               isRecipeLimitError(err) checks that code for 'recipe_limit_exceeded'
                               so a caller can show RecipeLimitModal.tsx instead of an inline error string
src/lib/cuisines.ts         — CUISINES (verified TheMealDB areas) / CATEGORIES (TheMealDB's fixed category list) + VI label maps + findMatchingOption (case-insensitive match of free-text saved preferences against one of these lists), used by Search's filter and Home's form.
                               MEAL_TIMES (Breakfast/Lunch/Dinner) is a separate, simpler axis added
                               alongside CATEGORIES on Home's Suggest-a-dish form only (not Random
                               dish or Search) -- unlike CATEGORIES/CUISINES, it's NOT mapped onto a
                               provider filter param in api/recommend-dish.ts's searchRecipes/
                               mapCategoryToSpoonacular: neither Spoonacular's `type` enum nor
                               TheMealDB's category list has a real "lunch"/"dinner" value (Spoonacular
                               has "breakfast" but nothing for the other two), so forcing one onto a
                               fake category would either silently no-op or return wrong results.
                               Instead it's sent as a plain prompt hint (both to the tool-calling
                               loop's reasoning and to _lib/aiRecipe.ts's generation prompt), leaving
                               it to the model's own judgment what "a lunch dish" means in context
                               (lighter/quicker) vs. dinner (heartier) or breakfast (egg/pancake-style)
src/lib/support.ts          — SUPPORT_EMAIL, the single source of truth for the contact address shown (via src/components/ContactSupportLine.tsx) in RecipeUsageBanner.tsx and RecipeLimitModal.tsx
src/hooks/                  — React Query hooks per concern (useRecipes, useFavorites, usePreferences, useRecommendDish); useTranslatedTexts is only for Favorites' saved titles.
                               useIsAdmin reads profiles.role directly via the anon-key client (the
                               existing "view own profile" RLS policy already permits exactly this --
                               no dedicated endpoint needed just to answer "am I admin"), used to
                               show/hide the Admin nav link and gate AdminRoute.tsx. useAdminUsers/
                               useSetUserRole wrap admin-users.ts/admin-set-role.ts for the /admin page
                               -- listing/changing OTHER users' roles does need those admin-only
                               endpoints, since RLS only ever lets a user see their own row
src/context/AuthContext.tsx — wraps the Supabase auth session, exposed via useAuth()
src/context/LanguageContext.tsx — EN/VI toggle state (persisted to localStorage), exposes t(key) for static UI strings
src/context/RecipeModeContext.tsx — 'catalog'/'ai' toggle state (persisted to localStorage), mirrors LanguageContext exactly. Home/Search read useRecipeMode() and pass `useAi: mode === 'ai'` through to the relevant api/lib/api.ts calls
src/i18n/translations.ts    — { key: { en, vi } } dictionary for static UI text (nav, labels, buttons, errors)
src/components/Layout.tsx        — nav shell (React Router <Outlet />) + language toggle button + recipe-source (catalog/AI) toggle button, same sliding-segmented-pill style in the mobile drawer for both.
                                    Renders <RecipeUsageBanner /> right below the header, on every page
src/components/RecipeUsageBanner.tsx — a full-width strip below the header (not tucked into the toggle
                                    itself, so it's hard to miss on any page) showing a non-admin
                                    caller their remaining daily AND monthly recipe quota
                                    (useRecipeUsage) plus a <ContactSupportLine />. Shown regardless of
                                    catalog/AI mode -- both cost real resources, see the "recipe
                                    fetch/generation" limit note near the top of this file -- for a
                                    caller api/recipe-usage.ts reports isAdmin: false for; null
                                    otherwise, so it collapses to nothing for the admin account
src/components/ContactSupportLine.tsx — renders usage.contactMessage ("Contact {email} for more
                                    support.") with SUPPORT_EMAIL (src/lib/support.ts) as a real
                                    mailto: link in place of its `{email}` placeholder -- split the
                                    translated string on that placeholder rather than appending the
                                    link after a separate lead-in phrase, so the email reads inline,
                                    mid-sentence, in both languages. `linkClassName` lets each caller
                                    match its own surrounding colors (amber for the banner, teal for
                                    the modal) without duplicating the split logic. Shared by
                                    RecipeUsageBanner.tsx and RecipeLimitModal.tsx
src/components/ProtectedRoute.tsx — redirects to /login if unauthenticated
src/components/AdminRoute.tsx — like ProtectedRoute, but also requires useIsAdmin() to be true,
                                    redirecting a signed-in non-admin to / instead of exposing the
                                    /admin page's UI at all (the underlying data is admin-gated
                                    server-side regardless via admin-users.ts/admin-set-role.ts -- this
                                    is just for not showing a page someone can't use, not the real
                                    security boundary)
src/components/RecipeLimitModal.tsx — shown by Home.tsx (Suggest a dish + Random dish) and Search.tsx
                                    when api.ts's isRecipeLimitError(err) is true, instead of the usual
                                    inline error text -- a plain "request failed" string would read as
                                    broken to a non-admin caller, when this is an intentional daily +
                                    monthly cost-control limit (see _lib/recipeUsage.ts) that simply
                                    resets on its own. Calls useRecipeUsage() itself (doesn't take the
                                    exceeded numbers as a prop) -- the blocked request already recorded
                                    its attempt server-side (recordAndCheckRecipeUsage increments
                                    before checking), so refetching here shows the caller's true current
                                    daily/monthly standing directly; useRandomRecipe.ts/
                                    useRecommendDish.ts/Search.tsx all invalidate RECIPE_USAGE_QUERY_KEY
                                    on error too (not just success) so this refetch isn't stale.
                                    Whichever of daily/monthly is at 0 in the message is self-evidently
                                    the one that was hit -- no separate "which limit" flag threaded
                                    through. Was named AiLimitModal.tsx and said "switch to API mode" as
                                    a workaround until catalog mode was also brought under the same
                                    limit -- see the note near the top of this file. Also renders
                                    <ContactSupportLine />, same as RecipeUsageBanner.tsx, for someone
                                    who specifically wants a higher limit
src/components/RandomRevealModal.tsx — the "Feeling lucky?" pack-opening reveal. Its photo circle
                                        reads `recipe.image || recipe.images[0] || '/logo.png'`, not
                                        `recipe.image` alone -- `image` (the provider's own "real
                                        photo") is always `''` for AI-generated recipes (finalizeRecipe
                                        only ever fills `images`, the stock-photo array, for those), so
                                        the circle silently stayed empty for every AI-mode random dish
                                        before this fallback (confirmed live via a raw /api/random
                                        response with useAi: true). The final `/logo.png` fallback
                                        covers the rarer case where even `images` comes back empty (an
                                        obscure or invented dish with no Wikimedia coverage at all) --
                                        without it the circle still had nothing to show. Same gap RecipeDetail.tsx's ImageCarousel
                                        already accounts for via its carouselImages/carouselStockFrom
                                        logic. useFavorites.ts's useAddFavorite had the identical bug
                                        (image_url: recipe.image, saved as '' for an AI recipe favorited
                                        from RecipeDetail.tsx) -- fixed the same way, falling back to
                                        recipe.images?.[0]. Search.tsx's plain recipe.image read is NOT
                                        this bug: search results are RecipeSummary (image only, no
                                        images array), and api/search.ts's AI branch already populates
                                        that singular field itself via searchDishImages
src/pages/                  — one file per route, wired up in src/App.tsx (recipe route is /recipe/:source/:id).
                               AdminUsers.tsx (admin-only, /admin, gated by AdminRoute.tsx) lists every
                               user (useAdminUsers) with a per-row toggle button to grant/revoke admin
                               (useSetUserRole) -- the current user's own row shows a static "(you)"
                               label instead of a button (mirroring admin-set-role.ts's server-side
                               self-demotion guard in the UI, so that path is never even attempted).
                               A native window.confirm() gates each toggle, since granting admin means
                               unlimited AI usage AND the ability to manage other users' roles.
                               History.tsx (signed-in only, /history) mirrors Favorites.tsx but reads
                               from recipe_history instead -- RecipeDetail.tsx records/bumps a view via
                               useRecordRecipeView (upsert on user_id+source+recipe_id, keyed off the
                               primitive recipe.id/source, not the recipe object itself, so switching
                               display language -- which re-fetches a re-translated recipe with a new
                               object reference but the same id/source -- doesn't re-record the view).
                               Capped server-side at 10 rows per user (see the migrations entry below),
                               so the client never needs its own pruning logic. Its thumbnail falls
                               back to `/logo.png` when `image_url` is '' -- same gap as
                               RandomRevealModal.tsx above, since the stored value comes from the same
                               `recipe.image || recipe.images?.[0] || ''` chain (useRecipeHistory.ts).
                               Favorites.tsx has the identical `favorite.image_url` gap and hasn't been
                               fixed the same way -- not reported yet.
                               Home.tsx's RandomDish cuisine picker remembers the user's last choice in
                               sessionStorage (RANDOM_CUISINE_KEY), not just component state -- without
                               this, picking a cuisine, viewing the result (navigating to /recipe/...,
                               a sibling route, so Home/RandomDish fully unmounts), then coming back
                               reset local state to '' and the account-preference-autofill effect
                               immediately refilled it from the saved cuisine_preferences default (e.g.
                               "Vietnamese"), silently discarding whatever the user had picked. From the
                               user's side this looked exactly like Random being "stuck"/"cached" on one
                               country no matter what was chosen afterward -- confirmed as the cause of
                               that report. The stored value is checked with `!== null`, not a truthy
                               check, so an explicit "Any" pick (stored as '') is also remembered and
                               not re-clobbered by the same effect on the next remount. Search.tsx's
                               cuisine filter (line ~27) has the identical autofill-from-preference
                               pattern and is exposed to the same unmount/remount trigger (clicking a
                               result navigates away too) -- not fixed here since it wasn't reported,
                               but the same sessionStorage approach would apply if it ever is
                               Home and Search both pre-fill their Cuisine dropdown from the signed-in
                               user's saved Preferences (findMatchingOption in cuisines.ts) on first
                               load only -- a later manual change to the dropdown is never overwritten,
                               since the effect only sets state when the field is still empty.
                               RecipeDetail.tsx's instructions list renders each step as its own
                               bordered card (a numbered circle badge + the step text), not a plain
                               `<ol className="list-inside list-decimal">` -- reported that on mobile
                               the steps visually ran together into one undifferentiated block.
                               Root cause: `list-inside` has no hanging indent, so once a step's text
                               wraps to a second line (routine on a narrow mobile viewport, rare on
                               desktop -- exactly why this was a mobile-specific complaint), that
                               continuation line starts flush left, at the same indent as the NEXT
                               step's number marker, erasing the visual boundary between steps. The
                               per-step card (border + background + explicit gap) makes each step's
                               boundary immune to text wrapping regardless of viewport width, rather
                               than depending on list-marker indentation behaving correctly. The
                               `<ol>`/`<li>` wrapper is kept (not swapped for plain `<div>`s) so
                               screen readers still get real ordered-list semantics; the numbered
                               badge is `aria-hidden` to avoid announcing the position twice.
                               parseInstructionSteps itself (same file) was NOT the bug here --
                               checked live against 5 real Spoonacular recipes, all split into 5-11
                               steps correctly via its existing marker/blank-line/newline fallback chain

api/
  _lib/translate.ts         — translateToVietnamese/translateToEnglish: shared OpenAI batch-
                               translation helpers, provider-agnostic. Validates that the model's
                               `translations` array is exactly the same length as the input `texts`
                               array before returning it -- every caller assigns translations[i]
                               back to the i-th input by position, so a wrong-length response would
                               otherwise silently shift every entry after the discrepancy onto the
                               wrong field. On a mismatch, returns the original `texts` unchanged
                               (untranslated) rather than risk serving misaligned, meaningless text.
                               The shared prompt also explicitly requires preserving the input's
                               line-break positions one-for-one in the output -- without this,
                               translating a multi-line numbered instructions list (e.g. "1. ...\n2.
                               ...") reliably collapsed it into one continuous run-on paragraph with
                               inline "... phút. 4. Trong khi ..." markers and no real newlines at
                               all, confirmed live from a real report where every step then rendered
                               as a single undifferentiated block in RecipeDetail.tsx (parsed nothing
                               to split on). Re-verified live after the prompt fix: a 4-line English
                               input translated back to exactly 4 lines. RecipeDetail.tsx's
                               parseInstructionSteps also gained a last-resort inline-marker fallback
                               split (splits on a digit marker immediately following ". "/"! "/"? ")
                               as a safety net for whenever the prompt instruction doesn't hold --
                               this is a prompt instruction, not a guarantee, so both fixes stay in
                               place together.
                               translateIngredientPhrases shares the same underlying call/validation
                               logic (callTranslationModel) but with a different, specialized system
                               prompt used for ALL ingredient name/measure text the glossary doesn't
                               cover (both standalone names and a combined "quantity/descriptor +
                               name" line -- see glossary.ts/finalize.ts below), for two confirmed-
                               live reasons the generic prompt gets wrong: (1) word order -- it
                               preserves English ordering literally ("For serving lettuce" -> "Để
                               phục vụ xà lách", annotation before the noun -- valid words, backwards
                               ingredient-list phrasing); the specialized prompt produces "Xà lách ăn
                               kèm" instead. (2) completeness -- for less common culinary terms, it
                               sometimes leaves part of the term as an untranslated English loanword
                               or produces the wrong word entirely ("seltzer water" -> "nước
                               seltzer", only "water" translated; "strawberry puree" -> "syrup dâu
                               tây", wrong word, still English); the specialized prompt explicitly
                               requires translating every word and produces "nước có ga" / "dâu tây
                               xay nhuyễn" instead. (3) unit preference -- some US recipes measure a
                               solid ingredient by length instead of weight ("1 inch fresh ginger",
                               "2 inch cinnamon stick"). Confirmed live that Spoonacular has no gram
                               equivalent for these either (even its own metric conversion leaves
                               "inch" as "inch", since length-to-weight isn't a fixed factor -- it
                               depends on the specific piece's thickness/density), so per explicit
                               request this prompt has the model estimate a reasonable gram weight
                               instead, prefixed with "khoảng" (approximately) since it's an estimate
                               rather than an exact conversion ("1 inch fresh ginger" -> "khoảng 10g
                               gừng tươi"). Only applies to length units (inch, cm); measures already
                               in weight/volume units are left alone
  _lib/glossary.ts          — translateIngredientName/translateMeasure: a static lookup table for
                               units (cup, tbsp, gram, ...) and common ingredient names (chicken,
                               garlic, fish sauce, ...). These have exactly one correct Vietnamese
                               term each, so asking the AI translator for them was a source of
                               inconsistent/wrong wording; the glossary is checked first in
                               finalize.ts and only unmatched names/measures fall through to
                               translateIngredientPhrases. Returns null (not a guess) on anything not in
                               the table, including compound measures like "1 (10 oz) can"
  _lib/mealdb.ts            — mealdbSearch/mealdbRecipe/mealdbRandom: TheMealDB fetch +
                               normalization to the shared RecipeSummary/RecipeDetail shape
                               (source: 'mealdb'). mealdbRandom composes random.php (no cuisine
                               filter exists) with the existing area-filter search + a random pick
                               when a cuisine is requested. strArea/strCategory can themselves be
                               null even on an otherwise-complete TheMealDB recipe (confirmed live,
                               id 53496 has no area) -- mapMealDbRecipe falls back to
                               'International'/'Uncategorized', same as spoonacularRecipe below and
                               for the same reason (a blank badge reads as broken, not "not
                               applicable", and the fallback still localizes via finalizeRecipe)
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
                               _lib/images.ts stock photos, fills in a video guide via
                               _lib/youtube.ts (only when the recipe has no native one already --
                               see below), and translates to Vietnamese when requested.
                               The resolved videoUrls are checked against/written to
                               _lib/videoCache.ts (keyed by source+id) BEFORE any YouTube search
                               happens -- without this, every view re-ran the search from scratch,
                               and YouTube's search.list ranking isn't guaranteed stable across
                               separate calls, so the same recipe could show a different "best match"
                               video on a later visit (confirmed as the cause of a "different video
                               every time I reopen this recipe" report; verified live afterward: two
                               fetches of the same recipe now return byte-identical videoUrls, and
                               the second fetch makes zero YouTube API calls). A cached *empty* array
                               is a valid, meaningful result too (no good video was found last time)
                               -- distinguished from "never resolved" (null) so a genuinely
                               video-less recipe also stops being re-searched on every view. title/
                               category/area, instructions, and the ingredients batch are three
                               separate translateToVietnamese calls (not one combined ~20-30-item
                               batch) so each is smaller and less likely to come back malformed,
                               and so a bad response in one doesn't also revert the others.
                               instructions specifically gets its own single-item call rather than
                               riding along with title/category/area -- confirmed live that bundled
                               together, the model sometimes splits the long, multi-paragraph
                               instructions text into several array entries instead of translating
                               it as one string (observed: a 4-item input came back with 12 items),
                               likely mistaking its internal line breaks for separate array items to
                               expand. A lone 1-item array leaves it nothing to conflate that with.
                               _lib/translate.ts also now validates the response array length
                               against the input and falls back to the original English text on any
                               mismatch, as a second line of defense.
                               Per ingredient, which translation path is used depends on whether the
                               measure is a recognized real unit (glossaryMeasures[i] !== null):
                               if so, the measure is used as-is and only the name (if not itself a
                               glossary hit) is translated independently -- this is safe because a
                               countable unit like "cup" reads naturally before the noun in
                               Vietnamese too, same word order as English ("3 chén" + "gạo lứt").
                               If the measure ISN'T a recognized unit, it's usually a bare size or
                               purpose descriptor instead ("1 small", "2 large", "For serving") with
                               no unit word -- in that case the whole "measure name" phrase is sent
                               to translateIngredientPhrases (_lib/translate.ts) together as one
                               string, not measure and name independently, and the result is stored
                               entirely in `name` with `measure` set to ''. This exists because
                               translating a bare descriptor in isolation and gluing it in front of
                               an independently-translated name produces backwards Vietnamese
                               grammar -- confirmed live that "1 small" + "chili pepper" came out as
                               "1 nhỏ Ớt trái" (adjective before the noun, meaningless word order)
                               under the old always-independent approach. Combining the phrase into
                               one generic translateToVietnamese call was a necessary but
                               insufficient fix: it correctly produced "1 ớt nhỏ" for the size-
                               descriptor case, but for a purpose-annotation case ("For serving
                               lettuce") it still preserved English order ("Để phục vụ xà lách",
                               annotation before the noun) since the generic prompt has no notion of
                               ingredient-list conventions. translateIngredientPhrases's dedicated
                               prompt (explicitly asking for noun-first Vietnamese phrasing) fixes
                               this too, confirmed live: "Xà lách ăn kèm" instead.
                               The two AI-bound arrays (namesToTranslate for the independent path,
                               combinedTexts for the whole-phrase path) must each stay a single pass
                               in ingredient order, not interleaved with each other or split across
                               calls in a way that breaks positional alignment -- interleaving
                               name/measure per ingredient in an earlier version of this code caused
                               a real, separately-reproduced bug where every ingredient after one
                               needing both fields translated silently paired with the wrong
                               measure/name. Used by both recipe.ts and random.ts so this logic
                               exists in exactly one place
  _lib/vietnameseDishName.ts — resolveVietnameseDishName: an OpenAI call that identifies a dish's
                               actual, commonly-used Vietnamese name (e.g. "Bún chả") for use as a
                               YouTube search query, given the recipe's English title + ingredient
                               names. Distinct from a plain translateToVietnamese call on the title,
                               which produces a faithful but literal translation -- confirmed live
                               this differs meaningfully for dishes with a specific traditional
                               compound name: "Vietnamese Grilled Pork with Vermicelli Noodles"
                               translates literally to "Thịt Nướng Việt Nam với Bún", a phrase no
                               real Vietnamese video would be titled with, instead of "Bún chả"/"Bún
                               thịt nướng". Returns null (not the English title) on a missing
                               OPENAI_API_KEY or any failure, so finalize.ts can fall back to the
                               plain-translation query instead
  _lib/youtube.ts           — searchYoutubeVideo: an optional video guide via YouTube Data API
                               v3's search.list. For non-Vietnamese cuisines, only called when a
                               recipe has no video link already (TheMealDB's own strYoutube is used
                               directly in _lib/mealdb.ts) -- so this is spent only on Spoonacular
                               recipes, which have no video data of any kind (checked live: their
                               /recipes/{id}/information response has no video/youtube field at
                               all). Returns null on a missing YOUTUBE_API_KEY or any failure, same
                               contract as the other provider helpers -- RecipeDetail simply shows
                               no video section rather than erroring. search.list has its own
                               separate daily quota bucket (confirmed live against Google's quota
                               docs): 100 calls/day, apart from the 10,000-unit pool shared by every
                               other YouTube endpoint.
                               Requests 5 candidates (maxResults=5) instead of 1 -- free, since
                               search.list's quota cost is 1 unit per call regardless of
                               maxResults -- and picks whichever title actually shares significant
                               words with the dish name via bestMatchIndex, rather than trusting
                               YouTube's top relevance result unconditionally. Reported live that the
                               top result is sometimes a plausible-looking but off-topic video
                               (relevance ranking also weighs channel authority/popularity, not just
                               title match) -- confirmed with a real search for "Fall Classic: Carrot
                               Cake": the unfiltered top result was a gimmicky "The Queen of England's
                               Famous Carrot Cake" video, while bestMatchIndex correctly picked "The
                               best fall carrot cake recipe" instead, which shares more of the dish's
                               actual words. TITLE_STOPWORDS excludes generic words that appear in
                               nearly every cooking-video title regardless of dish ("recipe", "how to
                               make", "cách nấu", ...) so the overlap score reflects genuine dish-name
                               matches; ties keep YouTube's own relevance order (first-scored-highest
                               wins), and a dish name/candidates with zero overlap fall back to the
                               first (YouTube's top) result rather than an arbitrary pick.
                               `language: 'vi'` biases toward an actually Vietnamese video (a
                               Vietnamese query string plus relevanceLanguage/regionCode params) --
                               finalize.ts passes this whenever recipe.area is "Vietnamese" (checked
                               before that field is overwritten by display-language translation, so
                               it applies regardless of the page's own display language), after
                               resolving the actual query text first via
                               _lib/vietnameseDishName.ts's resolveVietnameseDishName (falling back
                               to a plain translateToVietnamese call on the title if that fails --
                               see below). For a Vietnamese cuisine specifically, finalize.ts calls
                               this search EVEN when a native video already exists, and shows BOTH
                               (deduped by video id via dedupeVideoUrls, in case the search happens
                               to return the exact same video) rather than one replacing the other --
                               per explicit request, since a native link isn't guaranteed to actually
                               be in Vietnamese (confirmed live: recipe 53232, "Vietnamese chicken
                               salad", linked an English-language RecipeTin Eats video) and a native
                               video plus a freshly-searched Vietnamese one are often different,
                               both-useful takes on the same dish (confirmed live: the search added a
                               real "Gỏi gà rau răm" video from a Vietnamese channel alongside the
                               existing English one). A plain English title search for a Vietnamese
                               dish reliably returns mostly Western-channel English videos, while a
                               Vietnamese-language query reliably surfaces real Vietnamese channels.
                               If the query-resolution call fails (translate.ts's safety net returns
                               the input unchanged), finalize.ts detects the no-op and falls through
                               to a plain English search rather than sending an English query with
                               Vietnamese bias params, which would just return worse results for no
                               reason. For every other cuisine, this search is only attempted when
                               there's no native video at all (RecipeDetail.videoUrls stays a single-
                               entry array in that case), since there's nothing to usefully show
                               alongside and no reason to spend the shared search.list quota.
                               The resolved dish name is computed ONCE (a `vietnameseDishName`
                               variable in finalize.ts, not recomputed separately per use) and reused
                               for the displayed/translated title too, not just this video query --
                               originally it was only wired into the video query, and the title
                               translation below still went through the generic word-for-word
                               translateToVietnamese, which reintroduced the exact backwards-grammar
                               problem this whole mechanism exists to avoid (confirmed live: "Vietnamese
                               Lemongrass Chicken Stir-Fry" displayed as "Món Xào Gà Sả Việt Nam"
                               instead of "Gà Xào Sả"). Fixed by using vietnameseDishName as
                               recipe.title directly (falling back to the generic translation only
                               when dish-name resolution itself failed) instead of always using the
                               generic translation's own result for the title
  _lib/videoCache.ts        — getCachedVideoUrls/setCachedVideoUrls: persists finalize.ts's final
                               resolved videoUrls per (source, recipe_id) in the recipe_video_cache
                               table, so a repeat view of the same recipe reuses it instead of
                               re-running the YouTube search above -- YouTube's search.list ranking
                               isn't guaranteed stable across separate calls, so without this the same
                               recipe could show a different "best match" video on a later visit
                               (confirmed as a real report, and confirmed fixed live: two fetches of
                               the same recipe now return identical videoUrls, with zero YouTube API
                               calls on the second). getCachedVideoUrls returns null for "never
                               resolved" specifically so a legitimately empty result (no good video
                               found) can still be cached and distinguished from that -- an empty
                               array is a valid, meaningful cached value, not a miss. Fails
                               silently/returns null on any Supabase error, same "never worth failing
                               the request over" philosophy as every other best-effort helper here
  _lib/images.ts            — searchDishImages: extra stock photos for RecipeDetail's slideshow,
                               sourced from Wikimedia Commons (no API key needed at all). Neither
                               recipe provider has more than one real photo per dish, so this is a
                               purely cosmetic enhancement (never throws, returns [] on any
                               failure) -- results are NOT guaranteed to be the exact dish, and for
                               obscure/invented-sounding recipe titles often come back empty, which
                               is the correct, honest outcome (better than an unrelated result). A
                               `filetype:bitmap` search filter excludes non-photo files (PDF scans,
                               diagrams) that would otherwise sometimes match on stray title words.
                               The exact-phrase `"..."` wrapping (CirrusSearch) is necessary but NOT
                               sufficient on its own -- it still matches text anywhere on a file's
                               page (categories, descriptions), not just the file's own title, so a
                               page can match without the file actually depicting the dish. Confirmed
                               live and reported by a user ("in AI mode the image most of the time
                               doesn't match"): searching the simplified term "sausage and peppers"
                               (for an AI-invented "Italian Sausage and Peppers Skillet" recipe)
                               returned two genuinely on-topic photos alongside an unrelated "Spanish
                               Paella" photo and three "Feast of San Gennaro" street-festival crowd
                               photos. Fixed by over-fetching candidates (`count * 4`, capped at 40 --
                               free, Commons has no per-call quota unlike YouTube) and filtering to
                               only those whose OWN title/filename shares at least half its
                               significant words with the query (textRelevance.ts's
                               significantWords, shared with youtube.ts's bestMatchIndex -- same
                               underlying question, applied as "keep everything good enough" here vs.
                               "pick the single best" there), before slicing to `count`. Re-verified
                               live afterward: the paella/festival photos are gone from the sausage
                               case, and previously-good cases (lemongrass chicken, arroz al horno,
                               pot roast) are unaffected, still returning their full 6 results
  _lib/textRelevance.ts     — significantWords: lowercases, splits on non-letter/digit boundaries,
                               and strips TITLE_STOPWORDS (generic words like "the"/"with"/"recipe"/
                               Vietnamese equivalents that would otherwise inflate every candidate's
                               overlap score regardless of the actual dish). Extracted from youtube.ts
                               so images.ts's relevance filter (see above) could reuse the exact same
                               word-overlap logic instead of duplicating the stopword list
  _lib/simplifyDishName.ts  — simplifyDishNameForImageSearch: an OpenAI call that strips a title
                               down to the simplest generic common name for that type of dish (e.g.
                               "Vietnamese Lemongrass Chicken Stir-Fry" -> "lemongrass chicken"),
                               used as a searchDishImages fallback specifically for AI-generated
                               recipes (finalize.ts, and api/search.ts's AI-mode thumbnails) when the
                               literal title search comes up empty. AI-invented titles essentially
                               never match Commons' exact-phrase search verbatim -- confirmed live:
                               0 results for the exact invented title above vs. 10 real, relevant
                               photos for the simplified term. Only spends the extra call when the
                               plain search already failed, and only for source: 'ai' (provider
                               titles are real menu/recipe names already reasonably likely to match
                               on their own). Still returns [] like normal when even the simplified
                               term has no real Wikimedia coverage (confirmed live for some modern
                               fusion "bowl" dishes) -- honest silence over a wrong-dish photo,
                               same principle as images.ts itself
  search.ts                 — query -> search.php?s= / complexSearch?query=, else cuisine ->
                               filter.php?a= / complexSearch?cuisine= (query wins if both are set,
                               matching TheMealDB's more limited API; Spoonacular natively supports
                               both together, that combined-filter capability is the main reason
                               Spoonacular is tried first); translates the query EN->VI first and
                               result titles back after, regardless of which provider answered.
                               Checks/records the daily recipe limit (_lib/recipeUsage.ts) up front,
                               before either the AI or catalog path -- AI mode counts
                               AI_SEARCH_RESULT_COUNT, catalog mode counts 1 per search regardless of
                               how many existing results it returns.
                               `useAi: true` skips both providers entirely: _lib/aiRecipe.ts's
                               generateAiRecipes invents AI_SEARCH_RESULT_COUNT (6) meaningfully
                               different dishes in one call, each persisted via saveAiRecipe and
                               given a best-effort searchDishImages thumbnail immediately (the one
                               place AI mode is pricier than the provider path -- N generations plus
                               N image lookups per search, vs. one provider request)
  recipe.ts                 — requires an explicit `source` in the request body (now
                               'spoonacular' | 'mealdb' | 'ai'), calls that source's lookup directly
                               (getAiRecipe from _lib/aiRecipeStore.ts for 'ai'), then
                               _lib/finalize.ts's finalizeRecipe for photos + translation.
                               Deliberately does NOT fall back to another source on failure (unlike
                               search.ts/random.ts/recommend-dish.ts) -- every source uses a
                               different id space, so there's no equivalent id to try elsewhere. If
                               a Spoonacular-sourced id fails while quota is exhausted (e.g. an old
                               favorite), the 404 says so explicitly rather than implying the recipe
                               doesn't exist
  random.ts                 — a random dish, optionally scoped to a cuisine: tries
                               spoonacularRandom, falls back to mealdbRandom, then the same
                               finalizeRecipe as recipe.ts. Checks/records the daily recipe limit
                               (_lib/recipeUsage.ts) up front, regardless of catalog/AI mode -- 1 per
                               call either way. The frontend pre-fills RecipeDetail's
                               React Query cache with this response (useRandomRecipe.ts) and
                               navigates straight to /recipe/:source/:id, so there's no second
                               fetch or loading flash. `useAi: true` calls _lib/aiRecipe.ts's
                               generateAiRecipe instead (skipping both providers), persists the
                               result via saveAiRecipe, and runs it through the same finalizeRecipe
                               call -- everything downstream (translation, image/video search,
                               React Query cache pre-fill) is identical regardless of source.
                               Before generating, fetches getRecentAiRecipeTitles from
                               _lib/aiRecipeStore.ts (15 most recent, filtered to the same cuisine
                               when one is set) and passes them as generateAiRecipe's `avoidTitles`
                               -- each generation call is a stateless OpenAI request with no memory
                               of any other, so without this, repeated Random taps for the same
                               (or no) cuisine reliably converge on the same "obvious" dish
                               (confirmed live: 6 independent calls for cuisine "Vietnamese" with no
                               avoidTitles produced "lemongrass chicken" in 5 of 6; after the fix,
                               6 calls produced 6 distinct dishes). Only applied in random.ts, per
                               explicit request -- search.ts's generateAiRecipes already gets
                               variety within one call for free (all N dishes generated together,
                               see below) and recommend-dish.ts is grounded by the user's own
                               ingredients/mood/constraints rather than a bare cuisine, so it's far
                               less prone to this kind of clustering
  recommend-dish.ts         — the AI recommendation feature. Checks/records the daily recipe limit
                               (_lib/recipeUsage.ts) up front, regardless of catalog/AI mode -- the
                               non-AI path below calls OpenAI too (the tool-calling loop), so it was
                               never actually free of AI cost to begin with, on top of Spoonacular's
                               own quota. `mealTime` (Breakfast/Lunch/Dinner, from Home's Suggest-a-dish
                               form) is appended to the catalog-mode userPrompt as a plain reasoning
                               hint, not a search_recipes filter arg -- see src/lib/cuisines.ts's
                               MEAL_TIMES entry above for why. `useAi: true` takes a completely
                               different, much simpler path: one _lib/aiRecipe.ts generateAiRecipe
                               call (which also returns its own `reasoning`), persisted via
                               saveAiRecipe, returned as {recipeId, reasoning, title, source: 'ai'}
                               -- skips the tool-calling loop below entirely, since grounding a pick
                               in a real search result (the loop's whole purpose) is the opposite of
                               what AI mode is for. Everything from here down describes the
                               non-AI-mode path: calls OpenAI's Chat Completions API
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
  _lib/expandInstructions.ts — expandInstructions: rewrites a recipe's instructions into a more
                               detailed step-by-step guide via OpenAI, grounded in the recipe's own
                               title/ingredients/instructions so it elaborates on the real recipe
                               instead of inventing a different one (explicitly told to fall back to
                               a plausible standard method, not exotic/fabricated steps, when the
                               original instructions are empty or too sparse to elaborate on).
                               On-demand only (a button on RecipeDetail, not run automatically on
                               every recipe view) since it's an extra OpenAI call with no benefit
                               for recipes whose instructions are already good
  expand-instructions.ts    — thin endpoint around _lib/expandInstructions.ts
  _lib/supabaseAdmin.ts     — supabaseAdmin: a server-only Supabase client using
                               SUPABASE_SERVICE_ROLE_KEY (bypasses RLS entirely -- never expose this
                               key to the browser, no VITE_ prefix, ever). null when the key isn't
                               configured, so callers fail with a clear "not configured" error
                               instead of crashing. Everywhere else that isn't about AI-mode data or
                               the daily limit below (preferences, favorites, recipe_history) the
                               browser talks to Supabase directly via src/lib/supabaseClient.ts's
                               anon-key client. Passes `realtime: { transport: ws }` (the `ws` package, added as a
                               direct dependency) to createClient -- confirmed live this is required
                               on Node 20 (the Vercel function runtime used by `vercel dev` locally
                               and in production), even though this app never uses Realtime:
                               createClient() throws immediately at construction ("Node.js 20
                               detected without native WebSocket support") otherwise, since it sets
                               up a Realtime client unconditionally. The `ws as never` cast there
                               works around a real type mismatch between @types/ws and
                               supabase-js's WebSocketLikeConstructor, not a runtime issue
  _lib/auth.ts              — resolveCaller(req): who's calling an api/*.ts endpoint, for the daily
                               AI-generation limit below. src/lib/api.ts's invoke() attaches the
                               caller's current Supabase session (if any) as a Bearer token on every
                               request; resolveCaller verifies it via supabaseAdmin.auth.getUser and
                               looks up profiles.role for that user id, returning
                               `{ identity: 'user:<uuid>', isAdmin: role === 'admin' }`. No/invalid
                               token falls back to `{ identity: 'ip:<address>', isAdmin: false }` --
                               a serverless function has no other durable identity for a logged-out
                               visitor (imprecise for shared IPs, an accepted tradeoff for a
                               cost-control limit with no account to key off of)
  _lib/recipeUsage.ts       — DAILY_RECIPE_LIMIT (5) / MONTHLY_RECIPE_LIMIT (15) /
                               recordAndCheckRecipeUsage(identity, count?): the limits themselves,
                               applying regardless of catalog/AI mode (originally AI-only and
                               daily-only; see the note near the top of this file for why it was
                               widened and renamed from aiUsage.ts/ai_usage/DAILY_AI_LIMIT -- "AI
                               usage" would be actively misleading once it also counts real
                               Spoonacular/TheMealDB fetches). There is NO separate monthly counter
                               table -- the daily rows this file already writes (one per identity per
                               day) are the single source of truth for both limits; the monthly total
                               is derived by summing the current UTC calendar month's rows
                               (getMonthlyUsageSum), not by maintaining a second counter that could
                               drift out of sync with the first. That sum is a plain SELECT, not
                               atomic with the daily increment -- an acceptable race for a soft
                               cost-control limit, not a hard security boundary. Calls the
                               increment_recipe_usage Postgres function (see its migration) to
                               atomically record `count` more recipes for `identity` today (UTC) and
                               get back the new running daily total in one round trip -- a
                               select-then-upsert from here would race under concurrent requests.
                               `count` is >1 only for api/search.ts's AI mode (AI_SEARCH_RESULT_COUNT
                               recipes generated per call, each counts) -- every other caller
                               (random.ts, recommend-dish.ts, search.ts's catalog mode) uses the
                               default of 1. Fails OPEN (allowed: true) on any error/missing config --
                               losing the ability to enforce a cost limit is far safer than
                               incorrectly locking out every request over an infra hiccup. random.ts/
                               recommend-dish.ts/search.ts each call resolveCaller then, if not admin,
                               this -- before doing any real work, returning
                               `{ error: 'recipe_limit_exceeded' }` with HTTP 429 if EITHER limit is
                               over (the response body no longer carries the specific numbers --
                               RecipeLimitModal.tsx fetches its own live totals via useRecipeUsage()
                               instead, see below). api.ts's isRecipeLimitError(err) recognizes this
                               specific code so the frontend can show RecipeLimitModal.tsx instead of
                               a generic inline error string. getRecipeUsage(identity) is the
                               read-only counterpart -- a plain SELECT for today's row plus the same
                               monthly sum (no RPC, nothing to increment), for api/recipe-usage.ts to
                               report a caller's remaining quota on both axes *before* they hit either
                               limit. 15/month is deliberately well under 5×30 -- a caller maxing out
                               the daily allowance for just 3 days already exhausts the whole month,
                               so in practice the monthly cap is often what actually binds for an
                               active user, with the daily cap still catching a single-day burst early
                               in the month.
                               **Gotcha, confirmed live**: renaming the `ai_usage` table with `ALTER
                               TABLE ... RENAME TO recipe_usage` and the function with `ALTER FUNCTION
                               ... RENAME` did NOT update the table name INSIDE the function's own SQL
                               body -- a `language sql` function's body is stored as plain text, not
                               rewritten when a table it references is renamed (unlike a view, which
                               Postgres does track). The function silently started failing every call
                               with `relation "public.ai_usage" does not exist`, which
                               recordAndCheckRecipeUsage's fail-open design swallowed completely: every
                               request succeeded and NOTHING was ever recorded, so the bug was
                               invisible until directly testing the RPC in isolation. Fixed with a
                               `create or replace function` migration using the corrected body. Any
                               future rename of a table a `language sql`/`plpgsql` function body
                               references by name needs an explicit `create or replace` of that
                               function too -- a bare `alter table ... rename` is not enough.
  recipe-usage.ts           — read-only usage check for the caller (resolveCaller + getRecipeUsage
                               above) -- `{ isAdmin, dailyLimit, dailyRemaining, monthlyLimit,
                               monthlyRemaining }`, never increments anything. Backs
                               src/hooks/useRecipeUsage.ts, which src/components/RecipeUsageBanner.tsx
                               uses to show a non-admin caller how many recipes they have left today
                               AND this month (plus a contact-for-more-limit line,
                               src/lib/support.ts) -- hidden entirely once `isAdmin` comes back true.
                               useRandomRecipe.ts/useRecommendDish.ts/Search.tsx each invalidate this
                               hook's query key prefix (RECIPE_USAGE_QUERY_KEY) on BOTH success AND
                               error (the usage check increments before the actual work happens, so
                               even a blocked/failed attempt is usually still recorded server-side --
                               without invalidating on error too, RecipeLimitModal.tsx's own
                               useRecipeUsage() read could show stale pre-attempt numbers), so the
                               displayed count updates immediately rather than waiting out its 30s
                               staleTime. useRecipeUsage.ts's actual query key is
                               `[...RECIPE_USAGE_QUERY_KEY, user?.id ?? 'anon']`, not the bare
                               constant -- without the user-id suffix, logging in right after browsing
                               anonymously kept showing the anonymous result (confirmed live: an admin
                               who'd just signed in still saw "4/5 left", since nothing about login
                               itself triggers a refetch of an unscoped query key that already has
                               cached data). Scoping by user id (same pattern as useFavorites/
                               usePreferences/useRecipeHistory) makes login/logout a genuinely
                               different cache entry instead of silently reusing a different
                               identity's stale result
  admin-users.ts            — lists every signed-up user with their role, for the admin-only user
                               management page. Admin-only (resolveCaller + isAdmin, 403 otherwise --
                               checked server-side, same as every other admin action here, never
                               trusting a client-side check alone). auth.users (email/id, via
                               supabaseAdmin.auth.admin.listUsers, capped at 200 -- real pagination is
                               a reasonable future addition if the user base ever outgrows that, not
                               attempted here) and public.profiles (role) are separate concerns with
                               no client-side join available -- merged in JS, defaulting to role
                               'user' for the rare case a profiles row is missing rather than
                               silently dropping that user from the list
  admin-set-role.ts         — the ONLY way profiles.role can change after signup. Admin-only, same
                               resolveCaller check as admin-users.ts. Rejects a non-'user'/'admin'
                               role (400) and rejects an admin trying to remove their OWN admin role
                               (400, `cannot_remove_own_admin`) -- there's no other way to regain it
                               short of a direct database edit (confirmed necessary once already,
                               fixing a typo'd email in this app's own admin-promotion migration), so
                               a single misclick here could otherwise permanently lock everyone out of
                               this page. Uses supabaseAdmin (service role), which is the only client
                               that CAN write this column at all -- see the "User roles" section above
                               for why an ordinary session structurally cannot, even via a direct
                               supabase-js call bypassing this endpoint entirely
  _lib/aiRecipeStore.ts     — saveAiRecipe/getAiRecipe: persistence for AI-generated recipes, via
                               supabaseAdmin against the `ai_recipes` table (RLS enabled, zero
                               policies -- only this admin client can read/write it, confirmed by
                               design: a direct anon-key query is denied). saveAiRecipe returns the
                               new integer id (matches favorites.spoonacular_recipe_id's type and
                               every existing RecipeSummary.id: number contract, so `source: 'ai'`
                               needed zero changes to shared id-handling code). getAiRecipe
                               reconstructs a RecipeDetail with image/images/videoUrls all empty,
                               left for finalizeRecipe to fill in exactly like a fresh
                               Spoonacular/TheMealDB fetch -- these are deliberately NOT persisted
                               alongside the recipe content, for consistency with every other source
                               (finalizeRecipe already re-resolves images/video on every view
                               regardless of source, no "already have it" short-circuit exists even
                               for provider recipes, so AI recipes get the same treatment rather
                               than a special case). getRecentAiRecipeTitles(limit, area?) fetches
                               the most recent titles (optionally filtered to one area/cuisine),
                               for random.ts to steer generateAiRecipe away from repeats -- see
                               aiRecipe.ts's avoidTitles below. Returns [] on any failure, since
                               this is a variety nicety, never worth failing the request over
  _lib/aiRecipe.ts          — generateAiRecipe/generateAiRecipes: invents a complete original
                               recipe (or, for Search, several MEANINGFULLY DIFFERENT ones in one
                               call -- calling generateAiRecipe in a loop would give each call zero
                               awareness of what the others already produced, risking near-
                               duplicates) via OpenAI, respecting the same ingredients/mood/time/
                               cuisine/category/dietaryRestrictions/dislikedIngredients constraints
                               api/recommend-dish.ts's tool-calling path already accepts. Always
                               generates in English regardless of the request's language, so
                               finalizeRecipe's existing translation pipeline (glossary.ts,
                               translateIngredientPhrases) is the one place that localizes every
                               source -- no separate translation logic for AI recipes. Used by
                               api/random.ts, api/recommend-dish.ts, and api/search.ts when
                               `useAi: true` is set on the request, in place of querying
                               Spoonacular/TheMealDB; api/recommend-dish.ts's AI path skips its
                               whole tool-calling loop entirely (grounding a pick in a real search
                               result is the opposite of what AI mode is for). Also accepts an
                               `avoidTitles?: string[]` input, appended to the prompt as "Do NOT
                               suggest any of these dishes"; passed by random.ts using
                               getRecentAiRecipeTitles (see aiRecipeStore.ts above) to fix repeated
                               Random taps converging on the same dish. `callAiRecipeModel` also
                               sets `temperature: 1.1` (above the API's 1.0 default) as a
                               complementary general-variety measure, reducing the model's tendency
                               to converge on the same "obvious" answer for an under-specified
                               prompt even before any avoidTitles history exists

supabase/migrations/        — SQL schema (profiles, preferences, favorites — all RLS-scoped to auth.uid(); favorites also has a source column, see above; ai_recipes has RLS enabled with zero policies -- server-only access via _lib/supabaseAdmin.ts, see above; recipe_history is RLS-scoped to auth.uid() like favorites, capped at the 10 most recent rows per user via a trim_recipe_history AFTER INSERT OR UPDATE trigger -- server-enforced rather than relying on every client to prune, same reasoning as handle_new_user() in the init migration; profiles.role -- 'user' default, 'admin' for the app owner's own account, set directly in the migration -- and recipe_usage (originally ai_usage, renamed -- see _lib/recipeUsage.ts's entry above for why, and for a real gotcha hit doing the rename: a table/function rename alone does NOT rewrite the OLD name baked into a `language sql` function's own body text), RLS enabled with zero policies like ai_recipes, both for the daily recipe limit, see _lib/auth.ts / _lib/recipeUsage.ts above; the two 20260922*.sql migrations lock down profiles.role at the Postgres privilege level -- see the "User roles" section above for why it took two attempts and what the correct pattern is for any future admin/server-only column; recipe_video_cache is RLS enabled with zero policies like ai_recipes, keyed by (source, recipe_id), for _lib/videoCache.ts above -- keeps a recipe's video guide stable across repeat views instead of a fresh YouTube search possibly returning a different result each time)
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
