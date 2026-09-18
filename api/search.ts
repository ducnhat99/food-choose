import type { VercelRequest, VercelResponse } from '@vercel/node'
import { mealdbSearch } from './_lib/mealdb.js'
import { spoonacularSearch } from './_lib/spoonacular.js'
import { translateToEnglish, translateToVietnamese } from './_lib/translate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { query, cuisine, language } = req.body ?? {}
  const hasQuery = typeof query === 'string' && query.trim().length > 0
  const hasCuisine = typeof cuisine === 'string' && cuisine.trim().length > 0
  if (!hasQuery && !hasCuisine) {
    return res.status(400).json({ error: 'query or cuisine is required' })
  }

  let englishQuery = hasQuery ? query : undefined
  if (hasQuery && language === 'vi') {
    const [translated] = await translateToEnglish([query])
    englishQuery = translated || query
  }

  const input = { query: englishQuery, cuisine: hasCuisine ? cuisine : undefined }
  const results =
    (await spoonacularSearch(input)) ?? (await mealdbSearch(input))

  if (language === 'vi' && results.length > 0) {
    const titles = await translateToVietnamese(results.map((r) => r.title))
    results.forEach((r, i) => {
      r.title = titles[i] ?? r.title
    })
  }

  res.status(200).json(results)
}
