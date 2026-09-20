import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import type { RecipeDetail } from '../lib/api'

interface RandomRevealModalProps {
  loading: boolean
  recipe: RecipeDetail | null
  onViewRecipe: () => void
  onClose: () => void
}

const STEP_DELAY_MS = 550

/**
 * A staged "pack opening" reveal for the random dish feature -- category,
 * then cuisine, then the photo, then the dish name, each popping in with a
 * short delay, instead of just dumping everything on screen at once.
 */
export function RandomRevealModal({ loading, recipe, onViewRecipe, onClose }: RandomRevealModalProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)

  useBodyScrollLock(true)

  useEffect(() => {
    if (loading || !recipe) {
      setStep(0)
      return
    }
    const timers = [1, 2, 3, 4].map((n) => setTimeout(() => setStep(n), STEP_DELAY_MS * n))
    return () => timers.forEach(clearTimeout)
  }, [loading, recipe])

  const revealed = (n: number) => step >= n

  // recipe.image (the provider's own "real photo") is empty for AI-generated
  // recipes -- finalizeRecipe only ever populates the stock-photo `images`
  // array for those, never `image` (same gap fixed in RecipeDetail.tsx's
  // ImageCarousel). And even `images` can come back empty (e.g. an obscure
  // or invented dish with no Wikimedia coverage at all). Falls back to the
  // app logo rather than leaving the photo circle empty in either case.
  const previewImage = recipe?.image || recipe?.images[0] || '/logo.png'

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-xs flex-col items-center gap-4 overflow-hidden rounded-2xl bg-linear-to-br from-teal-900 via-teal-800 to-cyan-900 px-6 py-10 text-center shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 text-lg text-teal-200 hover:text-white"
        >
          ✕
        </button>

        {loading || !recipe ? (
          <>
            <div className="animate-bounce text-6xl">🎁</div>
            <p className="font-semibold text-teal-50">{t('home.randomLoading')}</p>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <span
                className={`rounded-full bg-teal-100 px-3 py-1 text-xs font-medium capitalize text-teal-800 transition-all duration-500 ${
                  revealed(1) ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                }`}
              >
                {recipe.category}
              </span>
              <span
                className={`rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 transition-all duration-500 ${
                  revealed(2) ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                }`}
              >
                {recipe.area}
              </span>
            </div>

            <div
              className={`h-32 w-32 overflow-hidden rounded-full border-4 border-teal-100 shadow-lg transition-all duration-700 ${
                revealed(3) ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            >
              {revealed(3) && (
                <img src={previewImage} alt={recipe.title} className="h-full w-full object-cover" />
              )}
            </div>

            <h2
              className={`text-xl font-bold text-white transition-all duration-500 ${
                revealed(4) ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
              }`}
            >
              {revealed(4) ? recipe.title : ' '}
            </h2>

            {revealed(4) && (
              <button
                onClick={onViewRecipe}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50"
              >
                {t('home.viewRecipe')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
