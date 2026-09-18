import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BackgroundDecoration } from './BackgroundDecoration'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabaseClient'

export function Layout() {
  const { user } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  // Prevent the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-teal-50/40">
      <BackgroundDecoration />
      <header className="border-b-2 border-teal-500 bg-white">
        <nav className="mx-auto flex max-w-4xl items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-full object-cover" />
            {t('nav.brand')}
          </Link>

          {/* Tablet/desktop: everything inline, as before. Hidden below sm --
              those widths use the hamburger + drawer instead. */}
          <Link
            to="/search"
            className="hidden text-sm text-neutral-600 hover:text-teal-600 transition-colors sm:inline"
          >
            {t('nav.search')}
          </Link>
          {user && (
            <>
              <Link
                to="/favorites"
                className="hidden text-sm text-neutral-600 hover:text-teal-600 transition-colors sm:inline"
              >
                {t('nav.favorites')}
              </Link>
              <Link
                to="/preferences"
                className="hidden text-sm text-neutral-600 hover:text-teal-600 transition-colors sm:inline"
              >
                {t('nav.preferences')}
              </Link>
            </>
          )}
          <div className="ml-auto hidden items-center gap-4 sm:flex">
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

          {/* Mobile: a single hamburger button opens the drawer below with
              every link/control instead of packing them into this row. */}
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-md border border-teal-200 text-lg leading-none text-neutral-700 hover:border-teal-400 hover:text-teal-600 sm:hidden"
          >
            <span aria-hidden="true">☰</span>
          </button>
        </nav>
      </header>

      {/* Mobile nav drawer. Always mounted (rather than conditionally
          rendered) so the open/close transform can animate; sm:hidden keeps
          it fully out of the tablet/desktop layout regardless of state. */}
      <div className={`fixed inset-0 z-50 sm:hidden ${menuOpen ? '' : 'pointer-events-none'}`}>
        <div
          onClick={closeMenu}
          aria-hidden="true"
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-64 max-w-[80%] flex-col gap-1 overflow-y-auto bg-white p-4 shadow-xl transition-transform duration-200 ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <img src="/logo.png" alt="" className="h-7 w-7 rounded-full object-cover" />
              {t('nav.brand')}
            </span>
            <button
              onClick={closeMenu}
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-neutral-500 hover:text-teal-600"
            >
              ✕
            </button>
          </div>

          <Link
            to="/search"
            onClick={closeMenu}
            className="rounded-md px-2 py-2.5 text-sm text-neutral-700 hover:bg-teal-50 hover:text-teal-600"
          >
            {t('nav.search')}
          </Link>
          {user && (
            <>
              <Link
                to="/favorites"
                onClick={closeMenu}
                className="rounded-md px-2 py-2.5 text-sm text-neutral-700 hover:bg-teal-50 hover:text-teal-600"
              >
                {t('nav.favorites')}
              </Link>
              <Link
                to="/preferences"
                onClick={closeMenu}
                className="rounded-md px-2 py-2.5 text-sm text-neutral-700 hover:bg-teal-50 hover:text-teal-600"
              >
                {t('nav.preferences')}
              </Link>
            </>
          )}

          <div className="my-2 border-t border-neutral-200" />

          <div
            role="group"
            aria-label="Language"
            className="relative mx-2 flex items-center rounded-full border border-teal-200 bg-teal-50 p-0.5 text-xs font-medium"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-teal-600 shadow-sm transition-transform duration-200 ${
                language === 'vi' ? 'translate-x-0' : 'translate-x-full'
              }`}
            />
            <button
              type="button"
              onClick={() => setLanguage('vi')}
              className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-center transition-colors ${
                language === 'vi' ? 'text-white' : 'text-neutral-600'
              }`}
            >
              Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`relative z-10 flex-1 rounded-full px-3 py-1.5 text-center transition-colors ${
                language === 'en' ? 'text-white' : 'text-neutral-600'
              }`}
            >
              English
            </button>
          </div>

          {user ? (
            <button
              onClick={() => {
                closeMenu()
                supabase.auth.signOut()
              }}
              className="rounded-md px-2 py-2.5 text-left text-sm text-neutral-700 hover:bg-teal-50 hover:text-teal-600"
            >
              {t('nav.signOut')}
            </button>
          ) : (
            <Link
              to="/login"
              onClick={closeMenu}
              className="rounded-md px-2 py-2.5 text-sm text-neutral-700 hover:bg-teal-50 hover:text-teal-600"
            >
              {t('nav.signIn')}
            </Link>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
