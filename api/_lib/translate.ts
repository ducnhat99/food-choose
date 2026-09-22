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
      'Preserve the exact line-break structure of the input in your output: if a step or ' +
      'sentence starts on its own new line in the input (e.g. numbered steps like "1. ...\\n2. ' +
      '..." or "Step 1: ...\\nStep 2: ..."), the translated version of each step must ALSO start ' +
      'on its own new line, in the same position, using the same "\\n" separators -- never merge ' +
      'multiple lines/steps into one continuous run-on paragraph, even if that reads more ' +
      'naturally as prose. The line-break positions in your output must match the line-break ' +
      'positions in the input one-for-one. ' +
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
 * Translates recipe ingredient text to Vietnamese -- either a standalone
 * ingredient name (e.g. "strawberry puree") or a quantity/descriptor
 * combined with a name (e.g. "1 small chili pepper", "For serving
 * lettuce"). Used by finalize.ts for every ingredient name/measure the
 * glossary doesn't cover, instead of the generic translateToVietnamese, for
 * two reasons confirmed live:
 *
 * 1. Word order: the generic prompt preserves English order literally
 *    ("For serving lettuce" -> "Để phục vụ xà lách", annotation before the
 *    noun) -- grammatically valid but backwards from how a Vietnamese
 *    ingredient list actually reads. This prompt asks for the noun first.
 * 2. Completeness: for less common culinary terms, the generic prompt
 *    sometimes leaves part of the term as an untranslated English loanword
 *    instead of finding a real Vietnamese equivalent -- confirmed live:
 *    "seltzer water" -> "nước seltzer" (only "water" translated),
 *    "turbinado sugar" -> "đường turbinado" (only "sugar" translated),
 *    "strawberry puree" -> "syrup dâu tây" (wrong word entirely, and still
 *    English). This prompt explicitly requires translating every word.
 * 3. Unit preference: some US recipes measure a solid ingredient by length
 *    ("1 inch fresh ginger", "2 inch cinnamon stick") instead of weight --
 *    confirmed live that Spoonacular has no gram equivalent for these
 *    either (even its own metric conversion leaves "inch" as "inch", since
 *    length-to-weight depends on the specific piece's thickness/density,
 *    not a fixed factor), and the generic/prior prompt just left "inch"
 *    untranslated ("1 inch fresh ginger" -> "1 inch gừng tươi"). Per
 *    explicit request, this prompt has the model estimate a reasonable
 *    gram weight instead (using its general knowledge of typical ingredient
 *    sizes) and mark it as approximate, since it can't be an exact
 *    conversion.
 */
export function translateIngredientPhrases(texts: string[]): Promise<string[]> {
  return callTranslationModel(
    texts,
    'Translate each string in the "texts" array to Vietnamese. Each string is recipe ingredient ' +
      'text -- either a standalone ingredient/food name (e.g. "strawberry puree", "turbinado ' +
      'sugar") or one combined with a quantity, size, or purpose descriptor (e.g. "1 small chili ' +
      'pepper", "For serving lettuce", "2 large eggs, beaten"). ' +
      'Translate every word fully into natural Vietnamese -- do not leave any word as an ' +
      'untranslated English loanword just because it is a less common or technical culinary term. ' +
      'Find the closest real Vietnamese culinary term or a plain descriptive translation instead ' +
      '(only true proper nouns/brand names may stay as-is). For example: "seltzer water" -> ' +
      '"nước có ga" or "nước soda" (not "nước seltzer"); "turbinado sugar" -> "đường thô" (not ' +
      '"đường turbinado"); "strawberry puree" -> "dâu tây xay nhuyễn" or "sốt dâu tây nghiền" (not ' +
      '"syrup dâu tây" or "puree dâu tây"). ' +
      'When there is a quantity/descriptor combined with a name, Vietnamese ingredient lists ' +
      'conventionally state the ingredient noun first, with the quantity and any descriptor ' +
      'following it -- reorder words as needed to produce a natural, idiomatic Vietnamese ' +
      'ingredient line rather than a literal word-for-word translation that preserves English word ' +
      'order. For example: "1 small chili pepper" -> "1 quả ớt nhỏ" (not "1 nhỏ ớt"); "For serving ' +
      'lettuce" -> "Xà lách (dùng để ăn kèm)" or "Xà lách ăn kèm" (not "Để phục vụ xà lách"). ' +
      'If a measure describes the LENGTH of a piece of a solid ingredient (inch, inches, cm, ' +
      'centimeter -- e.g. "1 inch fresh ginger", "2 inch cinnamon stick"), convert it to an ' +
      "approximate weight in grams instead of keeping the length unit, using your knowledge of " +
      'that ingredient\'s typical size/density to estimate a reasonable gram value, and prefix the ' +
      'number with "khoảng" (approximately) since it is an estimate, not an exact conversion. For ' +
      'example: "1 inch fresh ginger" -> "khoảng 10g gừng tươi" (not "1 inch gừng tươi"); "2 inch ' +
      'cinnamon stick" -> "khoảng 5g quế cây". Do not do this for measures already in weight/volume ' +
      'units (grams, cups, tablespoons, etc.) -- only for length-based ones. ' +
      'Keep any other numbers recognizable. An empty string stays an empty string. Respond with a JSON ' +
      'object {"translations": string[]} whose length always exactly equals the number of items ' +
      'in the input "texts" array, one output per input, in the same order -- never more, never ' +
      'fewer.',
  )
}
