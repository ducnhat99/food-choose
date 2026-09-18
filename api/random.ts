import type { VercelRequest, VercelResponse } from '@vercel/node'
import { finalizeRecipe } from './_lib/finalize.js'
import { mealdbRandom } from './_lib/mealdb.js'
import { spoonacularRandom } from './_lib/spoonacular.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cuisine, language } = req.body ?? {}

  const recipe = (await spoonacularRandom(cuisine)) ?? (await mealdbRandom(cuisine))
  if (!recipe) {
    return res.status(404).json({
      error: cuisine
        ? `Could not find a random recipe for ${cuisine}, please try again`
        : 'Could not find a random recipe, please try again',
    })
  }

  res.status(200).json(await finalizeRecipe(recipe, language))
}
