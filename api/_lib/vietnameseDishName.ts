const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

/**
 * Resolves the standard, commonly-used Vietnamese name for a dish, for use
 * as a YouTube search query -- distinct from a plain translateToVietnamese
 * call on the title, which produces a faithful but literal translation of
 * whatever descriptive English title the recipe provider used. Confirmed
 * live this matters for dishes with a specific traditional compound name:
 * "Vietnamese Grilled Pork with Vermicelli Noodles" translates literally to
 * "Thịt Nướng Việt Nam với Bún", but the dish is actually known as "Bún chả"
 * or "Bún thịt nướng" -- a name no literal word-for-word translation would
 * produce, since it's not a sum of the individual English words. Searching
 * with the real dish name is a much stronger signal for surfacing videos
 * that are actually about that specific dish, rather than relying entirely
 * on keyword overlap with a translated description to happen to work.
 * Returns null (not the English title) on a missing key or any failure, so
 * callers can fall back to the existing plain-translation query instead.
 */
export async function resolveVietnameseDishName(
  title: string,
  ingredientNames: string[],
): Promise<string | null> {
  if (!OPENAI_API_KEY) return null

  try {
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
              'Identify the standard, commonly-used Vietnamese name for the given dish, as it ' +
              'would typically appear in a Vietnamese recipe blog or YouTube cooking video title ' +
              '-- not a literal word-for-word translation of the English title. If this is a ' +
              'well-known traditional Vietnamese dish (e.g. phở, bún chả, gỏi cuốn, bánh xèo, chả ' +
              'giò, bún thịt nướng), respond with its real Vietnamese name, even where that name ' +
              "doesn't literally translate each English word (example: \"Grilled Pork with " +
              'Vermicelli Noodles" is properly "Bún chả" or "Bún thịt nướng", not a literal ' +
              'translation like "Thịt nướng với bún"). If it is not a specific named traditional ' +
              'dish, translate the title naturally into Vietnamese instead. Respond with a JSON ' +
              'object {"dishName": string} containing ONLY the dish name, no extra commentary.',
          },
          {
            role: 'user',
            content: `Recipe title: ${title}\nMain ingredients: ${ingredientNames.slice(0, 8).join(', ')}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error(`Vietnamese dish name lookup failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as OpenAiChatResponse
    const content = data.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(content) as { dishName?: unknown }

    return typeof parsed.dishName === 'string' && parsed.dishName.trim() ? parsed.dishName.trim() : null
  } catch (err) {
    console.error('Vietnamese dish name lookup error:', err)
    return null
  }
}
