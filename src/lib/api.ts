import type { Language } from '../i18n/translations'

export type RecipeSource = 'spoonacular' | 'mealdb'

export interface RecipeSummary {
  id: number
  title: string
  image: string
  source: RecipeSource
}

export interface RecipeDetail extends RecipeSummary {
  category: string
  area: string
  instructions: string
  ingredients: { id: number; name: string; measure: string }[]
  /** Extra stock photos for the slideshow -- not guaranteed to be this exact dish. */
  images: string[]
}

export interface RecommendDishRequest {
  ingredients?: string[]
  mood?: string
  timeAvailable?: number
  cuisine?: string
  category?: string
  dietaryRestrictions?: string[]
  dislikedIngredients?: string[]
  language?: Language
}

export interface RecommendDishResponse {
  recipeId: number
  reasoning: string
  title: string
  source: RecipeSource
}

async function invoke<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? `Request to /api/${path} failed`)
  return data as T
}

export function searchRecipes(
  query: string,
  cuisine?: string,
  language?: Language,
): Promise<RecipeSummary[]> {
  return invoke('search', { query, cuisine, language })
}

export function getRecipe(
  id: number,
  source: RecipeSource,
  language?: Language,
): Promise<RecipeDetail> {
  return invoke('recipe', { id, source, language })
}

export function recommendDish(request: RecommendDishRequest): Promise<RecommendDishResponse> {
  return invoke('recommend-dish', request)
}

export function randomRecipe(cuisine?: string, language?: Language): Promise<RecipeDetail> {
  return invoke('random', { cuisine, language })
}

export function translateTexts(texts: string[]): Promise<string[]> {
  return invoke<{ translations: string[] }>('translate', { texts }).then((r) => r.translations)
}
