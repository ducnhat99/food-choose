import type { VercelRequest, VercelResponse } from '@vercel/node'
import { expandInstructions } from './_lib/expandInstructions.js'

interface ExpandRequest {
  title?: string
  ingredients?: { name: string; measure: string }[]
  instructions?: string
  language?: 'en' | 'vi'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { title, ingredients, instructions, language } = (req.body ?? {}) as ExpandRequest
  if (!title || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'title and a non-empty ingredients array are required' })
  }

  try {
    const expanded = await expandInstructions({
      title,
      ingredients,
      instructions: instructions ?? '',
      language,
    })
    res.status(200).json({ instructions: expanded })
  } catch (err) {
    console.error('Expand instructions error:', err)
    res.status(502).json({ error: 'Could not generate a detailed guide, please try again' })
  }
}
