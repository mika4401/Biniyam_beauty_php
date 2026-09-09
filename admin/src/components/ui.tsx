import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '../i18n/LanguageContext'
import { fadeUp } from '../utils/helpers'

export function Metric({ label, value, icon, tone = 'default' }: {
  label: string; value: string; icon: ReactNode; tone?: 'default' | 'warning' | 'success'
}) {
  const colour = tone === 'success' ? 'bg-success/15 text-success' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-gold/15 text-gold'
  return (
    <motion.article {...fadeUp} className="rounded-[20px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
      <span className={`grid h-10 w-10 place-items-center rounded-[14px] ${colour}`}>{icon}</span>
      <p className="mt-6 text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold text-charcoal">{value}</p>
    </motion.article>
  )
}

export function StatusPillVariant({ variant }: { variant: 'paid' | 'half' | 'pending' | 'confirmed' | 'cancelled' }) {
  const { t } = useLanguage()
  const config = {
    paid: { label: t('status.paid'), style: 'bg-success/15 text-success' },
    half: { label: t('status.halfPaid'), style: 'bg-warning/15 text-warning' },
    pending: { label: t('status.pending'), style: 'bg-gold/15 text-gold' },
    confirmed: { label: t('status.confirmed'), style: 'bg-blue-100 text-blue-700' },
    cancelled: { label: t('status.cancelled'), style: 'bg-red-100 text-red-700' },
  }
  const { label, style } = config[variant] || config.pending
  return <span className={`rounded-full px-3 py-2 text-xs font-semibold ${style}`}>{label}</span>
}

export function PaymentTypeBadge({ type }: { type: string }) {
  if (!type) return <span className="text-xs text-muted">—</span>
  return <span className={`rounded-full px-3 py-2 text-xs font-semibold ${type === 'Half' ? 'bg-warning/15 text-warning' : 'bg-gold/15 text-gold'}`}>{type}</span>
}

export function ClickableMetric({ label, value, icon, tone = 'default', active, onClick }: {
  label: string; value: string; icon: ReactNode; tone?: 'default' | 'warning' | 'success'; active: boolean; onClick: () => void
}) {
  const colour = tone === 'success' ? 'bg-success/15 text-success' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-gold/15 text-gold'
  return (
    <motion.button {...fadeUp} onClick={onClick}
      className={`w-full rounded-[20px] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,.08)] transition-all ${
        active ? 'bg-charcoal text-white ring-2 ring-gold' : 'bg-white hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(0,0,0,.12)]'
      }`}>
      <span className={`grid h-10 w-10 place-items-center rounded-[14px] ${active ? 'bg-gold text-white' : colour}`}>{icon}</span>
      <p className={`mt-6 text-sm ${active ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${active ? 'text-white' : 'text-charcoal'}`}>{value}</p>
    </motion.button>
  )
}

export function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface px-4 py-3">
      <span className="shrink-0 text-gold">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-sm font-medium text-charcoal truncate">{value}</p>
      </div>
    </div>
  )
}
