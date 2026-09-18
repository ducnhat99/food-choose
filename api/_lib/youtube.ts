const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface YoutubeSearchResponse {
  items: Array<{ id: { videoId: string }; snippet: { title: string } }>
}

// Generic words that show up in almost every cooking-video title regardless
// of the actual dish -- excluded so the overlap score below reflects real
// dish-name matches, not every candidate scoring a free point for sharing
// "recipe"/"how to make"/"cách nấu" with every other candidate too.
const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'with', 'and', 'in', 'on', 'for', 'to', 'how', 'make', 'recipe',
  'best', 'easy', 'quick', 'simple', 'style', 'homemade', 'authentic',
  'cách', 'nấu', 'món', 'ăn', 'ngon', 'đơn', 'giản', 'nhanh', 'công', 'thức', 'tại', 'nhà',
  'với', 'của', 'là', 'và', 'cho', 'này', 'làm', 'siêu', 'hay', 'đúng', 'điệu',
])

function significantWords(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w))
}

/**
 * Extracts the video id from any common YouTube URL shape -- used by
 * finalize.ts to dedupe a freshly-searched video against a native provider
 * link that might point at the exact same video, in different URL forms
 * (watch?v=, youtu.be/, etc.) that wouldn't match as plain strings.
 */
export function extractYoutubeVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/)([\w-]{11})/)
  return match ? match[1] : null
}

/**
 * Picks whichever candidate's title shares the most significant words with
 * the dish name, instead of blindly trusting YouTube's top relevance result
 * -- confirmed by report that the top result sometimes isn't actually about
 * the recipe at all (relevance ranking also weighs channel authority,
 * view count, etc., not just title match). Falls back to the first
 * candidate (YouTube's own top pick) if nothing scores above zero, so an
 * unusual dish name with no good match still returns something rather than
 * an arbitrary pick among equally-irrelevant candidates.
 */
function bestMatchIndex(dishTitle: string, candidateTitles: string[]): number {
  const dishWords = significantWords(dishTitle)
  if (dishWords.length === 0) return 0

  let bestIndex = 0
  let bestScore = 0
  candidateTitles.forEach((title, i) => {
    const candidateWords = new Set(significantWords(title))
    const score = dishWords.filter((w) => candidateWords.has(w)).length
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  })
  return bestIndex
}

/**
 * Finds one video guide for a dish via YouTube Data API v3's search.list.
 * Optional enhancement, same contract as the other provider helpers here:
 * returns null on a missing key or any failure, never throws. search.list
 * has its own separate daily quota bucket (confirmed live against Google's
 * quota docs: 100 calls/day, 1 unit each, distinct from the 10,000-unit
 * pool shared by every other YouTube endpoint) -- only called when a recipe
 * has no native video link already (TheMealDB's strYoutube), so it's spent
 * only on Spoonacular recipes, which have no video data at all.
 *
 * `language: 'vi'` biases toward an actually Vietnamese-language video
 * (relevant for Vietnamese-cuisine dishes) -- confirmed live that YouTube's
 * `relevanceLanguage`/`regionCode` params alone only weakly nudge rankings
 * (English-language results from Western channels still dominated), but
 * searching with Vietnamese query text ("Phở Bò cách nấu" instead of "Pho
 * recipe") reliably surfaces genuine Vietnamese channels. Callers are
 * expected to already have translated `query` to Vietnamese themselves --
 * this function only adjusts the trailing keyword and the bias params.
 *
 * Requests 5 candidates instead of 1 (search.list's quota cost is 1 unit
 * per call regardless of maxResults, so this is free) and picks whichever
 * title actually shares words with `query` via bestMatchIndex, rather than
 * trusting YouTube's top relevance result unconditionally -- reported live
 * that the top result is sometimes a plausible-looking but unrelated video
 * (relevance ranking also weighs channel authority/popularity, not just
 * title match).
 */
export async function searchYoutubeVideo(
  query: string,
  options?: { language?: 'en' | 'vi' },
): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null

  try {
    const isVietnamese = options?.language === 'vi'
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('key', YOUTUBE_API_KEY)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', isVietnamese ? `${query} cách nấu` : `${query} recipe`)
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('maxResults', '5')
    if (isVietnamese) {
      url.searchParams.set('relevanceLanguage', 'vi')
      url.searchParams.set('regionCode', 'VN')
    }

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`YouTube search failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as YoutubeSearchResponse
    const items = data.items ?? []
    if (items.length === 0) return null

    const bestIndex = bestMatchIndex(
      query,
      items.map((item) => item.snippet.title),
    )
    const videoId = items[bestIndex]?.id?.videoId
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
  } catch (err) {
    console.error('YouTube search error:', err)
    return null
  }
}
