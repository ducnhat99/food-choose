import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recommendDish } from '../lib/api'
import { AI_USAGE_QUERY_KEY } from './useAiUsage'

export function useRecommendDish() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recommendDish,
    onSuccess: (_result, request) => {
      // A successful AI-mode generation just used up one of today's quota --
      // refresh the displayed remaining count (Layout.tsx) right away.
      if (request.useAi) queryClient.invalidateQueries({ queryKey: AI_USAGE_QUERY_KEY })
    },
  })
}
