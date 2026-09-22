import { ContactSupportLine } from './ContactSupportLine'
import { useLanguage } from '../context/LanguageContext'
import { useRecipeUsage } from '../hooks/useRecipeUsage'

/**
 * A full-width strip below the header, on every page, telling a non-admin
 * caller how many recipes they have left today -- proactively, not just via
 * RecipeLimitModal.tsx after they've already been blocked. Shown regardless
 * of catalog/AI mode -- both cost real resources (OpenAI usage for AI mode,
 * Spoonacular's own limited free-tier quota for catalog mode) -- and never
 * for an admin, who isn't capped at all (api/_lib/recipeUsage.ts).
 */
export function RecipeUsageBanner() {
  const { t } = useLanguage()
  const { data: usage } = useRecipeUsage()

  if (!usage || usage.isAdmin) return null

  const message = t('usage.remaining')
    .replace('{dailyRemaining}', String(usage.dailyRemaining))
    .replace('{dailyLimit}', String(usage.dailyLimit))
    .replace('{monthlyRemaining}', String(usage.monthlyRemaining))
    .replace('{monthlyLimit}', String(usage.monthlyLimit))

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
      {message} <ContactSupportLine linkClassName="font-medium underline hover:text-amber-900" />
    </div>
  )
}
