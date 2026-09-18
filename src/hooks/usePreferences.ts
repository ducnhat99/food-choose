import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export interface Preferences {
  dietary_restrictions: string[]
  disliked_ingredients: string[]
  cuisine_preferences: string[]
}

const emptyPreferences: Preferences = {
  dietary_restrictions: [],
  disliked_ingredients: [],
  cuisine_preferences: [],
}

export function usePreferences() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['preferences', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preferences')
        .select('dietary_restrictions, disliked_ingredients, cuisine_preferences')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data as Preferences | null) ?? emptyPreferences
    },
    enabled: !!user,
  })
}

export function useSavePreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (preferences: Preferences) => {
      if (!user) throw new Error('Must be signed in to save preferences')
      const { error } = await supabase
        .from('preferences')
        .upsert({ user_id: user.id, ...preferences })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['preferences', user?.id] }),
  })
}
