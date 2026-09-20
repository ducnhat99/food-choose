import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recommendDish } from '../lib/api'
import { RECIPE_USAGE_QUERY_KEY } from './useRecipeUsage'

export function useRecommendDish() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recommendDish,
    onSuccess: () => {
      // A successful recommendation (catalog or AI) just used up one of
      // today's quota -- refresh the displayed remaining count (Layout.tsx) right away.
      queryClient.invalidateQueries({ queryKey: RECIPE_USAGE_QUERY_KEY })
    },
  })
}
