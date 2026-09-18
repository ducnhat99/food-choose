import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { usePreferences, useSavePreferences } from '../hooks/usePreferences'

function toCsv(items: string[]) {
  return items.join(', ')
}

function fromCsv(value: string) {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function Preferences() {
  const { t } = useLanguage()
  const { data, isLoading } = usePreferences()
  const savePreferences = useSavePreferences()

  const [dietary, setDietary] = useState('')
  const [disliked, setDisliked] = useState('')
  const [cuisines, setCuisines] = useState('')

  useEffect(() => {
    if (!data) return
    setDietary(toCsv(data.dietary_restrictions))
    setDisliked(toCsv(data.disliked_ingredients))
    setCuisines(toCsv(data.cuisine_preferences))
  }, [data])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    savePreferences.mutate({
      dietary_restrictions: fromCsv(dietary),
      disliked_ingredients: fromCsv(disliked),
      cuisine_preferences: fromCsv(cuisines),
    })
  }

  if (isLoading) return <p className="text-neutral-500">{t('preferences.loading')}</p>

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('preferences.title')}</h1>
      <p className="text-neutral-600">{t('preferences.subtitle')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            {t('preferences.dietaryLabel')}
          </label>
          <input
            type="text"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            placeholder={t('preferences.dietaryPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            {t('preferences.dislikedLabel')}
          </label>
          <input
            type="text"
            value={disliked}
            onChange={(e) => setDisliked(e.target.value)}
            placeholder={t('preferences.dislikedPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            {t('preferences.cuisinesLabel')}
          </label>
          <input
            type="text"
            value={cuisines}
            onChange={(e) => setCuisines(e.target.value)}
            placeholder={t('preferences.cuisinesPlaceholder')}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-base focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 sm:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={savePreferences.isPending}
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {savePreferences.isPending ? t('preferences.saving') : t('preferences.save')}
        </button>
        {savePreferences.isSuccess && <p className="text-sm text-green-600">{t('preferences.saved')}</p>}
      </form>
    </div>
  )
}
