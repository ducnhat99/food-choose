import type { VercelRequest } from '@vercel/node'
import { supabaseAdmin } from './supabaseAdmin.js'

export interface CallerContext {
  /** `user:<uuid>` for a signed-in caller, `ip:<address>` otherwise -- the key api/_lib/aiUsage.ts tracks daily usage under. */
  identity: string
  /** True only for a signed-in caller whose profiles.role is 'admin' -- exempt from the daily AI-generation limit entirely. */
  isAdmin: boolean
}

/**
 * Resolves who's calling an api/*.ts endpoint, for the daily AI-generation
 * limit (api/_lib/aiUsage.ts). A signed-in caller is identified by verifying
 * the bearer token their browser sends (src/lib/api.ts's invoke attaches the
 * current Supabase session's access token on every request); an anonymous
 * caller falls back to their IP address, since a serverless function has no
 * other durable identity for a logged-out visitor -- imprecise for shared
 * IPs (offices, mobile carriers), but a reasonable tradeoff for a
 * cost-control limit with no user account to key off of.
 */
export async function resolveCaller(req: VercelRequest): Promise<CallerContext> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token && supabaseAdmin) {
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    const user = data?.user
    if (!error && user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      return { identity: `user:${user.id}`, isAdmin: profile?.role === 'admin' }
    }
  }

  const forwardedFor = req.headers['x-forwarded-for']
  const rawIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const ip = rawIp?.split(',')[0]?.trim()
  return { identity: `ip:${ip ?? 'unknown'}`, isAdmin: false }
}
