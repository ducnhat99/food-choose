interface CommonsImageInfo {
  url: string
  thumburl?: string
  mime: string
}

interface CommonsPage {
  title: string
  imageinfo?: CommonsImageInfo[]
}

interface CommonsSearchResponse {
  query?: { pages?: Record<string, CommonsPage> }
}

/**
 * Extra stock photos for a dish, for the RecipeDetail slideshow, sourced from
 * Wikimedia Commons (free, no API key required at all). These are NOT
 * guaranteed to be this exact dish -- Commons is a general media repository,
 * not curated food photography, so coverage is inconsistent: well-known
 * dishes usually have real photos, obscure/invented-sounding recipe titles
 * often return nothing at all (which is the correct, honest outcome --
 * better than a bogus unrelated result).
 *
 * The query is wrapped as an exact phrase (`"..."`) -- CirrusSearch (what
 * Commons runs) otherwise ORs individual words together, so a title like
 * "Vietnamese chicken salad" would match any file mentioning "chicken" OR
 * "salad" OR "food" anywhere (verified live: this pulled in Indian biriyani,
 * English roasted chicken, and unrelated Laos travel photos). Exact-phrase
 * search fixes that, at the cost of returning nothing for dish names that
 * don't appear verbatim in any file's title/description/categories -- an
 * acceptable tradeoff, since honest silence beats a wrong-dish photo.
 * `filetype:bitmap` excludes non-photo files (PDF scans, vector diagrams).
 * Never throws; returns [] on any failure so this stays a purely cosmetic,
 * optional enhancement.
 */
export async function searchDishImages(query: string, count = 6): Promise<string[]> {
  if (!query) return []

  try {
    // TheMealDB titles sometimes add a trailing English clarification, e.g.
    // "Arroz al horno (baked rice)" -- Commons file titles won't include
    // that annotation, so it would otherwise break the exact-phrase match
    // below (verified live: with the parenthetical, 0 results; without it,
    // 5 good matches).
    const withoutClarification = query.replace(/\s*\([^)]*\)\s*$/, '')
    const phrase = withoutClarification.replace(/"/g, "'")
    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', `"${phrase}" filetype:bitmap`)
    url.searchParams.set('gsrnamespace', '6')
    url.searchParams.set('gsrlimit', String(count))
    url.searchParams.set('prop', 'imageinfo')
    url.searchParams.set('iiprop', 'url|mime')
    url.searchParams.set('iiurlwidth', '800')
    url.searchParams.set('format', 'json')

    const response = await fetch(url, {
      headers: {
        // Wikimedia asks API clients to identify themselves; not enforced,
        // but avoids being treated as unidentified/anonymous traffic.
        'User-Agent': 'FoodChoose/1.0 (personal recipe app)',
      },
    })
    if (!response.ok) {
      console.error(`Wikimedia Commons search failed: ${response.status}`)
      return []
    }

    const data = (await response.json()) as CommonsSearchResponse
    const pages = Object.values(data.query?.pages ?? {})
    return pages
      .map((p) => p.imageinfo?.[0])
      .filter((info): info is CommonsImageInfo => !!info?.url && info.mime.startsWith('image/'))
      .map((info) => info.thumburl ?? info.url)
  } catch (err) {
    console.error('Wikimedia Commons search error:', err)
    return []
  }
}
