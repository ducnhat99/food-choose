const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

export interface AiRecipeInput {
  ingredients?: string[]
  mood?: string
  timeAvailable?: number
  cuisine?: string
  category?: string
  query?: string
  dietaryRestrictions?: string[]
  dislikedIngredients?: string[]
  /**
   * Recently-generated dish titles to explicitly steer away from -- each
   * generateAiRecipe call is a stateless OpenAI request with no memory of
   * any other call, so without this, a narrow prompt (e.g. just a cuisine,
   * nothing else) reliably clusters around the same few "obvious" dishes:
   * confirmed live, 6 independent Random calls for cuisine "Vietnamese"
   * with no avoidTitles produced "lemongrass chicken" in 5 of 6. Passed by
   * api/random.ts using recent ai_recipes rows (getRecentAiRecipeTitles).
   */
  avoidTitles?: string[]
}

export interface GeneratedRecipe {
  title: string
  category: string
  area: string
  instructions: string
  ingredients: { id: number; name: string; measure: string }[]
  /** A short, friendly blurb on why this dish fits the given constraints -- unused by callers that don't need one (e.g. random/search). */
  reasoning: string
}

function buildUserPrompt(input: AiRecipeInput): string {
  return [
    input.query ? `Dish idea / search text: ${input.query}` : null,
    input.ingredients?.length ? `Ingredients on hand: ${input.ingredients.join(', ')}` : null,
    input.mood ? `Mood: ${input.mood}` : null,
    input.timeAvailable ? `Time available: ${input.timeAvailable} minutes` : null,
    input.cuisine ? `Preferred cuisine: ${input.cuisine}` : null,
    input.category ? `Category: ${input.category}` : null,
    input.dietaryRestrictions?.length
      ? `Dietary restrictions (hard requirement): ${input.dietaryRestrictions.join(', ')}`
      : null,
    input.dislikedIngredients?.length
      ? `Ingredients to avoid (hard requirement): ${input.dislikedIngredients.join(', ')}`
      : null,
    input.avoidTitles?.length
      ? `Do NOT suggest any of these dishes -- they were already recently suggested and the user ` +
        `wants something different, not a repeat or a minor variation of one of them: ` +
        `${input.avoidTitles.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

const SYSTEM_PROMPT =
  'You are a creative chef inventing original recipes from scratch (not looking up existing ones). ' +
  'Invent a realistic, genuinely cookable dish using ordinary techniques and ingredients a home ' +
  'cook could find -- not an impossible, joke, or nonsensical combination. Respect any given ' +
  'constraints (ingredients on hand, mood, time, cuisine, category); dietary restrictions and ' +
  'ingredients-to-avoid marked as hard requirements must never be violated, even if that means ' +
  'picking a less obvious dish. Write ingredient measures using standard English cooking units ' +
  '(cups, tablespoons, teaspoons, grams, etc.). Write instructions as a numbered list, one step ' +
  'per line, e.g. "1. ...\\n2. ...". Everything must be in English. Respond with a JSON object ' +
  '{"title": string, "category": string, "area": string, "instructions": string, ' +
  '"ingredients": [{"name": string, "measure": string}], "reasoning": string} -- "category" is a ' +
  'short meal-type label (e.g. "Dessert", "Beverage", "Chicken"), "area" is the cuisine/region ' +
  '(e.g. "Italian", "Vietnamese", "Fusion"), and "reasoning" is a short, friendly sentence on why ' +
  'this dish fits the given constraints.'

async function callAiRecipeModel(userPrompt: string): Promise<OpenAiChatResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      // A modest bump above the API default (1.0) for more variety between
      // separate calls -- complements avoidTitles above (which guarantees
      // no repeat of specific recent dishes) by also reducing the model's
      // general tendency to converge on the same "obvious" answer when a
      // prompt is under-specified, even the first few times before any
      // history exists to avoid.
      temperature: 1.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`)
  }

  return (await response.json()) as OpenAiChatResponse
}

interface RawGeneratedRecipe {
  title?: unknown
  category?: unknown
  area?: unknown
  instructions?: unknown
  ingredients?: unknown
  reasoning?: unknown
}

function toGeneratedRecipe(raw: RawGeneratedRecipe): GeneratedRecipe | null {
  if (
    typeof raw.title !== 'string' ||
    typeof raw.category !== 'string' ||
    typeof raw.area !== 'string' ||
    typeof raw.instructions !== 'string' ||
    !Array.isArray(raw.ingredients)
  ) {
    return null
  }

  const ingredients = raw.ingredients
    .filter((ing): ing is { name: string; measure: string } =>
      typeof ing === 'object' && ing !== null && typeof (ing as { name?: unknown }).name === 'string',
    )
    .map((ing, i) => ({
      id: i + 1,
      name: ing.name,
      measure: typeof ing.measure === 'string' ? ing.measure : '',
    }))

  if (ingredients.length === 0) return null

  return {
    title: raw.title,
    category: raw.category,
    area: raw.area,
    instructions: raw.instructions,
    ingredients,
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : '',
  }
}

/**
 * Invents one complete, original recipe matching the given constraints --
 * used by api/random.ts (AI mode) and api/recommend-dish.ts (AI mode) in
 * place of picking a real dish from Spoonacular/TheMealDB. Always generated
 * in English so the existing finalizeRecipe translation pipeline
 * (glossary.ts, translateIngredientPhrases) is the one place that handles
 * localization for every source, AI included. Throws on a missing key or a
 * malformed/unparseable model response -- callers should catch and surface
 * a clear error, same as any other OpenAI-backed feature in this app.
 */
export async function generateAiRecipe(input: AiRecipeInput): Promise<GeneratedRecipe> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

  const result = await callAiRecipeModel(buildUserPrompt(input))
  const content = result.choices[0].message.content ?? '{}'
  const parsed = toGeneratedRecipe(JSON.parse(content) as RawGeneratedRecipe)

  if (!parsed) throw new Error('Model did not return a usable recipe')
  return parsed
}

/**
 * Invents several MEANINGFULLY DIFFERENT recipes matching the given
 * constraints, for api/search.ts (AI mode). One call asking for all of them
 * together (not N independent single-recipe calls) so the model can see its
 * own list as it composes it and avoid generating near-duplicates -- calling
 * generateAiRecipe() in a loop here would give each call zero awareness of
 * what the others already produced.
 */
export async function generateAiRecipes(input: AiRecipeInput, count: number): Promise<GeneratedRecipe[]> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

  const userPrompt =
    buildUserPrompt(input) +
    `\n\nGenerate exactly ${count} meaningfully different dishes matching the above ` +
    '(different main ingredients, techniques, or styles from each other -- not variations on the ' +
    'same dish). Respond with a JSON object {"recipes": [<one object per dish, each shaped as ' +
    'described above>]} containing exactly that many entries.'

  const result = await callAiRecipeModel(userPrompt)
  const content = result.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(content) as { recipes?: unknown }

  if (!Array.isArray(parsed.recipes)) return []

  return parsed.recipes
    .map((raw) => toGeneratedRecipe(raw as RawGeneratedRecipe))
    .filter((r): r is GeneratedRecipe => r !== null)
}
