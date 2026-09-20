import { supabaseAdmin } from './supabaseAdmin.js'

/** Non-admin daily cap on AI-generated recipes, shared across Suggest a dish / Random dish / Search. */
export const DAILY_AI_LIMIT = 5

export interface AiUsageResult {
  allowed: boolean
  remaining: number
}

/**
 * Atomically records `count` more AI-generated recipes for `identity` today
 * (UTC) via the increment_ai_usage Postgres function (see its migration for
 * why this has to be a single atomic round trip, not a select-then-upsert
 * from here), and reports whether the caller is still within DAILY_AI_LIMIT.
 * `count` is >1 for api/search.ts, which generates several recipes in one
 * call -- each counts toward the limit, not just the call itself.
 *
 * Fails OPEN (allowed: true) if supabaseAdmin isn't configured or the RPC
 * errors -- losing the ability to enforce a cost-control limit is far
 * safer than incorrectly blocking every AI-mode request over an unrelated
 * infra hiccup.
 */
export async function recordAndCheckAiUsage(identity: string, count = 1): Promise<AiUsageResult> {
  if (!supabaseAdmin) return { allowed: true, remaining: DAILY_AI_LIMIT }

  const { data, error } = await supabaseAdmin.rpc('increment_ai_usage', {
    p_identity: identity,
    p_delta: count,
  })

  if (error || typeof data !== 'number') return { allowed: true, remaining: DAILY_AI_LIMIT }

  return { allowed: data <= DAILY_AI_LIMIT, remaining: Math.max(0, DAILY_AI_LIMIT - data) }
}

/**
 * Read-only lookup of `identity`'s AI-generation usage today (UTC), for
 * api/ai-usage.ts -- so the frontend can show a non-admin caller how many
 * generations they have left *before* they hit the limit, not just after
 * (AiLimitModal.tsx). Never increments anything. Same UTC-date convention
 * as increment_ai_usage's `(now() at time zone 'utc')::date` -- Date's
 * own toISOString() is always UTC, so slicing it to 10 chars matches.
 */
export async function getAiUsage(identity: string): Promise<AiUsageResult> {
  if (!supabaseAdmin) return { allowed: true, remaining: DAILY_AI_LIMIT }

  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .from('ai_usage')
    .select('count')
    .eq('identity', identity)
    .eq('usage_date', today)
    .maybeSingle()

  if (error) return { allowed: true, remaining: DAILY_AI_LIMIT }

  const count = data?.count ?? 0
  return { allowed: count < DAILY_AI_LIMIT, remaining: Math.max(0, DAILY_AI_LIMIT - count) }
}
