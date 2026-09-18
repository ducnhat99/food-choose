import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LoadingModal } from '../components/LoadingModal'
import { RandomRevealModal } from '../components/RandomRevealModal'
import { useLanguage } from '../context/LanguageContext'
import { usePreferences } from '../hooks/usePreferences'
import { useRandomRecipe } from '../hooks/useRandomRecipe'
import { useRecommendDish } from '../hooks/useRecommendDish'
import { CATEGORIES, CATEGORY_LABELS_VI, CUISINE_LABELS_VI, CUISINES, findMatchingOption } from '../lib/cuisines'
import type { RecipeDetail } from '../lib/api'

function RandomDish() {
  const { t, language } = useLanguage()
  const navigate = useNavigate()
  const { data: preferences } = usePreferences()
  const [cuisine, setCuisine] = useState('')
  const [revealRecipe, setRevealRecipe] = useState<RecipeDetail | null>(null)
  const [showModal, setShowModal] = useState(false)
  const { mutate, isPending, error } = useRandomRecipe()

  useEffect(() => {
    if (!preferences) return
    setCuisine((current) => current || findMatchingOption(preferences.cuisine_preferences, CUISINES))
  }, [preferences])

  function handleClick() {
    setRevealRecipe(null)
    setShowModal(true)
    mutate(
      { cuisine: cuisine || undefined, language },
      { onSuccess: (recipe) => setRevealRecipe(recipe) },
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
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('home.randomTitle')}</h2>
        <p className="mt-1 text-neutral-600">{t('home.randomSubtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {t('home.randomButton')}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
    </div>
  )
}

export function Home() {
  const { t, language } = useLanguage()
  const { data: preferences } = usePreferences()
  const [ingredients, setIngredients] = useState('')
  const [mood, setMood] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [category, setCategory] = useState('')
  const [applyPreferences, setApplyPreferences] = useState(true)
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
    mutate({
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
    })
  }

  return (
    <div className="space-y-6">
      {isPending && <LoadingModal message={t('home.submitting')} />}
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
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">{t('home.moodLabel')}</label>
          <input
            type="text"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
            placeholder={t('home.moodPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">{t('home.timeLabel')}</label>
            <input
              type="number"
              min={1}
              value={timeAvailable}
              onChange={(e) => setTimeAvailable(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              {t('home.cuisineLabel')}
            </label>
            <select
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
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

      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

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
