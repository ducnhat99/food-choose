import { Link, Outlet } from 'react-router-dom'
import { BackgroundDecoration } from './BackgroundDecoration'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabaseClient'

export function Layout() {
  const { user } = useAuth()
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="min-h-screen bg-teal-50/40">
      <BackgroundDecoration />
      <header className="border-b-2 border-teal-500 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-1.5 text-lg font-semibold text-neutral-900">
            <span aria-hidden="true">🍲</span>
            {t('nav.brand')}
          </Link>
          <Link to="/search" className="text-sm text-neutral-600 hover:text-teal-600 transition-colors">
            {t('nav.search')}
          </Link>
          {user && (
            <>
              <Link to="/favorites" className="text-sm text-neutral-600 hover:text-teal-600 transition-colors">
                {t('nav.favorites')}
              </Link>
              <Link to="/preferences" className="text-sm text-neutral-600 hover:text-teal-600 transition-colors">
                {t('nav.preferences')}
              </Link>
            </>
          )}
          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')}
              className="rounded-md border border-teal-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:border-teal-400 hover:text-teal-600 transition-colors"
            >
              {language === 'en' ? 'VI' : 'EN'}
            </button>
            {user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm text-neutral-600 hover:text-teal-600 transition-colors"
              >
                {t('nav.signOut')}
              </button>
            ) : (
              <Link to="/login" className="text-sm text-neutral-600 hover:text-teal-600 transition-colors">
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
