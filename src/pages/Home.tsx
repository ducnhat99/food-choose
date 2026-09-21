import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RecipeLimitModal } from '../components/RecipeLimitModal'
import { LoadingModal } from '../components/LoadingModal'
import { RandomRevealModal } from '../components/RandomRevealModal'
import { useLanguage } from '../context/LanguageContext'
import { useRecipeMode } from '../context/RecipeModeContext'
import { usePreferences } from '../hooks/usePreferences'
import { useRandomRecipe } from '../hooks/useRandomRecipe'
import { useRecommendDish } from '../hooks/useRecommendDish'
import { CATEGORIES, CATEGORY_LABELS_VI, CUISINE_LABELS_VI, CUISINES, findMatchingOption } from '../lib/cuisines'
import { isRecipeLimitError, type RecipeDetail } from '../lib/api'
import { selectArrowStyle } from '../lib/selectStyle'

// Remembers the last cuisine the user picked for Random dish, for the
// duration of the browser tab -- without this, picking e.g. "Italian",
// viewing the result (navigating to /recipe/...), then coming back to Home
// remounts this component and resets its `cuisine` state to '', which the
// effect below immediately refills from the *account's saved* cuisine
// preference. If that saved preference is set (e.g. "Vietnamese"), every
// return trip to Home silently reverts the picker to it, so Random keeps
// returning Vietnamese regardless of what the user picks afterward --
// confirmed as the cause of a "random is stuck on one country" report.
const RANDOM_CUISINE_KEY = 'sk-random-dish-cuisine'

function readStoredRandomCuisine(): string | null {
  try {
    return sessionStorage.getItem(RANDOM_CUISINE_KEY)
  } catch {
    return null
  }
}

function storeRandomCuisine(value: string) {
  try {
    sessionStorage.setItem(RANDOM_CUISINE_KEY, value)
  } catch {
    // sessionStorage unavailable (private browsing, etc.) -- selection just won't survive a remount
  }
}

