import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveCaller } from './_lib/auth.js'
import { DAILY_RECIPE_LIMIT, getRecipeUsage, MONTHLY_RECIPE_LIMIT } from './_lib/recipeUsage.js'

/**
 * Read-only usage check for the caller (see api/_lib/auth.ts for how they're
 * identified/whether they're admin), so the frontend can show a non-admin
 * user how many recipes they have left today AND this month -- proactively,
 * not just via RecipeLimitModal.tsx after they've already been blocked.
 * Applies regardless of catalog/AI mode -- both cost real resources (OpenAI
 * usage for AI mode, Spoonacular's own limited free-tier quota for catalog
 * mode).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const caller = await resolveCaller(req)
  if (caller.isAdmin) {
    return res.status(200).json({
      isAdmin: true,
      dailyLimit: DAILY_RECIPE_LIMIT,
      dailyRemaining: DAILY_RECIPE_LIMIT,
      monthlyLimit: MONTHLY_RECIPE_LIMIT,
      monthlyRemaining: MONTHLY_RECIPE_LIMIT,
    })
  }

  const usage = await getRecipeUsage(caller.identity)
  res.status(200).json({ isAdmin: false, ...usage })
}
