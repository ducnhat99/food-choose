import { ContactSupportLine } from './ContactSupportLine'
import { useLanguage } from '../context/LanguageContext'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useRecipeUsage } from '../hooks/useRecipeUsage'

interface RecipeLimitModalProps {
  onClose: () => void
}

/**
 * Shown instead of the usual inline error text when api/_lib/recipeUsage.ts's
 * daily OR monthly recipe limit is hit (api.ts's isRecipeLimitError) -- a
 * plain "request failed" message would leave a non-admin user thinking
 * something is broken, when this is an intentional, cost-control limit
 * (applying to catalog mode just as much as AI mode -- Spoonacular's own
 * quota is just as finite as OpenAI's) that simply resets on its own.
 *
 * Reads useRecipeUsage() itself rather than taking the exceeded numbers as
 * props -- the blocked request already recorded its attempt server-side
 * (recordAndCheckRecipeUsage increments before checking), so refetching
 * here shows the caller's current daily/monthly standing directly, without
 * every caller needing to thread the 429 response's numbers through.
 * Whichever of the two is at 0 is self-evidently the one that was just
 * hit -- no separate "which limit" flag needed.
 */
export function RecipeLimitModal({ onClose }: RecipeLimitModalProps) {
  const { t } = useLanguage()
  const { data: usage } = useRecipeUsage()
  useBodyScrollLock(true)

  const message = usage
    ? t('usage.limitMessage')
        .replace('{dailyRemaining}', String(usage.dailyRemaining))
        .replace('{dailyLimit}', String(usage.dailyLimit))
        .replace('{monthlyRemaining}', String(usage.monthlyRemaining))
        .replace('{monthlyLimit}', String(usage.monthlyLimit))
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex h-dvh w-dvw items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-white px-6 py-8 text-center shadow-2xl"
      >
        <div className="text-4xl" aria-hidden="true">
          ⏳
        </div>
        <h2 className="text-lg font-semibold text-neutral-900">{t('usage.limitTitle')}</h2>
        {message && <p className="text-sm text-neutral-600">{message}</p>}
        <p className="text-sm text-neutral-600">
          <ContactSupportLine linkClassName="font-medium text-teal-700 underline hover:text-teal-800" />
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          {t('usage.limitClose')}
        </button>
      </div>
    </div>
  )
}
