import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useRecipeHistory } from '../hooks/useRecipeHistory'
import { useTranslatedTexts } from '../hooks/useTranslatedTexts'

export function History() {
  const { t } = useLanguage()
  const { data, isLoading, error } = useRecipeHistory()
  const { data: titles } = useTranslatedTexts(data?.map((h) => h.title) ?? [])

  if (isLoading) return <p className="text-neutral-500">{t('history.loading')}</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('history.title')}</h1>

      {data && data.length === 0 && <p className="text-neutral-600">{t('history.empty')}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {data?.map((entry, i) => (
          <Link
            key={entry.id}
            to={`/recipe/${entry.source}/${entry.recipe_id}`}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            {/* image_url can be '' -- recorded from recipe.image || recipe.images?.[0] || '',
                which is empty for an AI-invented dish with no real photo and no Wikimedia
                coverage either. Falls back to the app logo rather than a broken <img>. */}
            <img
              src={entry.image_url || '/logo.png'}
              alt={entry.title}
              className="h-32 w-full object-cover"
            />
            <p className="p-2 text-sm font-medium text-neutral-800">{titles[i]}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
