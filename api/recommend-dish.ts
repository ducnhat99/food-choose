import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateAiRecipe } from './_lib/aiRecipe.js'
import { saveAiRecipe } from './_lib/aiRecipeStore.js'
import { resolveCaller } from './_lib/auth.js'
import { mealdbSearch, type RecipeSummary } from './_lib/mealdb.js'
import { DAILY_RECIPE_LIMIT, recordAndCheckRecipeUsage } from './_lib/recipeUsage.js'
import { spoonacularSearch } from './_lib/spoonacular.js'
import { translateToVietnamese } from './_lib/translate.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'
const MAX_TOOL_ROUNDS = 8

interface RecommendRequest {
  ingredients?: string[]
  mood?: string
  timeAvailable?: number
  cuisine?: string
  category?: string
  dietaryRestrictions?: string[]
  dislikedIngredients?: string[]
  language?: 'en' | 'vi'
  useAi?: boolean
}

const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_recipes',
      description:
        'Search for candidate recipes. Use this before recommending a dish, so the ' +
        'recommendation is grounded in a real, fetchable recipe. Set exactly one of query, area, ' +
        'category, or mainIngredient per call (if more than one is set, only query is used, then ' +
        'area, then category, then mainIngredient, in that order). If a call returns no results, ' +
        'try again with a different single filter rather than repeating the same one. If two or ' +
        'three different filters in a row all return nothing, the requested combination (e.g. a ' +
        'specific cuisine plus a specific ingredient) may simply not exist in the catalog -- drop ' +
        'the least essential constraint (usually cuisine or category) and search by the most ' +
        'important remaining one (usually mainIngredient or a generic query) so you can still ' +
        'recommend a real dish rather than giving up.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text dish name search, e.g. "chicken curry"' },
          area: { type: 'string', description: 'Cuisine/area filter, e.g. "Vietnamese"' },
          category: { type: 'string', description: 'Category filter, e.g. "Dessert"' },
          mainIngredient: {
            type: 'string',
            description: 'A single ingredient to filter by, e.g. "chicken"',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recommend_dish',
      description:
        'Give the final recommendation. Call this only after search_recipes has returned at least one real candidate, and pick a recipeId from those results.',
      parameters: {
        type: 'object',
        properties: {
          recipeId: { type: 'number', description: 'The recipe id to recommend, from search_recipes results' },
          reasoning: { type: 'string', description: 'A short, friendly explanation for the pick' },
        },
        required: ['recipeId', 'reasoning'],
      },
    },
  },
]

/**
 * TheMealDB's category vocabulary (Beef, Chicken, Dessert, Vegetarian, ...)
 * has no single matching Spoonacular param -- map each onto whichever
 * Spoonacular filter comes closest, so the same tool args work against
 * either provider without the model needing to know which one answered.
 */
function mapCategoryToSpoonacular(category: string): {
  diet?: string
  type?: string
  includeIngredients?: string
} {
  const lower = category.toLowerCase()
  if (lower === 'vegetarian' || lower === 'vegan') return { diet: lower }
  if (lower === 'dessert' || lower === 'breakfast') return { type: lower }
  if (lower === 'side') return { type: 'side dish' }
  if (lower === 'starter') return { type: 'appetizer' }
  // Beverage has no TheMealDB equivalent at all (verified live: TheMealDB's
  // Meal database has zero drink recipes) -- it's Spoonacular-only, and
  // must map to `type`, not fall into the ingredient-hint catch-all below
  // ("beverage" isn't an ingredient).
  if (lower === 'beverage') return { type: 'beverage' }
  // Beef, Chicken, Goat, Lamb, Pork, Seafood, Pasta, Miscellaneous have no
  // Spoonacular filter equivalent -- best-effort treat as an ingredient hint.
  return { includeIngredients: lower }
}

interface RecipeInfo {
  // The tool-calling loop below only ever populates this from
  // spoonacularSearch/mealdbSearch results (never AI mode, which returns
  // early before reaching here), but reuses RecipeSummary['source'] rather
  // than a narrower literal union to stay in sync with it automatically.
  source: RecipeSummary['source']
  title: string
}

async function searchRecipes(
  input: { query?: string; area?: string; category?: string; mainIngredient?: string },
  idToRecipe: Map<number, RecipeInfo>,
) {
  const categoryMapped = input.category ? mapCategoryToSpoonacular(input.category) : {}

  const spoonacularResults = await spoonacularSearch({
    query: input.query,
    cuisine: input.area,
    diet: categoryMapped.diet,
    type: categoryMapped.type,
    includeIngredients: input.mainIngredient || categoryMapped.includeIngredients,
    number: 5,
  })

  const results =
    spoonacularResults ??
    (await mealdbSearch({
      query: input.query,
      cuisine: input.area,
      category: input.category,
      mainIngredient: input.mainIngredient,
    }))

  for (const r of results) idToRecipe.set(r.id, { source: r.source, title: r.title })

  return { results: results.slice(0, 5).map((r) => ({ id: r.id, title: r.title })) }
}

interface OpenAiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface OpenAiChatResponse {
  choices: Array<{
    message: {
      role: 'assistant'
      content: string | null
      tool_calls?: OpenAiToolCall[]
    }
  }>
}

