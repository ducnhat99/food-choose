import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { usePreferences } from '../hooks/usePreferences'
import { useSearchRecipes } from '../hooks/useRecipes'
import { CUISINE_LABELS_VI, CUISINES, findMatchingOption } from '../lib/cuisines'

export function Search() {
  const { t, language } = useLanguage()
  const { data: preferences } = usePreferences()
  const [input, setInput] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [query, setQuery] = useState('')
  const [queryCuisine, setQueryCuisine] = useState('')
  const { data, isLoading, error } = useSearchRecipes(query, queryCuisine || undefined, language)

  useEffect(() => {
    if (!preferences) return
    setCuisine((current) => current || findMatchingOption(preferences.cuisine_preferences, CUISINES))
  }, [preferences])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setQuery(input)
    setQueryCuisine(cuisine)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('search.title')}</h1>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search.placeholder')}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
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
          type="submit"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          {t('search.submit')}
        </button>
      </form>

      {isLoading && <p className="text-neutral-500">{t('search.loading')}</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}
      {!isLoading && !error && (query || queryCuisine) && data?.length === 0 && (
        <p className="text-neutral-600">{t('search.noResults')}</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.map((recipe) => (
          <Link
            key={recipe.id}
            to={`/recipe/${recipe.source}/${recipe.id}`}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            <img src={recipe.image} alt={recipe.title} className="h-32 w-full object-cover" />
            <p className="p-2 text-sm font-medium text-neutral-800">{recipe.title}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
