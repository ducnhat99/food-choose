import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveCaller } from './_lib/auth.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

const VALID_ROLES = ['user', 'admin']

/**
 * Sets another user's role -- the only way profiles.role can ever change
 * after signup (the "authenticated" Postgres role has no UPDATE privilege
 * on that column at all, see the profile-role-lock migrations; this
 * endpoint uses supabaseAdmin, the service-role client, which bypasses
 * that). Admin-only, checked server-side via resolveCaller -- never trust
 * a client-side admin check alone for a privileged write like this.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' })

  const caller = await resolveCaller(req)
  if (!caller.isAdmin) return res.status(403).json({ error: 'Admins only' })

  const { userId, role } = req.body ?? {}
  if (typeof userId !== 'string' || !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'userId and a valid role are required' })
  }

  // Blocks an admin from removing their own admin role -- there's no other
  // way to regain it short of a direct database edit (as this app's own
  // admin account needed once already), so a single misclick here could
  // otherwise permanently lock everyone out of this page.
  if (caller.identity === `user:${userId}` && role !== 'admin') {
    return res.status(400).json({ error: 'cannot_remove_own_admin' })
  }

  const { error } = await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
  if (error) {
    console.error('admin-set-role error:', error)
    return res.status(502).json({ error: 'Could not update role' })
  }

  res.status(200).json({ id: userId, role })
}
