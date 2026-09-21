// Generic words that show up in almost every recipe/video/photo title
// regardless of the actual dish -- excluded from significantWords() so a
// word-overlap comparison reflects real dish-name matches, not every
// candidate scoring a free point for sharing "recipe"/"the"/"with" with
// every other candidate too. Shared by youtube.ts's bestMatchIndex (picks
// the single best candidate) and images.ts's relevance filter (keeps every
// candidate good enough) -- same underlying question, "is this candidate
// actually about the same dish?", applied two different ways.
const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'with', 'and', 'in', 'on', 'for', 'to', 'how', 'make', 'recipe',
  'best', 'easy', 'quick', 'simple', 'style', 'homemade', 'authentic',
  'cách', 'nấu', 'món', 'ăn', 'ngon', 'đơn', 'giản', 'nhanh', 'công', 'thức', 'tại', 'nhà',
  'với', 'của', 'là', 'và', 'cho', 'này', 'làm', 'siêu', 'hay', 'đúng', 'điệu',
])

export function significantWords(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !TITLE_STOPWORDS.has(w))
}
