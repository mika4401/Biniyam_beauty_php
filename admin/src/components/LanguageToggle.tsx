import { Globe } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

export function LanguageToggle({ light = false }: { light?: boolean }) {
  const { language, toggleLanguage, t } = useLanguage()
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={t('language.toggleLabel')}
      title={t('language.toggleLabel')}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${light ? 'border-white/30 text-white hover:bg-white/10' : 'border-black/10 text-charcoal hover:bg-surface'}`}
    >
      <Globe size={15} />
      <span>{language === 'en' ? 'EN' : 'አማ'}</span>
    </button>
  )
}
