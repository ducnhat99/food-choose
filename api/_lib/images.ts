import { significantWords } from './textRelevance.js'

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
 *
 * The exact-phrase wrapping above is necessary but not sufficient --
 * CirrusSearch's "exact phrase" still matches text anywhere on a file's
 * page (categories, descriptions), not just the file's own title, so a
 * page can match without actually being a photo of the dish. Confirmed
 * live: searching the simplified term "sausage and peppers" (for an
 * AI-invented "Italian Sausage and Peppers Skillet" recipe) returned two
 * genuinely on-topic photos alongside an unrelated "Spanish Paella" photo
 * and three "Feast of San Gennaro" street-festival crowd photos -- likely
 * matched via loose category/description co-occurrence rather than the
 * files actually depicting the dish. Filtered out below by checking each
 * candidate's OWN title/filename for enough word overlap with the query,
 * the same technique already proven for YouTube results in
 * bestMatchIndex (youtube.ts) -- there it picks the single best match;
 * here every candidate has to clear the bar, since multiple stock photos
 * are wanted, not just one.
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

    // Over-fetches candidates -- Commons has no per-call quota to conserve,
    // unlike YouTube's search.list -- so the relevance filter below still
    // usually leaves close to `count` genuinely relevant photos, rather
    // than whatever fraction happens to survive out of exactly `count` raw
    // candidates.
    const fetchLimit = Math.min(count * 4, 40)

    const url = new URL('https://commons.wikimedia.org/w/api.php')
    url.searchParams.set('action', 'query')
    url.searchParams.set('generator', 'search')
    url.searchParams.set('gsrsearch', `"${phrase}" filetype:bitmap`)
    url.searchParams.set('gsrnamespace', '6')
    url.searchParams.set('gsrlimit', String(fetchLimit))
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

    // Requires a candidate's own title to share at least half of the
    // query's significant words -- strict enough to reject the paella/
    // festival-photo case above (zero shared words), lenient enough that a
    // longer query (3-4 words) doesn't require every candidate to match
    // every single word, since real file titles are often a slightly
    // different phrasing of the same dish. Skips filtering entirely when
    // the query has no significant words at all (nothing meaningful to
    // compare against), same guard as bestMatchIndex.
    const queryWords = significantWords(phrase)
    const minOverlap = queryWords.length === 0 ? 0 : Math.ceil(queryWords.length / 2)
    const relevantPages =
      queryWords.length === 0
        ? pages
        : pages.filter((p) => {
            const titleWords = new Set(significantWords(p.title))
            return queryWords.filter((w) => titleWords.has(w)).length >= minOverlap
          })

    return relevantPages
      .map((p) => p.imageinfo?.[0])
      .filter((info): info is CommonsImageInfo => !!info?.url && info.mime.startsWith('image/'))
      .map((info) => info.thumburl ?? info.url)
      .slice(0, count)
  } catch (err) {
    console.error('Wikimedia Commons search error:', err)
    return []
  }
}
