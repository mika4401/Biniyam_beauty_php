import { motion } from 'framer-motion'
import { useLanguage } from '../i18n/LanguageContext'
import { fadeUp } from '../constants'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { ButtonLink } from '../components/ui'

export function NotFoundPage() {
  const { t } = useLanguage()
  return <><Navbar />
    <main className="grid min-h-screen place-items-center bg-surface px-6 pt-24">
      <motion.section {...fadeUp} className="flex w-full max-w-lg flex-col items-center rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-12">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/10">
          <span className="font-display text-3xl font-bold text-gold">404</span>
        </span>
        <h1 className="mt-8 font-display text-3xl font-bold text-charcoal">{t('notFound.title')}</h1>
        <p className="mt-4 leading-7 text-muted">{t('notFound.message')}</p>
        <ButtonLink to="/" secondary>{t('notFound.backHome')}</ButtonLink>
      </motion.section>
    </main>
    <Footer />
  </>
}
