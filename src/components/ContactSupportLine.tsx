import { useLanguage } from '../context/LanguageContext'
import { SUPPORT_EMAIL } from '../lib/support'

interface ContactSupportLineProps {
  linkClassName?: string
}

/**
 * Renders ai.contactMessage ("Contact {email} for more support.") with
 * SUPPORT_EMAIL as a real mailto: link in place of its {email} placeholder,
 * rather than a plain string -- split on the placeholder so the email can
 * sit inline, mid-sentence. Shared by AiUsageBanner.tsx and AiLimitModal.tsx.
 */
export function ContactSupportLine({ linkClassName = 'font-medium underline' }: ContactSupportLineProps) {
  const { t } = useLanguage()
  const [before, after] = t('ai.contactMessage').split('{email}')

  return (
    <>
      {before}
      <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClassName}>
        {SUPPORT_EMAIL}
      </a>
      {after}
    </>
  )
}
