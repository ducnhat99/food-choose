import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAiRecipe } from './_lib/aiRecipeStore.js'
import { finalizeRecipe } from './_lib/finalize.js'
import { mealdbRecipe } from './_lib/mealdb.js'
import { spoonacularRecipe } from './_lib/spoonacular.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, source, language } = req.body ?? {}
  if (!id || typeof id !== 'number') {
    return res.status(400).json({ error: 'id is required' })
  }
  if (source !== 'spoonacular' && source !== 'mealdb' && source !== 'ai') {
    return res.status(400).json({ error: 'source must be "spoonacular", "mealdb", or "ai"' })
  }

  const recipe =
    source === 'spoonacular' ? await spoonacularRecipe(id) : source === 'mealdb' ? await mealdbRecipe(id) : await getAiRecipe(id)
  if (!recipe) {
    // Every source uses its own id space, so there's no equivalent id to
    // fall back to here (unlike search/recommend, which can substitute a
    // different source's results entirely). If a Spoonacular-sourced id
    // (e.g. an old favorite) fails while quota is exhausted or the key is
    // having issues, say so plainly instead of implying the recipe itself
    // doesn't exist.
    const message =
      source === 'spoonacular'
        ? 'Could not load this recipe from Spoonacular right now (it may be rate-limited or temporarily unavailable) -- please try again later.'
        : 'Recipe not found'
    return res.status(404).json({ error: message })
  }

  res.status(200).json(await finalizeRecipe(recipe, language))
}
