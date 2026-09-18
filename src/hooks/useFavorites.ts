import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { RecipeSource } from '../lib/api'

export interface Favorite {
  id: string
  spoonacular_recipe_id: number
  source: RecipeSource
  title: string
  image_url: string
  saved_at: string
}

export function useFavorites() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['favorites', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('*')
        .order('saved_at', { ascending: false })
      if (error) throw error
      return data as Favorite[]
    },
    enabled: !!user,
  })
}

export function useAddFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recipe: { id: number; source: RecipeSource; title: string; image: string }) => {
      if (!user) throw new Error('Must be signed in to save favorites')
      const { error } = await supabase.from('favorites').insert({
        user_id: user.id,
        spoonacular_recipe_id: recipe.id,
        source: recipe.source,
        title: recipe.title,
        image_url: recipe.image,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }),
  })
}

export function useRemoveFavorite() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (favoriteId: string) => {
      const { error } = await supabase.from('favorites').delete().eq('id', favoriteId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] }),
  })
}
