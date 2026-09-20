import { supabaseAdmin } from './supabaseAdmin.js'

/** Non-admin daily cap on generated/fetched recipes, shared across Suggest a dish / Random dish / Search, in EITHER catalog or AI mode. */
export const DAILY_RECIPE_LIMIT = 5

export interface RecipeUsageResult {
  allowed: boolean
  remaining: number
}

/**
 * Atomically records `count` more recipes for `identity` today (UTC) via the
 * increment_recipe_usage Postgres function (see its migration for why this
 * has to be a single atomic round trip, not a select-then-upsert from
 * here), and reports whether the caller is still within DAILY_RECIPE_LIMIT.
 * `count` is >1 only for api/search.ts's AI mode, which generates several
 * recipes in one call -- each counts toward the limit, not just the call
 * itself. Every other caller (random.ts, recommend-dish.ts, and
 * search.ts's catalog mode) passes the default of 1 -- one call, one recipe
 * (or one batch of existing catalog results), regardless of whether it was
 * served by AI or Spoonacular/TheMealDB.
 *
 * Fails OPEN (allowed: true) if supabaseAdmin isn't configured or the RPC
 * errors -- losing the ability to enforce a cost-control limit is far
 * safer than incorrectly blocking every request over an unrelated infra
 * hiccup.
 */
export async function recordAndCheckRecipeUsage(identity: string, count = 1): Promise<RecipeUsageResult> {
  if (!supabaseAdmin) return { allowed: true, remaining: DAILY_RECIPE_LIMIT }

  const { data, error } = await supabaseAdmin.rpc('increment_recipe_usage', {
    p_identity: identity,
    p_delta: count,
  })

  if (error || typeof data !== 'number') return { allowed: true, remaining: DAILY_RECIPE_LIMIT }

  return { allowed: data <= DAILY_RECIPE_LIMIT, remaining: Math.max(0, DAILY_RECIPE_LIMIT - data) }
}

/**
 * Read-only lookup of `identity`'s usage today (UTC), for api/recipe-usage.ts
 * -- so the frontend can show a non-admin caller how many recipes they have
 * left *before* they hit the limit, not just after (RecipeLimitModal.tsx).
 * Never increments anything. Same UTC-date convention as
 * increment_recipe_usage's `(now() at time zone 'utc')::date` -- Date's own
 * toISOString() is always UTC, so slicing it to 10 chars matches.
 */
export async function getRecipeUsage(identity: string): Promise<RecipeUsageResult> {
  if (!supabaseAdmin) return { allowed: true, remaining: DAILY_RECIPE_LIMIT }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('recipe_usage')
    .select('count')
    .eq('identity', identity)
    .eq('usage_date', today)
    .maybeSingle()

  if (error) return { allowed: true, remaining: DAILY_RECIPE_LIMIT }

  const count = data?.count ?? 0
  return { allowed: count < DAILY_RECIPE_LIMIT, remaining: Math.max(0, DAILY_RECIPE_LIMIT - count) }
}
