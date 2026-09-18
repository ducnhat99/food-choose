import type { RecipeDetail, RecipeSummary } from './mealdb.js'

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY

// Spoonacular's own supported cuisine vocabulary (verified live against
// spoonacular.com/food-api/docs). An unrecognized cuisine value doesn't
// error -- it returns HTTP 200 with an empty result set, indistinguishable
// from a real "no matches" response. Since spoonacularSearch/spoonacularRandom
// return null (not []) to signal "try the other provider," an unvalidated
// cuisine like "Jamaican" or "Polish" (real TheMealDB countries, not in this
// list) would silently short-circuit the mealdb fallback with a bogus empty
// result instead of ever reaching the provider that actually has those
// recipes. Checking against this list up front lets those cases fall
// through to mealdb correctly instead.
const SPOONACULAR_CUISINES = new Set(
  [
    'African',
    'Asian',
    'American',
    'British',
    'Cajun',
    'Caribbean',
    'Chinese',
    'Eastern European',
    'European',
    'French',
    'German',
    'Greek',
    'Indian',
    'Irish',
    'Italian',
    'Japanese',
    'Jewish',
    'Korean',
    'Latin American',
    'Mediterranean',
    'Mexican',
    'Middle Eastern',
    'Nordic',
    'Southern',
    'Spanish',
    'Thai',
    'Vietnamese',
  ].map((c) => c.toLowerCase()),
)

function isKnownSpoonacularCuisine(cuisine: string): boolean {
  return SPOONACULAR_CUISINES.has(cuisine.toLowerCase())
}

interface SpoonacularSearchResult {
  id: number
  title: string
  image: string
}

interface SpoonacularIngredient {
  id: number
  name: string
  amount: number
  unit: string
}

interface SpoonacularRecipeInformation {
  id: number
  title: string
  image: string
  cuisines: string[]
  dishTypes: string[]
  instructions: string
  extendedIngredients: SpoonacularIngredient[]
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

// Once Spoonacular fails, skip retrying it for a while instead of wasting a
// network round-trip on every subsequent call within the same warm function
// instance -- a single recommend-dish request can make up to 8 search
// rounds, and without this every one of them re-tries a call we already
// know will fail. 402 (daily quota used up) won't recover for hours, so it
// gets a long cooldown; other failures (bad key, network blip, 5xx) might
// be transient, so they get a short one.
const QUOTA_COOLDOWN_MS = 30 * 60 * 1000
const ERROR_COOLDOWN_MS = 60 * 1000
let cooldownUntil = 0

function isOnCooldown(): boolean {
  return Date.now() < cooldownUntil
}

function startCooldown(status?: number) {
  cooldownUntil = Date.now() + (status === 402 ? QUOTA_COOLDOWN_MS : ERROR_COOLDOWN_MS)
}

function mapRecipeInformation(data: SpoonacularRecipeInformation): RecipeDetail {
  return {
    id: data.id,
    title: data.title,
    image: data.image,
    // Unlike TheMealDB (where every recipe has both fields), Spoonacular's
    // cuisines/dishTypes are optional tags a recipe can simply lack --
    // confirmed live (e.g. recipe 642551 has cuisines: []) that this isn't
    // rare. A plain '' badge looks like a display bug, so fall back to a
    // generic English label here (rather than in the frontend) so it goes
    // through the same title/instructions translation pipeline in
    // finalize.ts and renders correctly in Vietnamese too.
    category: data.dishTypes?.[0] ?? 'Uncategorized',
    area: data.cuisines?.[0] ?? 'International',
    instructions: htmlToPlainText(data.instructions ?? ''),
    ingredients: data.extendedIngredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      measure: `${ing.amount} ${ing.unit}`.trim(),
    })),
    images: [],
    source: 'spoonacular',
  }
}

/**
 * Returns null on ANY failure (missing key, 401 bad key, 402 quota
 * exhausted, network error, etc.) so callers can fall back to another
 * provider without caring why Spoonacular didn't work this time.
 */
export async function spoonacularSearch(input: {
  query?: string
  cuisine?: string
  diet?: string
  type?: string
  includeIngredients?: string
  number?: number
}): Promise<RecipeSummary[] | null> {
  if (!SPOONACULAR_API_KEY || isOnCooldown()) return null
  if (!input.query && !input.cuisine && !input.diet && !input.type && !input.includeIngredients) {
    return null
  }
  if (input.cuisine && !isKnownSpoonacularCuisine(input.cuisine)) return null

  try {
    const url = new URL('https://api.spoonacular.com/recipes/complexSearch')
    url.searchParams.set('apiKey', SPOONACULAR_API_KEY)
    url.searchParams.set('number', String(input.number ?? 12))
    if (input.query) url.searchParams.set('query', input.query)
    if (input.cuisine) url.searchParams.set('cuisine', input.cuisine)
    if (input.diet) url.searchParams.set('diet', input.diet)
    if (input.type) url.searchParams.set('type', input.type)
    if (input.includeIngredients) url.searchParams.set('includeIngredients', input.includeIngredients)

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Spoonacular search failed: ${response.status}`)
      startCooldown(response.status)
      return null
    }

    const data = (await response.json()) as { results: SpoonacularSearchResult[] }
    return data.results.map((r) => ({
      id: r.id,
      title: r.title,
      image: r.image,
      source: 'spoonacular' as const,
    }))
  } catch (err) {
    console.error('Spoonacular search error:', err)
    startCooldown()
    return null
  }
}

export async function spoonacularRecipe(id: number): Promise<RecipeDetail | null> {
  if (!SPOONACULAR_API_KEY || isOnCooldown()) return null

  try {
    const url = new URL(`https://api.spoonacular.com/recipes/${id}/information`)
    url.searchParams.set('apiKey', SPOONACULAR_API_KEY)

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Spoonacular recipe lookup failed: ${response.status}`)
      startCooldown(response.status)
      return null
    }

    const data = (await response.json()) as SpoonacularRecipeInformation
    return mapRecipeInformation(data)
  } catch (err) {
    console.error('Spoonacular recipe error:', err)
    startCooldown()
    return null
  }
}

/**
 * A random recipe, optionally biased toward a cuisine via Spoonacular's
 * `include-tags` (which accepts cuisines, diets, and meal types as tags).
 * Same null-on-any-failure contract as the other functions here.
 */
export async function spoonacularRandom(cuisine?: string): Promise<RecipeDetail | null> {
  if (!SPOONACULAR_API_KEY || isOnCooldown()) return null
  // Not strictly required for correctness here (an empty recipes[] already
  // collapses to null below, so the mealdb fallback still fires) -- but
  // skips a wasted, always-empty request against a limited daily quota.
  if (cuisine && !isKnownSpoonacularCuisine(cuisine)) return null

  try {
    const url = new URL('https://api.spoonacular.com/recipes/random')
    url.searchParams.set('apiKey', SPOONACULAR_API_KEY)
    url.searchParams.set('number', '1')
    if (cuisine) url.searchParams.set('include-tags', cuisine.toLowerCase())

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Spoonacular random failed: ${response.status}`)
      startCooldown(response.status)
      return null
    }

    const data = (await response.json()) as { recipes: SpoonacularRecipeInformation[] }
    const recipe = data.recipes?.[0]
    return recipe ? mapRecipeInformation(recipe) : null
  } catch (err) {
    console.error('Spoonacular random error:', err)
    startCooldown()
    return null
  }
}
