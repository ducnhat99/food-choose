import type { VercelRequest, VercelResponse } from '@vercel/node'
import { DAILY_AI_LIMIT, getAiUsage } from './_lib/aiUsage.js'
import { resolveCaller } from './_lib/auth.js'

/**
 * Read-only usage check for the caller (see api/_lib/auth.ts for how they're
 * identified/whether they're admin), so the frontend can show a non-admin
 * user how many AI-generated recipes they have left today -- proactively,
 * not just via AiLimitModal.tsx after they've already been blocked.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveCaller(req)
  if (caller.isAdmin) {
    return res.status(200).json({ isAdmin: true, limit: DAILY_AI_LIMIT, remaining: DAILY_AI_LIMIT })
  }

  const usage = await getAiUsage(caller.identity)
  res.status(200).json({ isAdmin: false, limit: DAILY_AI_LIMIT, remaining: usage.remaining })
}
