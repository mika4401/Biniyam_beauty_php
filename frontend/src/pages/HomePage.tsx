import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { useAcademy } from '../context/AcademyContext'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { TESTIMONIAL_I18N } from '../i18n/mappings'
import { testimonials } from '../data/testimonials'
import { ABOUT_VIDEO_URL, fadeUp } from '../constants'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'
import { ButtonLink, SectionHeading, Stat } from '../components/ui'
import { ProgramCard } from '../components/ProgramCard'
import { AboutVideo } from '../components/AboutVideo'

function CourseSkeleton() {
  return (
    <div className="animate-pulse rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
      <div className="h-48 rounded-xl bg-black/5" />
      <div className="mt-4 h-4 w-3/4 rounded bg-black/5" />
      <div className="mt-2 h-3 w-full rounded bg-black/5" />
      <div className="mt-2 h-3 w-2/3 rounded bg-black/5" />
      <div className="mt-4 h-8 w-1/3 rounded-lg bg-black/5" />
    </div>
  )
}

export function HomePage() {
  const { programs, isLoadingPrograms } = useAcademy()
  const { t } = useLanguage()
  const tTestimonials = testimonials.map((testimonial) => {
    const prefix = TESTIMONIAL_I18N[testimonial.name]
    if (!prefix) return testimonial
    return {
      ...testimonial,
      name: t(`${prefix}.name` as TranslationKey) || testimonial.name,
      role: t(`${prefix}.role` as TranslationKey) || testimonial.role,
      quote: t(`${prefix}.quote` as TranslationKey) || testimonial.quote,
    }
  })
  return <><Navbar />
    <main>
      <section className="relative flex min-h-[720px] items-end overflow-hidden bg-ink pb-16 pt-32 md:items-center md:pb-0">
        <img src="https://res.cloudinary.com/djzmclbg0/image/upload/v1787681808/homepage_byrpkr.avif" alt="Beauty artist applying makeup" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <motion.div {...fadeUp} className="relative mx-auto w-full max-w-7xl px-6 lg:px-12">
          <div className="max-w-2xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('hero.eyebrow')}</p><h1 className="font-display text-5xl font-bold leading-tight text-white md:text-6xl">{t('hero.title')}</h1><p className="mt-6 max-w-xl text-base leading-7 text-white/85">{t('hero.paragraph')}</p><div className="mt-8 flex flex-wrap gap-4"><ButtonLink to="/#courses">{t('hero.exploreCourses')}</ButtonLink><ButtonLink to="/checkout" secondary>{t('hero.checkout')}</ButtonLink></div></div>
          <div className="mt-16 grid max-w-xl grid-cols-3 border-t border-white/30 pt-6 md:mt-24"><Stat value="500+" label={t('stats.graduates')} /><Stat value="9+" label={t('stats.courses')} /><Stat value="2" label={t('stats.branches')} /></div>
        </motion.div>
      </section>
      <section id="courses" className="bg-surface px-6 py-16 md:py-24 lg:px-12"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow={t('courses.eyebrow')} title={t('courses.title')} /><div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{isLoadingPrograms ? (Array.from({ length: 6 }).map((_, i) => <CourseSkeleton key={i} />)) : programs.length > 0 ? (programs.filter((p) => p.isActive !== false).map((program) => <ProgramCard key={program.id} program={program} />)) : (<p className="col-span-full py-12 text-center text-muted">Courses are being loaded. Please wait...</p>)}</div></div></section>
      <section id="about" className="bg-card px-6 py-16 md:py-24 lg:px-12"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">{ABOUT_VIDEO_URL ? <AboutVideo /> : <img className="aspect-[4/3] w-full rounded-3xl object-cover" src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=85" alt="Beauty classroom" />}<div><p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('about.eyebrow')}</p><h2 className="mt-4 font-display text-4xl font-bold leading-tight text-charcoal">{t('about.title')}</h2><p className="mt-6 leading-7 text-muted">{t('about.paragraph')}</p></div></div></section>
      <section id="gallery" className="bg-surface px-6 py-16 md:py-24 lg:px-12"><div className="mx-auto max-w-7xl"><SectionHeading eyebrow={t('gallery.eyebrow')} title={t('gallery.title')} /><div className="mt-12 grid gap-6 lg:grid-cols-3">{tTestimonials.map((testimonial) => <motion.article {...fadeUp} key={testimonial.name} className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]"><div className="flex gap-1 text-gold">{Array.from({ length: testimonial.rating }).map((_, index) => <Star key={index} size={16} fill="currentColor" />)}</div><p className="mt-6 leading-7 text-muted">“{testimonial.quote}”</p><div className="mt-6 flex items-center gap-4"><img src={testimonial.image} alt={testimonial.name} className="h-12 w-12 rounded-full object-cover" /><div><p className="font-semibold text-charcoal">{testimonial.name}</p><p className="text-sm text-muted">{testimonial.role}</p></div></div></motion.article>)}</div></div></section>
      <section id="contact" className="bg-ink px-6 py-16 text-center md:py-24"><h2 className="font-display text-4xl font-bold text-white">{t('contact.title')}</h2><p className="mx-auto mt-4 max-w-lg leading-7 text-white/70">{t('contact.paragraph')}</p><div className="mt-8"><ButtonLink to="/checkout">{t('contact.register')}</ButtonLink></div></section>
    </main>
    <Footer />
  </>
}
