import { supabaseAdmin } from './supabaseAdmin.js'

/** Non-admin daily cap on generated/fetched recipes, shared across Suggest a dish / Random dish / Search, in EITHER catalog or AI mode. */
export const DAILY_RECIPE_LIMIT = 5
/** Non-admin calendar-month cap, on top of the daily one -- a lower ceiling on total cost even when usage is spread evenly across many days rather than bursted on one. */
export const MONTHLY_RECIPE_LIMIT = 15

export interface RecipeUsageResult {
  allowed: boolean
  dailyLimit: number
  dailyRemaining: number
  monthlyLimit: number
  monthlyRemaining: number
}

/** `usage_date` bounds (UTC, YYYY-MM-DD strings, end exclusive) for the calendar month `now` falls in. */
function currentMonthBounds(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

/**
 * Sums `identity`'s recipe_usage.count across every day in the current UTC
 * calendar month -- there's no separate monthly counter table; the daily
 * rows this file already writes (one per identity per day, see
 * increment_recipe_usage's migration) are the single source of truth for
 * both the daily AND monthly limit, derived by summing instead of
 * maintaining a second counter that could drift out of sync with the first.
 * A personal app's per-identity row count for one month is at most ~30
 * (one row per day), so summing client-side here is cheap -- not worth a
 * dedicated SQL aggregate RPC for that scale.
 */
async function getMonthlyUsageSum(identity: string): Promise<number> {
  if (!supabaseAdmin) return 0

  const { start, end } = currentMonthBounds()
  const { data, error } = await supabaseAdmin
    .from('recipe_usage')
    .select('count')
    .eq('identity', identity)
    .gte('usage_date', start)
    .lt('usage_date', end)

  if (error || !data) return 0
  return data.reduce((sum, row) => sum + (row.count as number), 0)
}

/**
 * Atomically records `count` more recipes for `identity` today (UTC) via the
 * increment_recipe_usage Postgres function (see its migration for why this
 * has to be a single atomic round trip, not a select-then-upsert from
 * here), then sums the running monthly total (see getMonthlyUsageSum --
 * NOT atomic with the daily increment, but a momentary race here would at
 * most let a request through a request or two over budget, an acceptable
 * tradeoff for a cost-control soft limit, not a hard security boundary).
 * Reports whether the caller is still within EITHER limit -- `count` is >1
 * only for api/search.ts's AI mode, which generates several recipes in one
 * call -- each counts toward both limits, not just the call itself. Every
 * other caller (random.ts, recommend-dish.ts, and search.ts's catalog
 * mode) passes the default of 1 -- one call, one recipe (or one batch of
 * existing catalog results), regardless of whether it was served by AI or
 * Spoonacular/TheMealDB.
 *
 * Fails OPEN (allowed: true) if supabaseAdmin isn't configured or the RPC
 * errors -- losing the ability to enforce a cost-control limit is far
 * safer than incorrectly blocking every request over an unrelated infra
 * hiccup.
 */
export async function recordAndCheckRecipeUsage(identity: string, count = 1): Promise<RecipeUsageResult> {
  const openResult: RecipeUsageResult = {
    allowed: true,
    dailyLimit: DAILY_RECIPE_LIMIT,
    dailyRemaining: DAILY_RECIPE_LIMIT,
    monthlyLimit: MONTHLY_RECIPE_LIMIT,
    monthlyRemaining: MONTHLY_RECIPE_LIMIT,
  }
  if (!supabaseAdmin) return openResult

  const { data, error } = await supabaseAdmin.rpc('increment_recipe_usage', {
    p_identity: identity,
    p_delta: count,
  })
  if (error || typeof data !== 'number') return openResult

  const dailyCount = data
  const monthlyCount = await getMonthlyUsageSum(identity)

  return {
    allowed: dailyCount <= DAILY_RECIPE_LIMIT && monthlyCount <= MONTHLY_RECIPE_LIMIT,
    dailyLimit: DAILY_RECIPE_LIMIT,
    dailyRemaining: Math.max(0, DAILY_RECIPE_LIMIT - dailyCount),
    monthlyLimit: MONTHLY_RECIPE_LIMIT,
    monthlyRemaining: Math.max(0, MONTHLY_RECIPE_LIMIT - monthlyCount),
  }
}

/**
 * Read-only lookup of `identity`'s usage this UTC day/month, for
 * api/recipe-usage.ts -- so the frontend can show a non-admin caller how
 * many recipes they have left *before* they hit either limit, not just
 * after (RecipeLimitModal.tsx). Never increments anything. Same UTC-date
 * convention as increment_recipe_usage's `(now() at time zone
 * 'utc')::date` -- Date's own toISOString() is always UTC, so slicing it
 * to 10 chars matches.
 */
export async function getRecipeUsage(identity: string): Promise<RecipeUsageResult> {
  const openResult: RecipeUsageResult = {
    allowed: true,
    dailyLimit: DAILY_RECIPE_LIMIT,
    dailyRemaining: DAILY_RECIPE_LIMIT,
    monthlyLimit: MONTHLY_RECIPE_LIMIT,
    monthlyRemaining: MONTHLY_RECIPE_LIMIT,
  }
  if (!supabaseAdmin) return openResult

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: todayRow, error }, monthlyCount] = await Promise.all([
    supabaseAdmin.from('recipe_usage').select('count').eq('identity', identity).eq('usage_date', today).maybeSingle(),
    getMonthlyUsageSum(identity),
  ])

  if (error) return openResult

  const dailyCount = todayRow?.count ?? 0
  return {
    allowed: dailyCount < DAILY_RECIPE_LIMIT && monthlyCount < MONTHLY_RECIPE_LIMIT,
    dailyLimit: DAILY_RECIPE_LIMIT,
    dailyRemaining: Math.max(0, DAILY_RECIPE_LIMIT - dailyCount),
    monthlyLimit: MONTHLY_RECIPE_LIMIT,
    monthlyRemaining: Math.max(0, MONTHLY_RECIPE_LIMIT - monthlyCount),
  }
}