async function callOpenAi(messages: unknown[], forceRecommend: boolean): Promise<OpenAiChatResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools,
      tool_choice: forceRecommend
        ? { type: 'function', function: { name: 'recommend_dish' } }
        : undefined,
      messages,
    }),
  })
  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as OpenAiChatResponse
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' })
  }

  const request = (req.body ?? {}) as RecommendRequest

  // Applies to catalog mode too, not just AI -- the catalog path below also
  // calls OpenAI (the tool-calling loop that grounds a pick in a real
  // search result), so it's never actually free of AI cost either, on top
  // of Spoonacular's own limited free-tier quota.
  const caller = await resolveCaller(req)
  if (!caller.isAdmin) {
    const usage = await recordAndCheckRecipeUsage(caller.identity)
    if (!usage.allowed) {
      return res.status(429).json({ error: 'recipe_limit_exceeded', limit: DAILY_RECIPE_LIMIT })
    }
  }

  if (request.useAi) {
    // AI mode invents a dish from scratch instead of grounding the pick in
    // a real search result -- the whole point of the tool-calling loop
    // below (search_recipes before recommend_dish) is to avoid hallucinating
    // a dish that doesn't exist in either catalog, which is irrelevant here.
    try {
      const generated = await generateAiRecipe(request)
      const id = await saveAiRecipe(generated)

      let title = generated.title
      let reasoning = generated.reasoning
      if (request.language === 'vi') {
        const [translatedTitle, translatedReasoning] = await translateToVietnamese([title, reasoning])
        title = translatedTitle || title
        reasoning = translatedReasoning || reasoning
      }

      return res.status(200).json({ recipeId: id, reasoning, title, source: 'ai' })
    } catch (err) {
      console.error('AI recommend-dish error:', err)
      return res.status(502).json({ error: 'Could not produce a recommendation, please try again' })
    }
  }

  const idToRecipe = new Map<number, RecipeInfo>()

  const userPrompt = [
    'Recommend one dish to cook based on this context:',
    request.ingredients?.length ? `Ingredients on hand: ${request.ingredients.join(', ')}` : null,
    request.mood ? `Mood: ${request.mood}` : null,
    request.timeAvailable ? `Time available: ${request.timeAvailable} minutes` : null,
    request.cuisine ? `Preferred cuisine: ${request.cuisine}` : null,
    request.category ? `Category: ${request.category}` : null,
    request.dietaryRestrictions?.length
      ? `Dietary restrictions (hard requirement, from the user's saved profile): ${request.dietaryRestrictions.join(', ')}`
      : null,
    request.dislikedIngredients?.length
      ? `Ingredients to avoid (hard requirement, from the user's saved profile): ${request.dislikedIngredients.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = [
    request.language === 'vi'
      ? 'Write the "reasoning" argument to recommend_dish in Vietnamese. Everything else (tool arguments like query, area, category) stays in English since the recipe providers only understand English filter values.'
      : 'Write the "reasoning" argument to recommend_dish in English.',
    (request.dietaryRestrictions?.length || request.dislikedIngredients?.length)
      ? 'The dietary restrictions and ingredients-to-avoid are hard requirements, not preferences -- never recommend a dish that violates them, even if it otherwise matches the request well. If you cannot verify a candidate respects them from its title/category alone, prefer a search_recipes call (e.g. category or mainIngredient) that steers toward something that clearly does.'
      : null,
  ]
    .filter(Boolean)
    .join(' ')

  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Once we have at least one real candidate, force a decision on the
    // final couple of rounds instead of letting the model loop indefinitely
    // re-searching (observed behavior: it sometimes never calls
    // recommend_dish even with plenty of valid results already in hand).
    const forceRecommend = idToRecipe.size > 0 && round >= MAX_TOOL_ROUNDS - 2
    const result = await callOpenAi(messages, forceRecommend)
    const message = result.choices[0].message
    const toolCalls = message.tool_calls ?? []

    const recommendCall = toolCalls.find((c) => c.function.name === 'recommend_dish')
    if (recommendCall) {
      const args = JSON.parse(recommendCall.function.arguments) as {
        recipeId: number
        reasoning: string
      }
      const recipeInfo = idToRecipe.get(args.recipeId)

      // The model is instructed to only pick an id from its own
      // search_recipes results, but never trust that blindly -- if it names
      // an id we never actually saw, returning it would send the user to a
      // recipe that 404s. Reject and make it try again with a real one.
      if (!recipeInfo) {
        messages.push(message)
        messages.push({
          role: 'user',
          content: `recipeId ${args.recipeId} was not in any search_recipes result. Call recommend_dish again with an id that actually appeared in the results.`,
        })
        continue
      }

      let title = recipeInfo.title
      if (request.language === 'vi' && title) {
        const [translated] = await translateToVietnamese([title])
        title = translated || title
      }
      return res.status(200).json({
        ...args,
        title,
        source: recipeInfo.source,
      })
    }

    if (toolCalls.length === 0) {
      // The model gave up without calling recommend_dish. If it already
      // found real candidates, don't just fail -- push it to commit to one
      // instead of wasting the search work (observed: this happens well
      // before the round budget runs out, so the last-N-rounds force above
      // never gets a chance to trigger).
      if (idToRecipe.size === 0) break
      messages.push(message)
      messages.push({
        role: 'user',
        content: 'Call recommend_dish now with the best candidate from the search results so far.',
      })
      continue
    }

    messages.push(message)
    for (const call of toolCalls) {
      const args = JSON.parse(call.function.arguments)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(await searchRecipes(args, idToRecipe)),
      })
    }
  }

  res.status(502).json({ error: 'Could not produce a recommendation, please try again' })
}
