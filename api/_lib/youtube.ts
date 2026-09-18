const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

interface YoutubeSearchResponse {
  items: Array<{ id: { videoId: string } }>
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
 */
export async function searchYoutubeVideo(query: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('key', YOUTUBE_API_KEY)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', `${query} recipe`)
    url.searchParams.set('type', 'video')
    url.searchParams.set('videoEmbeddable', 'true')
    url.searchParams.set('maxResults', '1')

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`YouTube search failed: ${response.status}`)
      return null
    }

    const data = (await response.json()) as YoutubeSearchResponse
    const videoId = data.items?.[0]?.id?.videoId
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
  } catch (err) {
    console.error('YouTube search error:', err)
    return null
  }
}
