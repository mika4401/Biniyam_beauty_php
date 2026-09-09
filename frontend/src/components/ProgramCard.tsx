import { Link } from 'react-router-dom'
import { Check, ChevronRight, Plus } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Program } from '../types/api'
import type { CartItem } from '../utils/cart'
import { formatPrice, fadeUp } from '../constants'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { PROGRAM_I18N } from '../i18n/mappings'

export function ProgramCard({ program }: { program: Program }) {
  const { addItem, isInCart } = useCart()
  const { t, language } = useLanguage()
  const inCart = isInCart(program.id)
  const cartItem: CartItem = { programId: program.id, title: program.title, price: program.price, allowsHalfPayment: program.allowsHalfPayment, image: program.image }
  const i18nPrefix = PROGRAM_I18N[program.id]
  const hardcoded = (key: string) => (i18nPrefix ? t(`${i18nPrefix}.${key}` as TranslationKey) : '') || ''
  // Prefer DB Amharic fields, then the hardcoded seed translations, then English
  const title = language === 'am' ? (program.titleAm || hardcoded('title') || program.title) : program.title
  const description = language === 'am' ? (program.descriptionAm || hardcoded('description') || program.description) : program.description
  const discount = language === 'am' ? (hardcoded('discount') || program.discount) : program.discount
  return <motion.article {...fadeUp} className="overflow-hidden rounded-[20px] bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]"><div className="relative"><img src={program.image} alt={title} className="aspect-[4/3] w-full object-cover" />{discount && <span className="absolute left-4 top-4 rounded-full bg-gold px-3 py-2 text-xs font-semibold text-white">{discount}</span>}</div><div className="p-6"><h3 className="font-display text-2xl font-bold text-charcoal">{title}</h3><p className="mt-3 min-h-12 text-sm leading-6 text-muted">{description}</p><div className="mt-6 flex items-center justify-between"><p className="font-semibold text-charcoal">{formatPrice(program.price)}</p><Link to={`/programs/${program.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">{t('program.viewDetails')} <ChevronRight size={16} /></Link></div><div className="mt-4"><button disabled={inCart} onClick={() => addItem(cartItem)} className={`w-full rounded-[14px] px-4 py-3 text-center text-sm font-semibold transition ${inCart ? 'bg-success/15 text-success cursor-default' : 'bg-gold text-white hover:-translate-y-0.5'}`}>{inCart ? <span className="inline-flex items-center justify-center gap-1.5"><Check size={14} />{t('program.inCart')}</span> : <span className="inline-flex items-center justify-center gap-1.5"><Plus size={14} />{t('program.addToCart')}</span>}</button></div></div></motion.article>
}
