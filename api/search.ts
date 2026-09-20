import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateAiRecipes } from './_lib/aiRecipe.js'
import { saveAiRecipe } from './_lib/aiRecipeStore.js'
import { resolveCaller } from './_lib/auth.js'
import { searchDishImages } from './_lib/images.js'
import { mealdbSearch } from './_lib/mealdb.js'
import { DAILY_RECIPE_LIMIT, recordAndCheckRecipeUsage } from './_lib/recipeUsage.js'
import { simplifyDishNameForImageSearch } from './_lib/simplifyDishName.js'
import { spoonacularSearch } from './_lib/spoonacular.js'
import { translateToEnglish, translateToVietnamese } from './_lib/translate.js'

const AI_SEARCH_RESULT_COUNT = 6

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, cuisine, language, useAi } = req.body ?? {}
  const hasQuery = typeof query === 'string' && query.trim().length > 0
  const hasCuisine = typeof cuisine === 'string' && cuisine.trim().length > 0
  if (!hasQuery && !hasCuisine) {
    return res.status(400).json({ error: 'query or cuisine is required' })
  }

  // Applies to catalog mode too, not just AI -- both cost real resources
  // (OpenAI usage for AI mode, Spoonacular's own limited free-tier quota
  // for catalog mode). AI mode counts as AI_SEARCH_RESULT_COUNT toward the
  // limit, not 1 -- one search call generates that many distinct recipes in
  // a single OpenAI request, and the limit is meant to track actual
  // generated recipes/cost, not request count. Catalog mode's one search
  // call counts as 1 regardless of how many existing results it returns --
  // no per-result cost is incurred fetching an already-existing catalog
  // recipe, unlike an AI generation. Checked (and recorded) before doing
  // any real work, so a caller without enough left today is blocked here
  // rather than after already paying for the call.
  const caller = await resolveCaller(req)
  if (!caller.isAdmin) {
    const usage = await recordAndCheckRecipeUsage(caller.identity, useAi ? AI_SEARCH_RESULT_COUNT : 1)
    if (!usage.allowed) {
      return res.status(429).json({ error: 'recipe_limit_exceeded', limit: DAILY_RECIPE_LIMIT })
    }
  }

  let englishQuery = hasQuery ? query : undefined
  if (hasQuery && language === 'vi') {
    const [translated] = await translateToEnglish([query])
    englishQuery = translated || query
  }

  if (useAi) {
    // Always generates fresh (no fuzzy-match against previously-saved
    // ai_recipes rows) -- reusing past generations for a similar query is a
    // reasonable future enhancement, not attempted here.
    try {
      const generated = await generateAiRecipes(
        { query: englishQuery, cuisine: hasCuisine ? cuisine : undefined },
        AI_SEARCH_RESULT_COUNT,
      )
      const results = await Promise.all(
        generated.map(async (recipe) => {
          const id = await saveAiRecipe(recipe)
          let [image] = await searchDishImages(recipe.title, 1)
          // AI-invented titles essentially never match Commons' exact-phrase
          // search verbatim (see finalize.ts for the live-confirmed example)
          // -- retry with a simplified, more generic name before giving up.
          if (!image) {
            const simplified = await simplifyDishNameForImageSearch(recipe.title)
            if (simplified) [image] = await searchDishImages(simplified, 1)
          }
          return { id, title: recipe.title, image: image ?? '', source: 'ai' as const }
        }),
      )

      if (language === 'vi' && results.length > 0) {
        const titles = await translateToVietnamese(results.map((r) => r.title))
        results.forEach((r, i) => {
          r.title = titles[i] ?? r.title
        })
      }

      return res.status(200).json(results)
    } catch (err) {
      console.error('AI search error:', err)
      return res.status(502).json({ error: 'Could not generate recipes, please try again' })
    }
  }

  const input = { query: englishQuery, cuisine: hasCuisine ? cuisine : undefined }
  const results =
    (await spoonacularSearch(input)) ?? (await mealdbSearch(input))

  if (language === 'vi' && results.length > 0) {
    const titles = await translateToVietnamese(results.map((r) => r.title))
    results.forEach((r, i) => {
      r.title = titles[i] ?? r.title
    })
  }

  res.status(200).json(results)
}
