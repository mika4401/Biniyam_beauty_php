import type { TranslationKey } from '../i18n/translations'
import type { Registration } from '../types/api'

export const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25 } }
export const formatPrice = (price: number) => `${price.toLocaleString()} ETB`

const scheduleLabelKeys: Record<string, TranslationKey> = {
  'weekday-morning': 'schedule.weekdayMorning',
  'weekday-afternoon': 'schedule.weekdayAfternoon',
  'weekday-midday': 'schedule.weekdayMidday',
  'weekday-full': 'schedule.weekdayFull',
  weekend: 'schedule.weekend',
}
export const scheduleLabel = (key: string, t: (k: TranslationKey) => string) => {
  const labelKey = scheduleLabelKeys[key]
  return labelKey ? t(labelKey) : key
}

const drawerScheduleLabelKeys: Record<string, TranslationKey> = {
  'weekday-morning': 'drawer.scheduleMorning',
  'weekday-afternoon': 'drawer.scheduleAfternoon',
  'weekday-midday': 'drawer.scheduleMidday',
  'weekday-full': 'drawer.scheduleFull',
  weekend: 'drawer.scheduleWeekend',
}
export const drawerScheduleLabel = (key: string, t: (k: TranslationKey) => string) => {
  const labelKey = drawerScheduleLabelKeys[key]
  if (labelKey) return t(labelKey)
  if (key) return key
  return '—'
}

export const statusLabelKey: Record<string, TranslationKey> = {
  Pending: 'status.pending',
  Confirmed: 'status.confirmed',
  Paid: 'status.paid',
  Half: 'status.halfPaid',
  Cancelled: 'status.cancelled',
}

export const regStatusVariant = (reg: Registration): 'paid' | 'half' | 'pending' | 'confirmed' | 'cancelled' => {
  const status = reg.status
  const payType = reg.paymentType
  if (status === 'Paid') return 'paid'
  if (status === 'Confirmed') return 'confirmed'
  if (status === 'Cancelled') return 'cancelled'
  if (payType === 'Half') return 'half'
  return 'pending'
}
