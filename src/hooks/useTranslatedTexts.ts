import { useQuery } from '@tanstack/react-query'
import { translateTexts } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'

/**
 * Returns `texts` translated to Vietnamese when the active language is 'vi',
 * or the original English strings unchanged (no network call) otherwise.
 */
export function useTranslatedTexts(texts: string[]): {
  data: string[]
  isLoading: boolean
} {
  const { language } = useLanguage()
  const enabled = language === 'vi' && texts.length > 0

  const query = useQuery({
    queryKey: ['translate', texts],
    queryFn: () => translateTexts(texts),
    enabled,
  })

  if (!enabled) return { data: texts, isLoading: false }
  return { data: query.data ?? texts, isLoading: query.isLoading }
}
