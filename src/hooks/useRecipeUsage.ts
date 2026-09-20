import { useQuery } from '@tanstack/react-query'
import { getRecipeUsage } from '../lib/api'
import { useAuth } from '../context/AuthContext'

/**
 * Base key for invalidation (useRandomRecipe.ts/useRecommendDish.ts/
 * Search.tsx all invalidate this prefix after a successful generation --
 * a prefix match invalidates every user-scoped variant below it, so those
 * callers don't need to know the current user's id themselves).
 */
export const RECIPE_USAGE_QUERY_KEY = ['recipe-usage']

/**
 * The current caller's remaining daily recipe quota, for Layout.tsx to show
 * a non-admin user how many they have left before they hit
 * RecipeLimitModal.tsx. Applies regardless of catalog/AI mode -- both cost
 * real resources (OpenAI usage for AI mode, Spoonacular's own limited
 * free-tier quota for catalog mode), so this is always enabled, not just in
 * AI mode.
 *
 * Keyed by the signed-in user's id (or 'anon') -- without this, logging in
 * right after browsing anonymously kept showing the anonymous result (e.g.
 * "4/5 left" for an admin who should see no banner at all): the query key
 * was a bare constant, so React Query treated the pre-login and post-login
 * caller as the same cache entry and never re-fetched, since nothing else
 * happened to trigger one. Scoping by user id makes a login/logout a
 * genuinely different cache entry, so it fetches fresh instead of serving
 * a stale result for a different identity.
 */
export function useRecipeUsage() {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...RECIPE_USAGE_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: getRecipeUsage,
    staleTime: 30_000,
  })
}
