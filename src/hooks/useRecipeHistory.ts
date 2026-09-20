import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { RecipeSource } from '../lib/api'

export interface RecipeHistoryEntry {
  id: string
  recipe_id: number
  source: RecipeSource
  title: string
  image_url: string
  viewed_at: string
}

export function useRecipeHistory() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['recipe-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipe_history')
        .select('*')
        .order('viewed_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as RecipeHistoryEntry[]
    },
    enabled: !!user,
  })
}

/**
 * Records (or bumps) a recipe view. Upserts on (user_id, source, recipe_id)
 * -- re-viewing an already-seen recipe just refreshes its viewed_at and
 * moves it back to the top, instead of appearing twice in the list. The
 * server trims to the 10 most recent per user automatically (see the
 * trim_recipe_history trigger), so this never needs to prune client-side.
 */
export function useRecordRecipeView() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recipe: {
      id: number
      source: RecipeSource
      title: string
      image: string
      images?: string[]
    }) => {
      if (!user) return
      const { error } = await supabase.from('recipe_history').upsert(
        {
          user_id: user.id,
          recipe_id: recipe.id,
          source: recipe.source,
          title: recipe.title,
          image_url: recipe.image || recipe.images?.[0] || '',
          viewed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,source,recipe_id' },
      )
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipe-history', user?.id] }),
  })
}
