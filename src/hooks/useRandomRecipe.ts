import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Language } from '../i18n/translations'
import { randomRecipe } from '../lib/api'
import { RECIPE_USAGE_QUERY_KEY } from './useRecipeUsage'

export function useRandomRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cuisine, language, useAi }: { cuisine?: string; language?: Language; useAi?: boolean }) =>
      randomRecipe(cuisine, language, useAi),
    onSuccess: (recipe, { language }) => {
      // Pre-fill the detail page's cache so navigating to it is instant,
      // since this response already IS the full recipe detail.
      queryClient.setQueryData(['recipes', 'detail', recipe.id, recipe.source, language], recipe)
      // A successful fetch (catalog or AI) just used up one of today's
      // quota -- refresh the displayed remaining count (Layout.tsx) right away.
      queryClient.invalidateQueries({ queryKey: RECIPE_USAGE_QUERY_KEY })
    },
  })
}
