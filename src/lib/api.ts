import type { Language } from '../i18n/translations'
import { supabase } from './supabaseClient'

export type RecipeSource = 'spoonacular' | 'mealdb' | 'ai'

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
  /** YouTube video guide(s) -- for a Vietnamese-cuisine dish this can have up to 2 (a native provider video and a search result). */
  videoUrls: string[]
}

export interface ExpandInstructionsRequest {
  title: string
  ingredients: { name: string; measure: string }[]
  instructions: string
  language?: Language
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
  useAi?: boolean
}

export interface RecommendDishResponse {
  recipeId: number
  reasoning: string
  title: string
  source: RecipeSource
}

/**
 * Thrown by invoke() for a non-ok response. Carries the raw `error` field
 * from the response body as `code`, separate from `message` (usually the
 * same string) -- so callers that care about a *specific* backend error
 * (currently just 'ai_limit_exceeded', see isAiLimitError below) can check
 * for it without string-matching the human-readable message.
 */
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** True for the daily AI-generation limit error (api/_lib/aiUsage.ts) -- callers use this to show a dedicated modal instead of an inline error string. */
export function isAiLimitError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'ai_limit_exceeded'
}

async function invoke<T>(path: string, body: object): Promise<T> {
  // Attaches the caller's Supabase session (if any) so the backend can tell
  // a signed-in user from an anonymous one, and an admin from a regular
  // user, for the daily AI-generation limit (api/_lib/auth.ts). Harmless to
  // send on every request, including ones that ignore it entirely.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(`/api/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok) throw new ApiError(data.error ?? `Request to /api/${path} failed`, data.error)
  return data as T
}

export function searchRecipes(
  query: string,
  cuisine?: string,
  language?: Language,
  useAi?: boolean,
): Promise<RecipeSummary[]> {
  return invoke('search', { query, cuisine, language, useAi })
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

export function randomRecipe(
  cuisine?: string,
  language?: Language,
  useAi?: boolean,
): Promise<RecipeDetail> {
  return invoke('random', { cuisine, language, useAi })
}

export function translateTexts(texts: string[]): Promise<string[]> {
  return invoke<{ translations: string[] }>('translate', { texts }).then((r) => r.translations)
}

export function expandInstructions(request: ExpandInstructionsRequest): Promise<string> {
  return invoke<{ instructions: string }>('expand-instructions', request).then((r) => r.instructions)
}

export interface AiUsageInfo {
  isAdmin: boolean
  limit: number
  remaining: number
}

/** Current caller's daily AI-generation usage (api/_lib/aiUsage.ts) -- read-only, doesn't count as a use. */
export function getAiUsage(): Promise<AiUsageInfo> {
  return invoke('ai-usage', {})
}
