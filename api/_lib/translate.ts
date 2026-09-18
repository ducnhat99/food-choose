const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

async function translate(texts: string[], targetLanguage: 'English' | 'Vietnamese'): Promise<string[]> {
  if (texts.length === 0) return []
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured')

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
            `Translate each string in the "texts" array to ${targetLanguage}. ` +
            'Preserve any HTML tags exactly as-is, translating only the visible text content. ' +
            'Keep numbers and units of measurement recognizable. ' +
            'An empty string stays an empty string. ' +
            'Respond with a JSON object {"translations": string[]} with exactly the same length ' +
            'and order as the input array.',
        },
        { role: 'user', content: JSON.stringify({ texts }) },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`)
  }

  const data = (await response.json()) as OpenAiChatResponse
  const content = data.choices[0].message.content ?? '{"translations":[]}'
  const parsed = JSON.parse(content) as { translations: string[] }
  return parsed.translations
}

/**
 * Translates an array of English strings to Vietnamese in one batched call,
 * preserving order, empty strings, and any inline HTML tags.
 */
export function translateToVietnamese(texts: string[]): Promise<string[]> {
  return translate(texts, 'Vietnamese')
}

/**
 * Translates an array of strings (e.g. Vietnamese) to English in one batched
 * call -- used so a search query typed in Vietnamese still matches
 * Spoonacular's English-only recipe data.
 */
export function translateToEnglish(texts: string[]): Promise<string[]> {
  return translate(texts, 'English')
}
