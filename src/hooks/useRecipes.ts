import { useQuery } from '@tanstack/react-query'
import type { Language } from '../i18n/translations'
import { getRecipe, searchRecipes, type RecipeSource } from '../lib/api'

export function useSearchRecipes(query: string, cuisine?: string, language?: Language) {
  return useQuery({
    queryKey: ['recipes', 'search', query, cuisine, language],
    queryFn: () => searchRecipes(query, cuisine, language),
    enabled: query.trim().length > 0 || !!cuisine,
  })
}

export function useRecipe(
  id: number | undefined,
  source: RecipeSource | undefined,
  language?: Language,
) {
  return useQuery({
    queryKey: ['recipes', 'detail', id, source, language],
    queryFn: () => getRecipe(id as number, source as RecipeSource, language),
    enabled: id !== undefined && source !== undefined,
  })
}
