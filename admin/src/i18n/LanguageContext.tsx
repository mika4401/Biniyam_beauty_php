/* eslint-disable react-refresh/only-export-components -- context files legitimately export hooks alongside the provider */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUAGE_STORAGE_KEY, translations } from './translations'
import type { Language, TranslationKey } from './translations'

interface LanguageContextValue {
  language: Language
  t: (key: TranslationKey) => string
  toggleLanguage: () => void
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectSystemLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'
  const tags = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]
  return tags.some((tag) => tag?.toLowerCase().startsWith('am')) ? 'am' : 'en'
}

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return detectSystemLanguage()
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored === 'en' || stored === 'am') return stored
  return detectSystemLanguage()
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage)

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    t: (key: TranslationKey) => translations[language][key] ?? translations.en[key],
    toggleLanguage: () => setLanguageState((current) => (current === 'en' ? 'am' : 'en')),
    setLanguage: (next: Language) => setLanguageState(next),
  }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const value = useContext(LanguageContext)
  if (!value) throw new Error('Language context is unavailable')
  return value
}