function RandomDish() {
  const { t, language } = useLanguage()
  const { mode } = useRecipeMode()
  const navigate = useNavigate()
  const { data: preferences } = usePreferences()
  const [cuisine, setCuisine] = useState(() => readStoredRandomCuisine() ?? '')
  const [revealRecipe, setRevealRecipe] = useState<RecipeDetail | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const { mutate, isPending, error } = useRandomRecipe()

  useEffect(() => {
    if (!preferences) return
    // Only fall back to the account preference the first time this tab ever
    // resolves a value -- once the user (or this effect itself) has picked
    // one, it's remembered in sessionStorage and this shouldn't override it
    // again on a later remount, even if that value is now ''  ("Any").
    if (readStoredRandomCuisine() !== null) return
    const initial = findMatchingOption(preferences.cuisine_preferences, CUISINES)
    setCuisine(initial)
    storeRandomCuisine(initial)
  }, [preferences])

  function handleCuisineChange(value: string) {
    setCuisine(value)
    storeRandomCuisine(value)
  }

  function handleClick() {
    setRevealRecipe(null)
    setShowModal(true)
    mutate(
      { cuisine: cuisine || undefined, language, useAi: mode === 'ai' },
      {
        onSuccess: (recipe) => setRevealRecipe(recipe),
        onError: (err) => {
          if (isRecipeLimitError(err)) {
            setShowModal(false)
            setShowLimitModal(true)
          }
        },
      },
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-teal-200 bg-linear-to-br from-teal-50 to-cyan-50 p-6">
      {showModal && (
        <RandomRevealModal
          loading={isPending}
          recipe={revealRecipe}
          onViewRecipe={() => {
            setShowModal(false)
            if (revealRecipe) navigate(`/recipe/${revealRecipe.source}/${revealRecipe.id}`)
          }}
          onClose={() => setShowModal(false)}
        />
      )}
      {showLimitModal && <RecipeLimitModal onClose={() => setShowLimitModal(false)} />}
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('home.randomTitle')}</h2>
        <p className="mt-1 text-neutral-600">{t('home.randomSubtitle')}</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <select
          value={cuisine}
          onChange={(e) => handleCuisineChange(e.target.value)}
          style={selectArrowStyle}
          className="w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 pr-8 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:w-auto sm:text-sm"
        >
          <option value="">{t('common.any')}</option>
          {CUISINES.map((c) => (
            <option key={c} value={c}>
              {language === 'vi' ? CUISINE_LABELS_VI[c] : c}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className="w-full rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50 sm:w-auto"
        >
          {t('home.randomButton')}
        </button>
      </div>
      {error && !isRecipeLimitError(error) && <p className="text-sm text-red-600">{(error as Error).message}</p>}
    </div>
  )
}

export function Home() {
  const { t, language } = useLanguage()
  const { mode } = useRecipeMode()
  const { data: preferences } = usePreferences()
  const [ingredients, setIngredients] = useState('')
  const [mood, setMood] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [category, setCategory] = useState('')
  const [applyPreferences, setApplyPreferences] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const { mutate, data, isPending, error } = useRecommendDish()

  useEffect(() => {
    if (!preferences) return
    setCuisine((current) => current || findMatchingOption(preferences.cuisine_preferences, CUISINES))
    setCategory((current) => current || findMatchingOption(preferences.dietary_restrictions, CATEGORIES))
  }, [preferences])

  const hasSavedPreferences = !!(
    preferences?.dietary_restrictions.length ||
    preferences?.disliked_ingredients.length ||
    preferences?.cuisine_preferences.length
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutate(
      {
        ingredients: ingredients
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
        mood: mood || undefined,
        timeAvailable: timeAvailable ? Number(timeAvailable) : undefined,
        cuisine: cuisine || undefined,
        category: category || undefined,
        dietaryRestrictions: applyPreferences ? preferences?.dietary_restrictions : undefined,
        dislikedIngredients: applyPreferences ? preferences?.disliked_ingredients : undefined,
        language,
        useAi: mode === 'ai',
      },
      {
        onError: (err) => {
          if (isRecipeLimitError(err)) setShowLimitModal(true)
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {isPending && <LoadingModal message={t('home.submitting')} />}
      {showLimitModal && <RecipeLimitModal onClose={() => setShowLimitModal(false)} />}
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{t('home.title')}</h1>
        <p className="mt-1 text-neutral-600">{t('home.subtitle')}</p>
      </div>

      <RandomDish />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            {t('home.ingredientsLabel')}
          </label>
          <input
            type="text"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={t('home.ingredientsPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">{t('home.moodLabel')}</label>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder={t('home.moodPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">{t('home.timeLabel')}</label>
            <input
              type="number"
              min={1}
              value={timeAvailable}
              onChange={(e) => setTimeAvailable(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              {t('home.cuisineLabel')}
            </label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              style={selectArrowStyle}
              className="mt-1 w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 pr-8 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
            >
              <option value="">{t('common.any')}</option>
              {CUISINES.map((c) => (
                <option key={c} value={c}>
                  {language === 'vi' ? CUISINE_LABELS_VI[c] : c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              {t('home.categoryLabel')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={selectArrowStyle}
              className="mt-1 w-full appearance-none rounded-md border border-neutral-300 px-3 py-2 pr-8 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
            >
              <option value="">{t('common.any')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {language === 'vi' ? CATEGORY_LABELS_VI[c] : c}
                </option>
              ))}
            </select>
          </div>
        </div>
        {hasSavedPreferences && (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-neutral-700">
            <input
              id="apply-preferences"
              type="checkbox"
              checked={applyPreferences}
              onChange={(e) => setApplyPreferences(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-teal-300 accent-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1"
            />
            <label htmlFor="apply-preferences" className="cursor-pointer select-none">
              {t('home.usingPreferences')}
            </label>
            <Link to="/preferences" className="text-teal-600 underline hover:text-teal-700">
              {t('home.editPreferencesLink')}
            </Link>
          </div>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {t('home.submit')}
        </button>
      </form>

      {error && !isRecipeLimitError(error) && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-neutral-900">{data.title}</h2>
          <p className="mt-1 text-neutral-700">{data.reasoning}</p>
          <Link
            to={`/recipe/${data.source}/${data.recipeId}`}
            className="mt-3 inline-block text-sm font-medium text-teal-600 hover:text-teal-700 underline"
          >
            {t('home.viewRecipe')}
          </Link>
        </div>
      )}
    </div>
  )
}
