import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { useFavorites, useRemoveFavorite } from '../hooks/useFavorites'
import { useTranslatedTexts } from '../hooks/useTranslatedTexts'

export function Favorites() {
  const { t } = useLanguage()
  const { data, isLoading, error } = useFavorites()
  const removeFavorite = useRemoveFavorite()
  const { data: titles } = useTranslatedTexts(data?.map((f) => f.title) ?? [])

  if (isLoading) return <p className="text-neutral-500">{t('favorites.loading')}</p>
  if (error) return <p className="text-sm text-red-600">{(error as Error).message}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">{t('favorites.title')}</h1>

      {data && data.length === 0 && <p className="text-neutral-600">{t('favorites.empty')}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {data?.map((favorite, i) => (
          <div
            key={favorite.id}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
          >
            <Link to={`/recipe/${favorite.source}/${favorite.spoonacular_recipe_id}`}>
              <img
                src={favorite.image_url}
                alt={favorite.title}
                className="h-32 w-full object-cover"
              />
              <p className="p-2 text-sm font-medium text-neutral-800">{titles[i]}</p>
            </Link>
            <button
              onClick={() => removeFavorite.mutate(favorite.id)}
              className="w-full border-t border-neutral-200 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              {t('favorites.remove')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
