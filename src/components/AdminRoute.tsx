import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsAdmin } from '../hooks/useIsAdmin'

/** Like ProtectedRoute, but also requires profiles.role === 'admin' -- redirects a signed-in non-admin to / rather than exposing the page (the actual data is admin-gated server-side regardless, but there's no reason to render the UI at all for someone who can't use it). */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { data: isAdmin, isLoading } = useIsAdmin()

  if (loading || (user && isLoading)) return <p className="text-neutral-500">Loading...</p>
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}
