import { useQuery } from '@tanstack/react-query'
import { getAiUsage } from '../lib/api'
import { useRecipeMode } from '../context/RecipeModeContext'

export const AI_USAGE_QUERY_KEY = ['ai-usage']

/**
 * The current caller's remaining AI-generation quota for today, for Layout.tsx
 * to show a non-admin user how many they have left before they hit
 * AiLimitModal.tsx. Only enabled in AI mode -- irrelevant, and a wasted
 * request, in catalog mode where there's no limit at all. Callers that
 * perform a generation (useRandomRecipe, useRecommendDish, Search.tsx)
 * invalidate AI_USAGE_QUERY_KEY on success so the displayed count updates
 * right away instead of waiting out staleTime.
 */
export function useAiUsage() {
  const { mode } = useRecipeMode()

  return useQuery({
    queryKey: AI_USAGE_QUERY_KEY,
    queryFn: getAiUsage,
    enabled: mode === 'ai',
    staleTime: 30_000,
  })
}
