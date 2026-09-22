import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { ImageCarousel } from '../components/ImageCarousel'
import { LoadingModal } from '../components/LoadingModal'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useExpandInstructions } from '../hooks/useExpandInstructions'
import { useRecipe } from '../hooks/useRecipes'
import { useAddFavorite } from '../hooks/useFavorites'
import { useRecordRecipeView } from '../hooks/useRecipeHistory'
import type { RecipeSource } from '../lib/api'
import { getYoutubeEmbedUrl } from '../lib/youtube'

/**
 * Splits raw instructions text into discrete steps for display. Handles the
 * real-world shapes found across both providers (verified against live
 * data): TheMealDB's "step 1\n...\n\nstep 2\n..." (English) /
 * "bước 1\n...\n\nbước 2\n..." (translated Vietnamese) markers, a bare
 * "1) ...\n2) ..." numbered-list style some TheMealDB recipes use instead,
 * and Spoonacular's HTML-derived text (converted to plain text server-side)
 * which has no markers at all -- just blank-line or single-newline
 * separated paragraphs. Falls back gracefully through each shape so any
 * instructions text renders as at least one step rather than crashing, and
 * always strips whatever marker it found so the numbered badge in the UI
 * never duplicates a number already baked into the text.
 */
function parseInstructionSteps(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  // "step 1" / "bước 1", or a bare "1." / "1)" list marker -- the `[.)]`
  // requirement (not a bare digit) avoids stripping a real number that
  // just happens to start a sentence, e.g. "350 F, preheat the oven".
  const stepMarker = /^\s*(?:(?:step|bước)\s*\d+|\d+[.)])\s*[:.]?\s*/i
  const stepMarkerLookahead = /(?=^\s*(?:(?:step|bước)\s*\d+|\d+[.)])\s*[:.]?)/im

  const byStepMarker = normalized
    .split(stepMarkerLookahead)
    .map((s) => s.replace(stepMarker, '').trim())
    .filter(Boolean)
  if (byStepMarker.length > 1) return byStepMarker

  const byBlankLine = normalized
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byBlankLine.length > 1) return byBlankLine

  const byNewline = normalized
    .split('\n')
    .map((s) => s.replace(stepMarker, '').trim())
    .filter(Boolean)
  if (byNewline.length > 1) return byNewline

  // Last-resort fallback for when the translation pipeline (translate.ts)
  // collapses an originally multi-line numbered list into one continuous
  // run-on paragraph with no line breaks at all, just inline "... phút. 4.
  // Trong khi ..." markers -- confirmed live from a real report, where
  // every step rendered as a single undifferentiated block despite the
  // English source having real newlines. translate.ts's prompt now asks
  // the model to preserve line breaks, but that's a prompt instruction,
  // not a guarantee, so this stays as a safety net regardless. Splits on a
  // digit marker that immediately follows sentence-ending punctuation plus
  // a space (". 4. ", not just "4.") -- specific enough to not misfire on
  // an ordinary mid-sentence quantity like "add 2 cups of flour", which
  // never directly follows a ". ".
  const inlineMarkerLookahead = /(?<=[.!?]\s)(?=\d{1,2}[.)]\s)/g
  const byInlineMarker = normalized
    .split(inlineMarkerLookahead)
    .map((s) => s.replace(stepMarker, '').trim())
    .filter(Boolean)
  if (byInlineMarker.length > 1) return byInlineMarker

  return byNewline
}

export function RecipeDetail() {
  const { t, language } = useLanguage()
  const { id, source } = useParams<{ id: string; source: RecipeSource }>()
  const recipeId = id ? Number(id) : undefined
  const { data: recipe, isLoading, error } = useRecipe(recipeId, source, language)
  const { user } = useAuth()
  const addFavorite = useAddFavorite()
  const expandInstructions = useExpandInstructions()
  const recordView = useRecordRecipeView()

  // Reset any previously-generated detailed guide when navigating to a
  // different recipe -- otherwise it would keep showing on the new page,
  // since React Router reuses this component across param changes.
  useEffect(() => {
    expandInstructions.reset()
  }, [recipeId, source])

  // Records this view for signed-in users' History page. Keyed on the
  // primitive id/source (not the `recipe` object itself), so switching the
  // display language -- which re-fetches a re-translated `recipe` with a new
  // object reference but the same id/source -- doesn't re-record the view.
  useEffect(() => {
    if (!user || !recipe) return
    recordView.mutate(recipe)
  }, [user, recipe?.id, recipe?.source])

  if (isLoading) return <LoadingModal message={t('recipe.loading')} />
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>
  if (!recipe) return null

  const displayedInstructions = expandInstructions.data ?? recipe.instructions
  const steps = parseInstructionSteps(displayedInstructions)
  const videoEmbedUrls = recipe.videoUrls
    .map((url) => getYoutubeEmbedUrl(url))
    .filter((url): url is string => url !== null)
  // AI-generated recipes have no real provider photo at all (`image` stays
  // '' -- finalizeRecipe only ever fills in `images`, the stock-photo
  // array), so prepending it here would show a broken image as the first
  // slide. Every image is a best-effort stock photo in that case, not just
  // the ones after index 0.
  const carouselImages = recipe.image ? [recipe.image, ...recipe.images] : recipe.images
  const carouselStockFrom = recipe.image ? 1 : 0

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">{recipe.title}</h1>
      <ImageCarousel
        images={carouselImages}
        alt={recipe.title}
        stockFrom={carouselStockFrom}
      />
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium capitalize text-teal-800">
          {recipe.category}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          {recipe.area}
        </span>
        {recipe.source === 'ai' && (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
            {t('mode.aiBadge')}
          </span>
        )}
      </div>

      {user && (
        <button
          onClick={() => addFavorite.mutate(recipe)}
          disabled={addFavorite.isPending}
          className="flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          <span aria-hidden="true">{addFavorite.isSuccess ? '❤️' : '🤍'}</span>
          {addFavorite.isPending ? t('recipe.saving') : t('recipe.save')}
        </button>
      )}

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('recipe.ingredients')}</h2>
        <ul className="list-inside list-disc text-neutral-700">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id}>
              {ing.measure ? `${ing.measure} ${ing.name}` : ing.name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('recipe.instructions')}</h2>
        <ol className="mt-3 list-none space-y-3 text-neutral-700">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white"
              >
                {i + 1}
              </span>
              <p className="whitespace-pre-line leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>

        {expandInstructions.isPending && <LoadingModal message={t('recipe.expanding')} />}

        {!expandInstructions.isSuccess && (
          <button
            type="button"
            onClick={() =>
              expandInstructions.mutate({
                title: recipe.title,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                language,
              })
            }
            disabled={expandInstructions.isPending}
            className="mt-3 rounded-md border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 hover:border-teal-400 hover:bg-teal-50 transition-colors disabled:opacity-50"
          >
            {t('recipe.expandButton')}
          </button>
        )}
        {expandInstructions.error && (
          <p className="mt-2 text-sm text-red-600">{(expandInstructions.error as Error).message}</p>
        )}
      </div>

      {videoEmbedUrls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{t('recipe.videoGuide')}</h2>
          <div className="mt-3 space-y-4">
            {videoEmbedUrls.map((embedUrl) => (
              <div key={embedUrl} className="aspect-video w-full overflow-hidden rounded-lg bg-neutral-100">
                <iframe
                  src={embedUrl}
                  title={recipe.title}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
