/**
 * Extracts the video id from any common YouTube URL shape (TheMealDB's own
 * strYoutube links aren't consistently formatted -- watch?v=, youtu.be/,
 * and already-an-embed URLs have all been observed) and returns an embed
 * URL, or null if the id couldn't be found.
 */
export function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/)([\w-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}
