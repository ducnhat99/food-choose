const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = 'gpt-4o-mini'

interface OpenAiChatResponse {
  choices: Array<{ message: { content: string | null } }>
}

/**
 * Simplifies a dish title into a generic, common name more likely to match
 * real food photography -- used as a fallback for AI-generated recipes when
 * a search for the exact (often uniquely-branded/invented) title comes back
 * empty. Confirmed live: Wikimedia Commons has zero matches for "Vietnamese
 * Lemongrass Chicken Stir-Fry" (an AI-invented title), but 10 real, relevant
 * photos for the simplified "lemongrass chicken" -- stripping the creative
 * naming down to the closest common/generic dish name is what makes the
 * difference, since Commons' exact-phrase search (see images.ts) can only
 * match text that actually appears in a real file's title/description.
 * Returns null (not the original title) on a missing key or any failure, so
 * callers can just skip this fallback rather than retry with an unchanged
 * query.
 */
export async function simplifyDishNameForImageSearch(title: string): Promise<string | null> {
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
              'Given a recipe title, produce the simplest, most generic common name for this ' +
              'type of dish -- strip unique branding, restaurant-style flourishes, and creative ' +
              'adjectives, keeping only the core dish identity a stock food photo would realistically ' +
              'be captioned with (e.g. "Vietnamese Lemongrass Chicken Stir-Fry" -> "lemongrass ' +
              'chicken"; "Grandma\'s Sunday Best Pot Roast" -> "pot roast"). 2-4 words is usually ' +
              'right. Respond with a JSON object {"simplified": string}.',
          },
          { role: 'user', content: title },
        ],
      }),
    })

    if (!response.ok) {
      console.error(`Dish name simplification failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as OpenAiChatResponse
    const content = data.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(content) as { simplified?: unknown }

    return typeof parsed.simplified === 'string' && parsed.simplified.trim() ? parsed.simplified.trim() : null
  } catch (err) {
    console.error('Dish name simplification error:', err)
    return null
  }
}
