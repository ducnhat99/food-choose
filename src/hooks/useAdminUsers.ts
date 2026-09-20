import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listAdminUsers, setUserRole, type UserRole } from '../lib/api'

const ADMIN_USERS_QUERY_KEY = ['admin-users']

export function useAdminUsers() {
  return useQuery({
    queryKey: ADMIN_USERS_QUERY_KEY,
    queryFn: listAdminUsers,
  })
}

export function useSetUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => setUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY }),
  })
}
