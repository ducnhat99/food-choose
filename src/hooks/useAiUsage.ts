import { useQuery } from '@tanstack/react-query'
import { getAiUsage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRecipeMode } from '../context/RecipeModeContext'

/**
 * Base key for invalidation (useRandomRecipe.ts/useRecommendDish.ts/
 * Search.tsx all invalidate this prefix after a successful generation --
 * a prefix match invalidates every user-scoped variant below it, so those
 * callers don't need to know the current user's id themselves).
 */
export const AI_USAGE_QUERY_KEY = ['ai-usage']

/**
 * The current caller's remaining AI-generation quota for today, for Layout.tsx
 * to show a non-admin user how many they have left before they hit
 * AiLimitModal.tsx. Only enabled in AI mode -- irrelevant, and a wasted
 * request, in catalog mode where there's no limit at all.
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
export function useAiUsage() {
  const { mode } = useRecipeMode()
  const { user } = useAuth()

  return useQuery({
    queryKey: [...AI_USAGE_QUERY_KEY, user?.id ?? 'anon'],
    queryFn: getAiUsage,
    enabled: mode === 'ai',
    staleTime: 30_000,
  })
}
