import { motion } from 'framer-motion'
import { ArrowUpRight, Calendar, CheckCircle, Clock3, CreditCard, MapPin } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fadeUp } from '../constants'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { ButtonLink } from '../components/ui'

export function AboutPage() {
  const { t } = useLanguage()
  const cards = [
    { icon: <MapPin size={28} />, title: t('aboutPage.branches.title'), description: t('aboutPage.branches.description') },
    { icon: <Clock3 size={28} />, title: t('aboutPage.quickTraining.title'), description: t('aboutPage.quickTraining.description') },
    { icon: <CheckCircle size={28} />, title: t('aboutPage.certification.title'), description: t('aboutPage.certification.description') },
    { icon: <CreditCard size={28} />, title: t('aboutPage.halfPayment.title'), description: t('aboutPage.halfPayment.description') },
    { icon: <Calendar size={28} />, title: t('aboutPage.schedule.title'), description: t('aboutPage.schedule.description') },
    { icon: <ArrowUpRight size={28} />, title: t('aboutPage.jobs.title'), description: t('aboutPage.jobs.description') },
  ]
  return <><Navbar />
    <main>
      <section className="relative flex min-h-[460px] items-center overflow-hidden bg-ink pt-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=2000&q=90')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/55" />
        <motion.div {...fadeUp} className="relative mx-auto w-full max-w-7xl px-6 lg:px-12">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">Biniyam Beauty Academy</p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-tight text-white md:text-6xl">{t('aboutPage.title')}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/85">{t('aboutPage.paragraph')}</p>
        </motion.div>
      </section>
      <section className="bg-surface px-6 py-16 md:py-24 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <motion.div {...fadeUp} className="rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]">
              <p className="font-display text-4xl font-bold text-gold">500+</p>
              <p className="mt-2 text-sm text-muted">{t('aboutPage.stats.students')}</p>
            </motion.div>
            <motion.div {...fadeUp} className="rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]">
              <p className="font-display text-4xl font-bold text-gold">98%</p>
              <p className="mt-2 text-sm text-muted">{t('aboutPage.stats.graduationRate')}</p>
            </motion.div>
            <motion.div {...fadeUp} className="rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]">
              <p className="font-display text-4xl font-bold text-gold">90%</p>
              <p className="mt-2 text-sm text-muted">{t('aboutPage.stats.placementRate')}</p>
            </motion.div>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, index) => (
              <motion.article key={index} {...fadeUp} className="rounded-[20px] bg-card p-8 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
                <span className="grid h-14 w-14 place-items-center rounded-[14px] bg-gold/10 text-gold">{card.icon}</span>
                <h3 className="mt-6 font-display text-2xl font-bold text-charcoal">{card.title}</h3>
                <p className="mt-4 leading-7 text-muted">{card.description}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-ink px-6 py-16 text-center md:py-24">
        <h2 className="font-display text-4xl font-bold text-white">{t('aboutPage.cta.title')}</h2>
        <div className="mt-8"><ButtonLink to="/checkout">{t('aboutPage.cta.button')}</ButtonLink></div>
      </section>
    </main>
    <Footer />
  </>
}
