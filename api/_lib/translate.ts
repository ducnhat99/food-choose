const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

async function callTranslationModel(texts: string[], systemPrompt: string): Promise<string[]> {
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ texts }) },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenAI error: ${response.status}`)
  }

  const data = (await response.json()) as OpenAiChatResponse
  const content = data.choices[0].message.content ?? '{"translations":[]}'
  const parsed = JSON.parse(content) as { translations: unknown }
  const translations = parsed.translations

  // The model is told to return exactly texts.length items in the same
  // order, but that's a prompt instruction, not a guarantee -- every caller
  // (finalize.ts especially) assigns translations[i] back to the i-th
  // input by position. If the model ever returns a shorter/longer/malformed
  // array, positions after the discrepancy silently shift, so one
  // ingredient's translated measure can land on a completely different
  // ingredient's name (observed live: a nonsensical "1 chén 2" mashup).
  // Falling back to the original, untranslated texts for the whole batch is
  // a far better failure mode than serving misaligned, meaningless text.
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    console.error(
      `Translation array length mismatch: expected ${texts.length}, got ${Array.isArray(translations) ? translations.length : typeof translations}`,
    )
    return texts
  }

  return translations
}

function translate(texts: string[], targetLanguage: 'English' | 'Vietnamese'): Promise<string[]> {
  return callTranslationModel(
    texts,
    `Translate each string in the "texts" array to ${targetLanguage}. ` +
      'Preserve any HTML tags exactly as-is, translating only the visible text content. ' +
      'Keep numbers and units of measurement recognizable. ' +
      'An empty string stays an empty string. ' +
      'Some input strings contain multiple lines, sentences, or paragraphs (e.g. a full ' +
      'set of recipe instructions) -- translate that entire string as a single unit and ' +
      'return it as one single string in the same position, never split it into multiple ' +
      'array entries no matter how many lines or steps it contains. ' +
      'Respond with a JSON object {"translations": string[]} whose length always exactly ' +
      'equals the number of items in the input "texts" array, one output per input, in the ' +
      'same order -- never more, never fewer, regardless of how long or short any individual ' +
      'input string is.',
  )
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

/**
 * Translates recipe ingredient lines (a quantity/descriptor combined with an
 * ingredient name, e.g. "1 small chili pepper", "For serving lettuce") to
 * Vietnamese -- used by finalize.ts specifically for measures that aren't a
 * recognized unit, where the whole phrase is translated together rather
 * than measure and name independently (see finalize.ts for why). The
 * generic translateToVietnamese prompt has no notion of ingredient-list
 * conventions and, confirmed live, preserves English word order literally
 * ("For serving lettuce" -> "Để phục vụ xà lách", annotation before the
 * noun) -- grammatically valid but backwards from how a Vietnamese
 * ingredient list actually reads. This prompt explicitly asks for the
 * ingredient noun first instead.
 */
export function translateIngredientPhrases(texts: string[]): Promise<string[]> {
  return callTranslationModel(
    texts,
    'Translate each string in the "texts" array to Vietnamese. Each string is a single recipe ' +
      'ingredient line that combines a quantity, size, or purpose descriptor with an ingredient ' +
      'name (e.g. "1 small chili pepper", "For serving lettuce", "2 large eggs, beaten"). ' +
      'Vietnamese ingredient lists conventionally state the ingredient noun first, with the ' +
      'quantity and any descriptor following it -- reorder words as needed to produce a natural, ' +
      'idiomatic Vietnamese ingredient line rather than a literal word-for-word translation that ' +
      'preserves English word order. For example: "1 small chili pepper" -> "1 quả ớt nhỏ" (not ' +
      '"1 nhỏ ớt"); "For serving lettuce" -> "Xà lách (dùng để ăn kèm)" or "Xà lách ăn kèm" (not ' +
      '"Để phục vụ xà lách"). Keep any numbers recognizable. An empty string stays an empty ' +
      'string. Respond with a JSON object {"translations": string[]} whose length always exactly ' +
      'equals the number of items in the input "texts" array, one output per input, in the same ' +
      'order -- never more, never fewer.',
  )
}
