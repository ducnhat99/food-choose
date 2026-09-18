const MEALDB_API_KEY = process.env.MEALDB_API_KEY || '1'
const BASE = `https://www.themealdb.com/api/json/v1/${MEALDB_API_KEY}`

export interface RecipeSummary {
  id: number
  title: string
  image: string
  source: 'spoonacular' | 'mealdb'
}

export interface RecipeDetail extends RecipeSummary {
  category: string
  area: string
  instructions: string
  ingredients: { id: number; name: string; measure: string }[]
  /** Extra stock photos (from Wikimedia Commons) for the slideshow, beyond the one real `image`. */
  images: string[]
  /**
   * YouTube video guide(s) -- TheMealDB's own strYoutube (0 or 1 entries),
   * plus a search.list result appended by finalize.ts when applicable (see
   * there for when a second entry is added vs. one replacing the other).
   */
  videoUrls: string[]
}

interface MealDbSummary {
  idMeal: string
  strMeal: string
  strMealThumb: string
  strArea?: string
}

interface MealDbRecipe {
  idMeal: string
  strMeal: string
  strMealThumb: string
  // TheMealDB's own data isn't always complete -- confirmed live (recipe
  // 53496) that strArea can be null even though every other field is
  // populated, so these can't be typed as plain non-nullable strings.
  strCategory: string | null
  strArea: string | null
  strInstructions: string
  strYoutube?: string | null
  [key: `strIngredient${number}`]: string | null | undefined
  [key: `strMeasure${number}`]: string | null | undefined
}

export async function mealdbSearch(input: {
  query?: string
  cuisine?: string
  category?: string
  mainIngredient?: string
}): Promise<RecipeSummary[]> {
  const hasQuery = !!input.query
  const hasCuisine = !!input.cuisine
  let url: URL

  if (hasQuery) {
    url = new URL(`${BASE}/search.php`)
    url.searchParams.set('s', input.query!)
  } else if (hasCuisine) {
    url = new URL(`${BASE}/filter.php`)
    url.searchParams.set('a', input.cuisine!)
  } else if (input.category) {
    url = new URL(`${BASE}/filter.php`)
    url.searchParams.set('c', input.category)
  } else if (input.mainIngredient) {
    url = new URL(`${BASE}/filter.php`)
    url.searchParams.set('i', input.mainIngredient)
  } else {
    return []
  }

  const response = await fetch(url)
  if (!response.ok) return []

  const data = (await response.json()) as { meals: MealDbSummary[] | null }
  let meals = data.meals ?? []

  // search.php returns full recipe objects (including strArea), so a name
  // search can still be narrowed by cuisine instead of the cuisine filter
  // being silently dropped whenever search text is also present.
  if (hasQuery && hasCuisine) {
    meals = meals.filter((m) => m.strArea === input.cuisine)
  }

  return meals.map((m) => ({
    id: Number(m.idMeal),
    title: m.strMeal,
    image: m.strMealThumb,
    source: 'mealdb' as const,
  }))
}

function mapMealDbRecipe(meal: MealDbRecipe): RecipeDetail {
  const ingredients: { id: number; name: string; measure: string }[] = []
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim()
    if (!name) continue
    ingredients.push({ id: i, name, measure: meal[`strMeasure${i}`]?.trim() || '' })
  }

  return {
    id: Number(meal.idMeal),
    title: meal.strMeal,
    image: meal.strMealThumb,
    // Same fallback as Spoonacular's mapRecipeInformation, for the same
    // reason -- a blank badge reads as a display bug rather than a
    // legitimately missing value, and these go through the same
    // finalizeRecipe translation pipeline so they localize to Vietnamese
    // automatically too.
    category: meal.strCategory || 'Uncategorized',
    area: meal.strArea || 'International',
    instructions: meal.strInstructions,
    ingredients,
    images: [],
    videoUrls: meal.strYoutube ? [meal.strYoutube] : [],
    source: 'mealdb',
  }
}

export async function mealdbRecipe(id: number): Promise<RecipeDetail | null> {
  const url = new URL(`${BASE}/lookup.php`)
  url.searchParams.set('i', String(id))

  const response = await fetch(url)
  if (!response.ok) return null

  const data = (await response.json()) as { meals: MealDbRecipe[] | null }
  const meal = data.meals?.[0]
  return meal ? mapMealDbRecipe(meal) : null
}

/**
 * A random recipe. `random.php` itself has no cuisine filter, so when a
 * cuisine is requested this composes the existing area-filter search (via
 * mealdbSearch) with a random pick from that list, then a full lookup --
 * the same two-step approach used everywhere else area filtering is needed.
 */
export async function mealdbRandom(cuisine?: string): Promise<RecipeDetail | null> {
  if (cuisine) {
    const candidates = await mealdbSearch({ cuisine })
    if (candidates.length === 0) return null
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    return mealdbRecipe(pick.id)
  }

  const response = await fetch(`${BASE}/random.php`)
  if (!response.ok) return null

  const data = (await response.json()) as { meals: MealDbRecipe[] | null }
  const meal = data.meals?.[0]
  return meal ? mapMealDbRecipe(meal) : null
}
