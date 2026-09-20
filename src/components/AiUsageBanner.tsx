import { ContactSupportLine } from './ContactSupportLine'
import { useLanguage } from '../context/LanguageContext'
import { useRecipeMode } from '../context/RecipeModeContext'
import { useAiUsage } from '../hooks/useAiUsage'

/**
 * A full-width strip below the header, on every page, telling a non-admin
 * caller how many AI-generated recipes they have left today -- proactively,
 * not just via AiLimitModal.tsx after they've already been blocked. Only
 * shown in AI mode (irrelevant in catalog mode, which has no limit) and
 * never for an admin, who isn't capped at all (api/_lib/aiUsage.ts).
 */
export function AiUsageBanner() {
  const { t } = useLanguage()
  const { mode } = useRecipeMode()
  const { data: aiUsage } = useAiUsage()

  if (mode !== 'ai' || !aiUsage || aiUsage.isAdmin) return null

  const message = t('ai.usageRemaining')
    .replace('{remaining}', String(aiUsage.remaining))
    .replace('{limit}', String(aiUsage.limit))

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      {message} <ContactSupportLine linkClassName="font-medium underline hover:text-amber-900" />
    </div>
  )
}
