import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveCaller } from './_lib/auth.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

// Supabase's admin.listUsers() paginates (50 per page by default) -- a
// generous single page is enough for this app's scale today. Real
// pagination in the UI is a reasonable future addition if the user base
// ever outgrows this, not attempted here.
const MAX_USERS = 200

/**
 * Lists every signed-up user with their role, for the admin-only user
 * management page (src/pages/AdminUsers.tsx). auth.users (email, id) and
 * public.profiles (role) are separate concerns with no client-side join
 * available -- merged here in JS. A user with no profiles row (shouldn't
 * normally happen, given handle_new_user()'s trigger) defaults to 'user'
 * rather than being dropped, so the list is never silently incomplete.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' })

  const caller = await resolveCaller(req)
  if (!caller.isAdmin) return res.status(403).json({ error: 'Admins only' })

  const [{ data: userList, error: listError }, { data: profiles, error: profilesError }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: MAX_USERS }),
    supabaseAdmin.from('profiles').select('id, role'),
  ])

  if (listError || profilesError || !userList) {
    console.error('admin-users list error:', listError ?? profilesError)
    return res.status(502).json({ error: 'Could not load users' })
  }

  const roleById = new Map((profiles ?? []).map((p) => [p.id as string, p.role as string]))
  const users = userList.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: roleById.get(u.id) ?? 'user',
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))

  res.status(200).json(users)
}
