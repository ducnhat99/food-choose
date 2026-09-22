import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateAiRecipe } from './_lib/aiRecipe.js'
import { getRecentAiRecipeTitles, saveAiRecipe } from './_lib/aiRecipeStore.js'
import { resolveCaller } from './_lib/auth.js'
import { finalizeRecipe } from './_lib/finalize.js'
import { mealdbRandom } from './_lib/mealdb.js'
import { recordAndCheckRecipeUsage } from './_lib/recipeUsage.js'
import { spoonacularRandom } from './_lib/spoonacular.js'

const RECENT_TITLES_TO_AVOID = 15

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { cuisine, language, useAi } = req.body ?? {}

  // Applies to catalog mode too, not just AI -- both cost real resources
  // (OpenAI usage for AI mode, Spoonacular's own limited free-tier quota
  // for catalog mode), so the same daily + monthly cap covers either.
  const caller = await resolveCaller(req)
  if (!caller.isAdmin) {
    const usage = await recordAndCheckRecipeUsage(caller.identity)
    if (!usage.allowed) {
      return res.status(429).json({ error: 'recipe_limit_exceeded' })
    }
  }

  if (useAi) {
    try {
      // Each generation is a stateless call with no memory of any other --
      // without steering it away from what Random already just served,
      // repeated taps (especially with the same or no cuisine) reliably
      // converge on the same "obvious" dish (confirmed live). Filtered to
      // the same cuisine when one is set, so the avoid-list stays relevant.
      const avoidTitles = await getRecentAiRecipeTitles(RECENT_TITLES_TO_AVOID, cuisine)
      const generated = await generateAiRecipe({ cuisine, avoidTitles })
      const id = await saveAiRecipe(generated)
      const recipe = {
        id,
        title: generated.title,
        category: generated.category,
        area: generated.area,
        instructions: generated.instructions,
        ingredients: generated.ingredients,
        image: '',
        images: [],
        videoUrls: [],
        source: 'ai' as const,
      }
      return res.status(200).json(await finalizeRecipe(recipe, language))
    } catch (err) {
      console.error('AI random recipe error:', err)
      return res.status(502).json({ error: 'Could not generate a random recipe, please try again' })
    }
  }

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
