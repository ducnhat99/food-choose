import type { VercelRequest, VercelResponse } from '@vercel/node'
import { translateToVietnamese } from './_lib/translate.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { texts } = (req.body ?? {}) as { texts?: unknown }
  if (!Array.isArray(texts) || texts.some((t) => typeof t !== 'string')) {
    return res.status(400).json({ error: 'texts must be an array of strings' })
  }

  try {
    const translations = await translateToVietnamese(texts)
    res.status(200).json({ translations })
  } catch (err) {
    res.status(502).json({ error: (err as Error).message })
  }
}
