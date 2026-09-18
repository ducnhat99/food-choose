import { useParams } from 'react-router-dom'
import { ImageCarousel } from '../components/ImageCarousel'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useRecipe } from '../hooks/useRecipes'
import { useAddFavorite } from '../hooks/useFavorites'
import type { RecipeSource } from '../lib/api'

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

  return normalized
    .split('\n')
    .map((s) => s.replace(stepMarker, '').trim())
    .filter(Boolean)
}

export function RecipeDetail() {
  const { t, language } = useLanguage()
  const { id, source } = useParams<{ id: string; source: RecipeSource }>()
  const recipeId = id ? Number(id) : undefined
  const { data: recipe, isLoading, error } = useRecipe(recipeId, source, language)
  const { user } = useAuth()
  const addFavorite = useAddFavorite()

  if (isLoading) return <p className="text-neutral-500">{t('recipe.loading')}</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>
  if (!recipe) return null

  const steps = parseInstructionSteps(recipe.instructions)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">{recipe.title}</h1>
      <ImageCarousel
        images={[recipe.image, ...recipe.images]}
        alt={recipe.title}
        stockFrom={1}
      />
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800">
          {recipe.category}
        </span>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          {recipe.area}
        </span>
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
              {ing.measure} {ing.name}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('recipe.instructions')}</h2>
        <ol className="mt-3 list-inside list-decimal space-y-3 text-neutral-700">
          {steps.map((step, i) => (
            <li key={i} className="whitespace-pre-line leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
