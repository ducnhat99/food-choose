const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

/**
 * Rewrites a recipe's (often terse, sometimes provider-empty) instructions
 * into a more detailed step-by-step guide, on demand -- an explicit user
 * action, not something run automatically on every recipe view, since it's
 * an extra OpenAI call with no benefit for recipes whose instructions are
 * already good. Grounded in the recipe's own title/ingredients/instructions
 * so it elaborates on the real recipe rather than inventing a different one.
 */
export async function expandInstructions(input: {
  title: string
  ingredients: { name: string; measure: string }[]
  instructions: string
  language?: 'en' | 'vi'
}): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

  const languageName = input.language === 'vi' ? 'Vietnamese' : 'English'
  const ingredientList = input.ingredients.map((ing) => `${ing.measure} ${ing.name}`.trim()).join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a cooking assistant. Rewrite the given recipe instructions as a more ' +
            'detailed, clear, step-by-step guide for a home cook. Add helpful detail such as ' +
            'approximate timing, temperature, doneness cues, and brief technique tips where ' +
            'genuinely useful. Do not invent ingredients, equipment, or steps that are not ' +
            'implied by the original instructions and ingredient list -- only elaborate on what ' +
            'is already there, and keep the same overall sequence of steps. If the original ' +
            'instructions are empty or extremely sparse, use the ingredient list and recipe title ' +
            'to write a plausible, standard step-by-step method for that dish, using ordinary ' +
            'techniques -- do not fabricate uncommon or exotic steps. Format the output as a ' +
            'numbered list, one step per line, e.g. "1. ...\\n2. ...". ' +
            `Write entirely in ${languageName}. ` +
            'Respond with a JSON object {"instructions": string}.',
        },
        {
          role: 'user',
          content: `Recipe: ${input.title}\n\nIngredients:\n${ingredientList}\n\nOriginal instructions:\n${input.instructions || '(none provided)'}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`)
  }

  const data = (await response.json()) as OpenAiChatResponse
  const content = data.choices[0].message.content ?? '{}'
  const parsed = JSON.parse(content) as { instructions?: unknown }

  if (typeof parsed.instructions !== 'string' || !parsed.instructions.trim()) {
    throw new Error('Model did not return instructions')
  }

  return parsed.instructions
}
