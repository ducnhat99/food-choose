import { supabaseAdmin } from './supabaseAdmin.js'
import type { RecipeDetail } from './mealdb.js'

type AiRecipeContent = Pick<RecipeDetail, 'title' | 'category' | 'area' | 'instructions' | 'ingredients'>

interface AiRecipeRow {
  id: number
  title: string
  category: string
  area: string
  instructions: string
  ingredients: RecipeDetail['ingredients']
}

/**
 * Persists a freshly AI-generated recipe to `ai_recipes` and returns its new
 * id -- so the recipe survives a page refresh, can be linked to/favorited,
 * and the app accumulates a real catalog of generated dishes over time
 * instead of discarding every generation. Throws if SUPABASE_SERVICE_ROLE_KEY
 * isn't configured (callers should have already checked supabaseAdmin isn't
 * null before doing the (costly) generation call in the first place).
 */
export async function saveAiRecipe(recipe: AiRecipeContent): Promise<number> {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')

  const { data, error } = await supabaseAdmin
    .from('ai_recipes')
    .insert({
      title: recipe.title,
      category: recipe.category,
      area: recipe.area,
      instructions: recipe.instructions,
      ingredients: recipe.ingredients,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Could not save AI recipe: ${error?.message}`)
  return data.id as number
}

/**
 * Fetches a previously-generated recipe back out by id. Returns it in the
 * same shape a fresh Spoonacular/TheMealDB fetch would produce (`image`/
 * `images`/`videoUrls` empty, left for finalizeRecipe to fill in exactly
 * like any other source) -- null if the id doesn't exist, same "not found"
 * contract as mealdbRecipe/spoonacularRecipe.
 */
export async function getAiRecipe(id: number): Promise<RecipeDetail | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('ai_recipes')
    .select('id, title, category, area, instructions, ingredients')
    .eq('id', id)
    .maybeSingle<AiRecipeRow>()

  if (error || !data) return null

  return {
    id: data.id,
    title: data.title,
    category: data.category,
    area: data.area,
    instructions: data.instructions,
    ingredients: data.ingredients,
    image: '',
    images: [],
    videoUrls: [],
    source: 'ai',
  }
}

/**
 * Titles of the most recently generated AI recipes, for api/random.ts to
 * pass as generateAiRecipe's `avoidTitles` -- each generation call is
 * stateless with no memory of any other, so without this, a narrow prompt
 * (e.g. just a cuisine) reliably converges on the same "obvious" dish
 * across separate Random taps (confirmed live: 5 of 6 independent calls
 * for "Vietnamese" all came back as some variant of lemongrass chicken).
 * Filters to the same `area` when given, so the avoid-list stays relevant
 * (a Random tap for Italian shouldn't be constrained by recent Vietnamese
 * generations) and short. Returns [] on any failure -- this is a "make
 * results more varied" nicety, never worth failing the request over.
 */
export async function getRecentAiRecipeTitles(limit: number, area?: string): Promise<string[]> {
  if (!supabaseAdmin) return []

  let query = supabaseAdmin.from('ai_recipes').select('title').order('created_at', { ascending: false }).limit(limit)
  if (area) query = query.ilike('area', area)

  const { data, error } = await query
  if (error || !data) return []
  return data.map((row) => row.title as string)
}
