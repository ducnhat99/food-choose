import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

/**
 * Whether the signed-in caller's own role is 'admin' -- used to show/hide
 * the Admin nav link and gate AdminRoute.tsx. Reads profiles.role directly
 * via the anon-key client rather than a dedicated endpoint: the existing
 * "Users can view their own profile" RLS policy already permits exactly
 * this (a user reading their own row), so no server code is needed just to
 * answer "am I admin" -- unlike listing/changing OTHER users' roles, which
 * does need the admin-only api/admin-users.ts / api/admin-set-role.ts
 * (RLS only ever allows a user to see their own row, and profiles.role
 * can't be updated by an ordinary session at all, see the profile-role-lock
 * migrations).
 */
export function useIsAdmin() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
      if (error) throw error
      return data.role === 'admin'
    },
    enabled: !!user,
  })
}
