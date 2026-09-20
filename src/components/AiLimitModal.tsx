import { ContactSupportLine } from './ContactSupportLine'
import { useLanguage } from '../context/LanguageContext'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

interface AiLimitModalProps {
  onClose: () => void
}

/**
 * Shown instead of the usual inline error text when api/_lib/aiUsage.ts's
 * daily AI-generation limit is hit (api.ts's isAiLimitError) -- a plain
 * "request failed" message would leave a non-admin user thinking something
 * is broken, when this is an intentional, cost-control limit that resets
 * the next day and has a workaround (catalog mode) available right now.
 */
export function AiLimitModal({ onClose }: AiLimitModalProps) {
  const { t } = useLanguage()
  useBodyScrollLock(true)

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
        <h2 className="text-lg font-semibold text-neutral-900">{t('ai.limitTitle')}</h2>
        <p className="text-sm text-neutral-600">{t('ai.limitMessage')}</p>
        <p className="text-sm text-neutral-600">
          <ContactSupportLine linkClassName="font-medium text-teal-700 underline hover:text-teal-800" />
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          {t('ai.limitClose')}
        </button>
      </div>
    </div>
  )
}
