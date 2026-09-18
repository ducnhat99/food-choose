import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Language } from '../i18n/translations'
import { randomRecipe } from '../lib/api'

export function useRandomRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cuisine, language }: { cuisine?: string; language?: Language }) =>
      randomRecipe(cuisine, language),
    onSuccess: (recipe, { language }) => {
      // Pre-fill the detail page's cache so navigating to it is instant,
      // since this response already IS the full recipe detail.
      queryClient.setQueryData(['recipes', 'detail', recipe.id, recipe.source, language], recipe)
    },
  })
}
