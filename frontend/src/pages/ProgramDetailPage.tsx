import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Clock3, CreditCard, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAcademy } from '../context/AcademyContext'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { PROGRAM_I18N } from '../i18n/mappings'
import type { CartItem } from '../utils/cart'
import { formatPrice, fadeUp } from '../constants'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function ProgramDetailPage() {
  const { id } = useParams()
  const { programs, isLoadingPrograms } = useAcademy()
  const { addItem, isInCart } = useCart()
  const { t, language } = useLanguage()
  const program = programs.find((item) => item.id === id)
  // While programs are still loading, show a loading state instead of redirecting
  if (isLoadingPrograms && !program) return <><Navbar /><main className="bg-surface flex min-h-screen items-center justify-center pt-24"><p className="text-muted">Loading course...</p></main><Footer /></>
  if (!program) return <Navigate to="/" replace />
  const inCart = isInCart(program.id)
  const cartItem: CartItem = { programId: program.id, title: program.title, price: program.price, allowsHalfPayment: program.allowsHalfPayment, image: program.image }
  const i18nPrefix = PROGRAM_I18N[program.id]
  const hardcoded = (key: string) => (i18nPrefix ? t(`${i18nPrefix}.${key}` as TranslationKey) : '') || ''
  // Prefer DB Amharic fields, then the hardcoded seed translations, then English
  const isAm = language === 'am'
  const title = isAm ? (program.titleAm || hardcoded('title') || program.title) : program.title
  const fullDescription = isAm ? (program.fullDescriptionAm || hardcoded('fullDescription') || program.fullDescription) : program.fullDescription
  const duration = isAm ? (program.durationAm || hardcoded('duration') || program.duration) : program.duration
  const included = isAm
    ? program.included.map((item, index) => program.includedAm?.[index] || hardcoded(`included.${index + 1}`) || item)
    : program.included
  return <><Navbar /><main className="bg-surface pt-24"><section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:py-24 lg:grid-cols-2 lg:px-12"><img src={program.image} alt={title} className="aspect-[4/3] w-full rounded-3xl object-cover" /><motion.div {...fadeUp}><p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('program.professionalProgramme')}</p><h1 className="mt-4 font-display text-4xl font-bold leading-tight text-charcoal md:text-5xl">{title}</h1><div className="mt-6 flex gap-6 text-sm text-muted"><span className="flex items-center gap-2"><Clock3 size={18} className="text-gold" />{duration}</span><span className="flex items-center gap-2"><CreditCard size={18} className="text-gold" />{formatPrice(program.price)}</span></div><p className="mt-6 leading-7 text-muted">{fullDescription}</p><h2 className="mt-8 font-display text-2xl font-bold text-charcoal">{t('program.whatsIncluded')}</h2><ul className="mt-4 grid gap-3">{included.map((item) => <li key={item} className="flex items-center gap-3 text-sm text-muted"><span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-gold"><Check size={14} /></span>{item}</li>)}</ul><div className="mt-8 flex flex-wrap gap-4"><Link to="/#courses" className="inline-flex items-center justify-center rounded-[14px] border border-black/10 bg-card dark:border-white/10 px-6 py-4 text-sm font-semibold text-charcoal transition hover:-translate-y-0.5 hover:border-gold hover:text-gold"><ArrowLeft size={16} className="mr-2" />{t('program.backToCourses')}</Link><button disabled={inCart} onClick={() => addItem(cartItem)} className={`inline-flex items-center justify-center rounded-[14px] px-6 py-4 text-sm font-semibold transition ${inCart ? 'bg-success/15 text-success cursor-default' : 'bg-gold text-white hover:-translate-y-0.5'}`}>{inCart ? <><Check size={16} className="mr-2" />{t('program.inCart')}</> : <><Plus size={16} className="mr-2" />{t('program.addToCart')}</>}</button></div></motion.div></section></main><Footer /></>
}
