import type { RecipeDetail } from './mealdb.js'
import { supabaseAdmin } from './supabaseAdmin.js'

/**
 * Looks up a previously-resolved video list for (source, id), so
 * finalize.ts can skip re-searching YouTube entirely on a repeat view --
 * without this, a fresh search.list call could return a different "best
 * match" on a later visit (YouTube's search ranking isn't guaranteed
 * stable across separate calls), so the same recipe could show a different
 * video every time it's opened. Returns null when there's no cached entry
 * yet (a genuinely first-ever lookup), distinct from a cached empty array
 * (a previous search found nothing, which is itself worth remembering so
 * it isn't re-searched every view either).
 */
export async function getCachedVideoUrls(
  source: RecipeDetail['source'],
  id: number,
): Promise<string[] | null> {
  if (!supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('recipe_video_cache')
    .select('video_urls')
    .eq('source', source)
    .eq('recipe_id', id)
    .maybeSingle()

  if (error || !data) return null
  return data.video_urls as string[]
}

/** Persists the final resolved video list for (source, id), so future views of the same recipe reuse it instead of searching again. Best-effort -- a failure here just means the next view re-searches, not a request-breaking error. */
export async function setCachedVideoUrls(
  source: RecipeDetail['source'],
  id: number,
  videoUrls: string[],
): Promise<void> {
  if (!supabaseAdmin) return

  await supabaseAdmin
    .from('recipe_video_cache')
    .upsert({ source, recipe_id: id, video_urls: videoUrls }, { onConflict: 'source,recipe_id' })
}
