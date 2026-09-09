import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, CheckCircle, ChevronRight, CreditCard, Loader, ShoppingCart, Trash2, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../i18n/LanguageContext'
import type { TranslationKey } from '../i18n/translations'
import { VALIDATION_ERRORS } from '../i18n/mappings'
import { API_BASE, EDU_LEVELS, SCHEDULE_OPTIONS, formatPrice, fadeUp } from '../constants'
import { validateEmail, validatePhone, validateUsername } from '../utils/security'
import CloudinaryUploadWidget from '../utils/CloudinaryUploadWidget'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function CheckoutPage() {
  const navigate = useNavigate()
  const { t, language } = useLanguage()
  const { items, halfAllowed, halfReason, removeItem, clearCart } = useCart()

  const eduLevelLabel = (level: string) => ({
    'Grade 6': t('checkout.education.grade6'),
    'Grade 8': t('checkout.education.grade8'),
    'Grade 10': t('checkout.education.grade10'),
    'Grade 12': t('checkout.education.grade12'),
    'Diploma': t('checkout.education.diploma'),
    'Degree': t('checkout.education.degree'),
    'Masters': t('checkout.education.masters'),
    'PhD': t('checkout.education.phd'),
  })[level] ?? level

  const scheduleLabel = (value: string) => ({
    'weekday-morning': t('checkout.schedule.weekday-morning'),
    'weekday-afternoon': t('checkout.schedule.weekday-afternoon'),
    'weekday-midday': t('checkout.schedule.weekday-midday'),
    'weekday-full': t('checkout.schedule.weekday-full'),
    'weekend': t('checkout.schedule.weekend'),
  })[value] ?? value

  const [values, setValues] = useState({ name: '', email: '', phone: '', nationalIdImage: '', educationLevel: '', fieldOfStudy: '', schedule: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [paymentType, setPaymentType] = useState<'Full' | 'Half'>('Full')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [apiError, setApiError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const [programIdMap, setProgramIdMap] = useState<Record<string, string>>({})
  // Fresh program data from the backend (price, active status) so the checkout
  // reflects admin changes immediately instead of using stale cart data
  const [freshPrograms, setFreshPrograms] = useState<Record<string, { price: number; isActive: boolean; allowsHalfPayment: boolean; title?: string; titleAm?: string }>>({})
  const freshDataLoaded = Object.keys(freshPrograms).length > 0
  const freshHalfAllowed = !freshDataLoaded || items.every((item) => {
    const fresh = freshPrograms[item.programId]
    return fresh === undefined || fresh.allowsHalfPayment
  })
  const isHalfEligible = halfAllowed && items.length > 0 && freshHalfAllowed

  // Polling-based payment confirmation (new flow)
  const [waitingForPayment, setWaitingForPayment] = useState(false)
  const [paymentTxRef, setPaymentTxRef] = useState<string | null>(null)
  const [paymentChapaUrl, setPaymentChapaUrl] = useState<string | null>(null)
  const [paymentStatusMsg, setPaymentStatusMsg] = useState('')
  const [paymentFailed, setPaymentFailed] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore pending payment state from sessionStorage on mount
  // so that navigating back to checkout shows the waiting/failed state
  // instead of 'Your cart is empty'
  useEffect(() => {
    const saved = sessionStorage.getItem('pendingPayment')
    if (!saved) return

    try {
      const pending = JSON.parse(saved)
      const age = Date.now() - pending.timestamp
      // Only restore if less than 30 minutes old
      /* eslint-disable react-hooks/set-state-in-effect -- restoring persisted UI state on mount */
      if (age < 30 * 60 * 1000) {
        setPaymentTxRef(pending.txRef || null)
        setPaymentChapaUrl(pending.chapaUrl || null)
        setPaymentStatusMsg(pending.statusMsg || '')
        setPaymentFailed(Boolean(pending.failed))
        setWaitingForPayment(true)
      } else {
        sessionStorage.removeItem('pendingPayment')
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      sessionStorage.removeItem('pendingPayment')
    }
  }, [])

  // Load programs from backend to map slugs → MongoDB _id, and keep
  // current prices/availability for cart validation against admin changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/programs`)
        const data = await res.json()
        if (!cancelled && data.success && Array.isArray(data.data)) {
          const map: Record<string, string> = {}
          const fresh: Record<string, { price: number; isActive: boolean; allowsHalfPayment: boolean; title?: string; titleAm?: string }> = {}
          for (const p of data.data) {
            // Map by slug and by _id
            if (p.slug) map[p.slug] = p._id
            map[p._id] = p._id
            const freshEntry = {
              price: Number(p.price),
              isActive: p.isActive !== false,
              allowsHalfPayment: Boolean(p.allowsHalfPayment),
              title: (p.title as string) || undefined,
              titleAm: (p.titleAm as string) || undefined,
            }
            if (p.slug) fresh[p.slug] = freshEntry
            fresh[p._id] = freshEntry
          }
          setProgramIdMap(map)
          setFreshPrograms(fresh)
        }
      } catch {
        // Backend unavailable — use cart IDs as-is
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Reset payment type to Full when half becomes ineligible (e.g. item removed)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isHalfEligible) setPaymentType('Full')
  }, [isHalfEligible])

  // Poll for payment status when waiting for payment confirmation
  useEffect(() => {
    if (!waitingForPayment || !paymentTxRef) return

    const txRef = paymentTxRef
    let attempts = 0
    const maxAttempts = 120 // poll up to 6 minutes (120 × 3s)

    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`${API_BASE}/chapa/verify/${encodeURIComponent(txRef)}`)
        const data = await res.json()

        if (data.success && data.data) {
          const status = data.data.status as string
          if (status === 'Completed') {
            if (pollRef.current) clearInterval(pollRef.current)
            sessionStorage.removeItem('pendingPayment')
            navigate(`/payment/result?tx_ref=${txRef}&status=Completed`)
            return
          } else if (status === 'Failed' || status === 'Refunded') {
            if (pollRef.current) clearInterval(pollRef.current)
            const failMsg = t('checkout.paymentFailedMsg')
            setPaymentStatusMsg(failMsg)
            setPaymentFailed(true)
            // Persist failure state to sessionStorage
            try {
              const saved = sessionStorage.getItem('pendingPayment')
              if (saved) {
                const pending = JSON.parse(saved)
                pending.statusMsg = failMsg
                pending.failed = true
                sessionStorage.setItem('pendingPayment', JSON.stringify(pending))
              }
            } catch { /* ignore */ }
            return
          }
        }
      } catch {
        // Ignore network errors during polling — will retry
      }

      if (attempts >= maxAttempts) {
        if (pollRef.current) clearInterval(pollRef.current)
        const timeoutMsg = t('checkout.waitTimeoutMsg')
        setPaymentStatusMsg(timeoutMsg)
        // Timeout is not a failure — keep paymentFailed as-is so the user
        // can still choose to reopen the payment page
        // Persist timeout state
        try {
          const saved = sessionStorage.getItem('pendingPayment')
          if (saved) {
            const pending = JSON.parse(saved)
            pending.statusMsg = timeoutMsg
            // Don't set pending.failed = true — timeout is not a hard failure
            sessionStorage.setItem('pendingPayment', JSON.stringify(pending))
          }
        } catch { /* ignore */ }
      }
    }, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [waitingForPayment, paymentTxRef, navigate, t])

  // Totals based on the freshest known prices (fall back to the cart price while loading)
  const displayedTotal = items.reduce((sum, item) => sum + (freshPrograms[item.programId]?.price ?? item.price), 0)
  const displayedHalfTotal = Math.round(displayedTotal / 2)
  const finalAmount = paymentType === 'Half' ? displayedHalfTotal : displayedTotal

  // Cart availability against fresh backend data — block checkout for courses
  // the admin has removed or deactivated, and flag price changes
  const unavailableItems = items.filter((item) => {
    if (!freshDataLoaded) return false
    const fresh = freshPrograms[item.programId]
    return !fresh || fresh.isActive === false
  })
  const cartHasUnavailable = unavailableItems.length > 0

  const setValue = (field: string, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  const inputClass = (field: string) =>
    `mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-gold ${errors[field] ? 'border-danger' : 'border-black/10 dark:border-white/10'}`

  const validate = (): boolean => {
    const nameResult = validateUsername(values.name)
    const emailResult = validateEmail(values.email)
    const phoneResult = validatePhone(values.phone)
    const next: Record<string, string> = {}

    if (!nameResult.valid) next.name = VALIDATION_ERRORS[nameResult.error] ? t(VALIDATION_ERRORS[nameResult.error] as TranslationKey) : nameResult.error
    if (!emailResult.valid) next.email = VALIDATION_ERRORS[emailResult.error] ? t(VALIDATION_ERRORS[emailResult.error] as TranslationKey) : emailResult.error
    if (!phoneResult.valid) next.phone = VALIDATION_ERRORS[phoneResult.error] ? t(VALIDATION_ERRORS[phoneResult.error] as TranslationKey) : phoneResult.error
    if (!values.educationLevel) next.educationLevel = t('checkout.errorSelectLevel')
    if (['Degree', 'Masters', 'PhD'].includes(values.educationLevel) && !values.fieldOfStudy.trim()) {
      next.fieldOfStudy = t('checkout.errorFieldOfStudy')
    }
    if (!values.schedule) next.schedule = t('checkout.errorChooseSchedule')
    if (!values.nationalIdImage) next.nationalIdImage = t('checkout.errorUploadId')
    if (items.length === 0) next.cart = t('checkout.errorCartEmpty')

    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Empty cart state (only if no pending payment exists) ──
  if (items.length === 0 && !submitted && !waitingForPayment) {
    return <><Navbar /><main className="grid min-h-screen place-items-center bg-surface px-6 pt-24">
      <motion.section {...fadeUp} className="flex w-full max-w-lg flex-col items-center rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-12">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/10"><ShoppingCart size={40} className="text-gold" /></span>
        <h1 className="mt-8 font-display text-3xl font-bold text-charcoal">{t('checkout.emptyTitle')}</h1>
        <p className="mt-4 leading-7 text-muted">{t('checkout.emptyParagraph')}</p>
        <Link to="/#courses" className="mt-8 inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">{t('checkout.browseCourses')} <ChevronRight size={16} /></Link>
      </motion.section>
    </main><Footer /></>
  }

  // ── Redirecting / Submitted states (same pattern as before) ──
  if (redirecting) {
    return <><Navbar /><main className="grid min-h-screen place-items-center bg-surface px-6 pt-24"><motion.section {...fadeUp} className="flex w-full max-w-lg flex-col items-center rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-12"><span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/10"><Loader size={40} className="animate-spin text-gold" /></span><h1 className="mt-8 font-display text-3xl font-bold text-charcoal">{t('checkout.openingGateway')}</h1><p className="mt-4 leading-7 text-muted">{t('checkout.openingGatewayParagraph')}</p></motion.section></main><Footer /></>
  }

  // ── Waiting for payment (polling) or payment failed ──
  if (waitingForPayment) {
    const icon = paymentFailed ? (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-danger/15 text-danger">
          <XCircle size={40} />
        </span>
      </motion.div>
    ) : (
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/10">
        <Loader size={40} className="animate-spin text-gold" />
      </span>
    )
    const heading = paymentFailed ? t('checkout.paymentFailedTitle') : t('checkout.waitingTitle')
    const descriptionText = paymentStatusMsg || t('checkout.waitingParagraph')

    return <><Navbar /><main className="grid min-h-screen place-items-center bg-surface px-6 pt-24">
      <motion.section {...fadeUp} className="flex w-full max-w-lg flex-col items-center rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-12">
        {icon}
        <h1 className="mt-8 font-display text-3xl font-bold text-charcoal">{heading}</h1>
        <p className="mt-4 leading-7 text-muted">{descriptionText}</p>

        {!paymentFailed && <PaymentTimer />}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 w-full">
          {paymentChapaUrl && (
            <button
              onClick={() => window.open(paymentChapaUrl, '_blank')}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              <CreditCard size={16} />
              {paymentFailed ? t('checkout.tryPayingAgain') : t('checkout.reopenPayment')}
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-black/10 dark:border-white/10 bg-card px-6 py-4 text-sm font-semibold text-charcoal transition hover:border-gold hover:text-gold"
          >
            {t('checkout.backHome')}
          </button>
        </div>

        <p className="mt-6 text-xs text-muted">
          {t('checkout.savedWillConfirm')}
          {paymentTxRef && <><br />{t('checkout.reference')}: {paymentTxRef}</>}
        </p>
      </motion.section>
    </main><Footer /></>
  }

  if (submitted) {
    return <><Navbar /><main className="grid min-h-screen place-items-center bg-surface px-6 pt-24"><motion.section {...fadeUp} className="max-w-lg rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]"><motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success"><Check size={32} /></span></motion.div><h1 className="mt-6 font-display text-4xl font-bold text-charcoal">{t('checkout.registrationConfirmed')}</h1>
        <>
          <p className="mt-4 leading-7 text-muted">{t('checkout.gatewayUnreachable')}</p>
          <div className="mt-6 rounded-[14px] bg-warning/10 border border-warning/30 px-5 py-4 text-left text-sm"><p className="font-semibold text-warning">{t('checkout.noPaymentInitiated')}</p><p className="mt-1 text-muted">{t('checkout.noPaymentParagraph')}</p></div>
          <button onClick={() => navigate('/')} className="mt-6 inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5"><ChevronRight size={16} />{t('checkout.returnHome')}</button>
        </>
    </motion.section></main><Footer /></>
  }

  // ── Form ──
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    if (!validate()) return

    if (cartHasUnavailable) {
      setApiError(t('checkout.cartUnavailable'))
      return
    }

    setIsSubmitting(true)
    setApiError('')

    const parts = values.name.trim().split(/\s+/)
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || firstName

    try {
      // 1. Create registration via bulk-create
      const regRes = await fetch(`${API_BASE}/registrations/bulk-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student: {
            firstName,
            lastName,
            email: values.email,
            phone: values.phone,
            nationalIdImage: values.nationalIdImage || undefined,
            educationLevel: values.educationLevel || undefined,
            fieldOfStudy: values.fieldOfStudy || undefined,
          },
          // Translate frontend program IDs to backend IDs if mapping exists
          programs: items.map((i) => programIdMap[i.programId] || i.programId),
          schedule: values.schedule,
          paymentType,
        }),
      })
      const regBody = await regRes.json()

      if (!regBody.success) {
        throw new Error(regBody.message || 'Could not complete registration')
      }

      const registrationId = regBody.data._id || regBody.data.id
      // Prefer the server-computed amount from the registration response — it is
      // always derived from current program prices. Fall back to displayed totals.
      const totalAmount = regBody.data.totalAmount ?? (paymentType === 'Half' ? displayedHalfTotal : displayedTotal)

      // 2. Initialize Chapa payment
      setRedirecting(true)
      const chapaRes = await fetch(`${API_BASE}/chapa/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, amount: totalAmount }),
      })
      const chapaBody = await chapaRes.json()

      if (!chapaBody.success || !chapaBody.data?.checkoutUrl) {
        setSubmitted(true)
        setIsSubmitting(false)
        setRedirecting(false)
        return
      }

      const checkoutUrl = chapaBody.data.checkoutUrl
      const txRef = chapaBody.data.transactionReference

      // Store the checkout URL and txRef for the waiting/polling flow
      setPaymentChapaUrl(checkoutUrl)
      setPaymentTxRef(txRef || '')
      setPaymentFailed(false)
      clearCart()
      window.open(checkoutUrl, '_blank')
      setWaitingForPayment(true)
      setIsSubmitting(false)
      setRedirecting(false)

      // Persist to sessionStorage so navigating back shows the waiting state
      sessionStorage.setItem('pendingPayment', JSON.stringify({
        txRef: txRef || '',
        chapaUrl: checkoutUrl,
        timestamp: Date.now(),
        statusMsg: '',
        failed: false,
      }))
    } catch (err) {
      setApiError(err instanceof Error ? err.message : t('checkout.unexpectedError'))
      setIsSubmitting(false)
    }
  }

  return <>
    <Navbar />
    <main className="bg-surface px-6 pb-16 pt-32 md:pb-24 lg:px-12">
      {apiError && (
        <div role="alert" className="mx-auto mb-6 max-w-6xl rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">
          {apiError}
        </div>
      )}
      <motion.div {...fadeUp} className="mx-auto max-w-6xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('checkout.eyebrow')}</p>
        <h1 className="mt-4 text-center font-display text-4xl font-bold text-charcoal">{t('checkout.title')}</h1>

        {cartHasUnavailable && (
          <div role="alert" className="mx-auto mt-6 max-w-6xl rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">
            <span className="flex items-center gap-2"><AlertTriangle size={16} className="shrink-0" />{t('checkout.cartUnavailable')}</span>
          </div>
        )}

        {/* Two-column layout */}
        <div className="mt-8 grid gap-8 lg:grid-cols-5 lg:items-start">
          {/* ── Left: Registration form (3/5) ── */}
          <form ref={formRef} noValidate onSubmit={handleSubmit} className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-8 lg:col-span-3">
            <h2 className="font-display text-2xl font-bold text-charcoal">{t('checkout.yourDetails')}</h2>
            <div className="mt-2 h-1 w-12 rounded-full bg-gold" />

            <CheckoutInput label={t('checkout.fullName')} value={values.name} onChange={(v) => setValue('name', v)} error={errors.name} placeholder={t('checkout.fullNamePlaceholder')} maxLength={50} />
            <CheckoutInput label={t('checkout.email')} value={values.email} onChange={(v) => setValue('email', v)} error={errors.email} type="email" placeholder={t('checkout.emailPlaceholder')} maxLength={254} />
            <CheckoutInput label={t('checkout.phone')} value={values.phone} onChange={(v) => setValue('phone', v)} error={errors.phone} type="tel" placeholder={t('checkout.phonePlaceholder')} maxLength={20} />

            {/* National ID upload — Cloudinary widget */}
            <label className="mt-6 block text-sm font-medium text-charcoal">
              {t('checkout.nationalId')}
              {values.nationalIdImage ? (
                <div className="mt-2 flex items-center gap-3 rounded-xl border-2 border-success/30 bg-success/5 px-4 py-4 text-sm">
                  <CheckCircle size={20} className="text-success shrink-0" />
                  <span className="flex-1 truncate text-charcoal">{t('checkout.nationalIdUploaded')}</span>
                  <button
                    type="button"
                    onClick={() => setValue('nationalIdImage', '')}
                    className="shrink-0 text-sm font-medium text-danger transition hover:underline"
                  >
                    {t('checkout.remove')}
                  </button>
                </div>
              ) : (
                <CloudinaryUploadWidget
                  onUploadSuccess={(url) => setValue('nationalIdImage', url)}
                  error={errors.nationalIdImage}
                />
              )}
            </label>

            {/* Education Level */}
            <label className="mt-6 block text-sm font-medium text-charcoal">
              {t('checkout.educationLevel')}
              <select value={values.educationLevel} onChange={(e) => setValue('educationLevel', e.target.value)} aria-invalid={Boolean(errors.educationLevel)} className={inputClass('educationLevel')}>
                <option value="">{t('checkout.selectLevel')}</option>
                {EDU_LEVELS.map((level) => <option key={level} value={level}>{eduLevelLabel(level)}</option>)}
              </select>
              {errors.educationLevel && <p role="alert" className="mt-2 text-sm text-danger">{errors.educationLevel}</p>}
            </label>

            {/* Field of Study (conditional) */}
            {['Degree', 'Masters', 'PhD'].includes(values.educationLevel) && (
              <CheckoutInput
                label={t('checkout.fieldOfStudy')}
                value={values.fieldOfStudy}
                onChange={(v) => setValue('fieldOfStudy', v)}
                error={errors.fieldOfStudy}
                placeholder={t('checkout.fieldOfStudyPlaceholder')}
                maxLength={100}
              />
            )}

            {/* Schedule */}
            <label className="mt-6 block text-sm font-medium text-charcoal">
              {t('checkout.schedule')}
              <select value={values.schedule} onChange={(e) => setValue('schedule', e.target.value)} aria-invalid={Boolean(errors.schedule)} className={inputClass('schedule')}>
                <option value="">{t('checkout.chooseSchedule')}</option>
                {SCHEDULE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{scheduleLabel(opt.value)}</option>)}
              </select>
              {errors.schedule && <p role="alert" className="mt-2 text-sm text-danger">{errors.schedule}</p>}
            </label>

            {/* Submit button (mobile) */}
            <button disabled={isSubmitting || cartHasUnavailable} className="mt-8 w-full rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 lg:hidden">
              {isSubmitting ? t('checkout.processing') : `${t('checkout.pay')} ${formatPrice(finalAmount)}`}
            </button>
          </form>

          {/* ── Right: Cart summary (2/5) ── */}
          <aside className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-8 lg:col-span-2 lg:sticky lg:top-32">
            <h2 className="font-display text-2xl font-bold text-charcoal">{t('checkout.orderSummary')}</h2>
            <div className="mt-2 h-1 w-12 rounded-full bg-gold" />

            <div className="mt-6 divide-y divide-black/5 dark:divide-white/10">
              {items.map((item) => (
                <div key={item.programId} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-charcoal">{(language === 'am' ? freshPrograms[item.programId]?.titleAm : freshPrograms[item.programId]?.title) || item.title}</p>
                    {(() => {
                      const fresh = freshPrograms[item.programId]
                      if (freshDataLoaded && (!fresh || fresh.isActive === false)) {
                        return <p className="mt-0.5 text-sm font-medium text-danger">{t('checkout.unavailableItem')}</p>
                      }
                      if (fresh && fresh.price !== item.price) {
                        return <p className="mt-0.5 text-sm text-muted"><s>{formatPrice(item.price)}</s> <span className="font-medium text-warning">{formatPrice(fresh.price)}</span> <span className="text-xs text-warning">{t('checkout.priceUpdated')}</span></p>
                      }
                      return <p className="mt-0.5 text-sm text-muted">{formatPrice(item.price)}</p>
                    })()}
                  </div>
                  <button
                    onClick={() => removeItem(item.programId)}
                    aria-label={`${t('checkout.remove')} ${item.title}`}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 border-t border-black/10 dark:border-white/10 pt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t('checkout.subtotal')}</span>
                <span className="font-medium text-charcoal">{formatPrice(displayedTotal)}</span>
              </div>
              {paymentType === 'Half' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">{t('checkout.halfPayment')}</span>
                  <span className="font-medium text-success">{formatPrice(displayedHalfTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 pt-2">
                <span className="font-semibold text-charcoal">{t('checkout.total')}</span>
                <span className="font-display text-xl font-bold text-charcoal">{formatPrice(finalAmount)}</span>
              </div>
            </div>

            {/* Payment type selector */}
            <div className="mt-6 border-t border-black/10 dark:border-white/10 pt-6">
              <p className="text-sm font-medium text-charcoal">{t('checkout.paymentType')}</p>
              <div className="mt-3 space-y-3">
                <label className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 text-sm transition ${paymentType === 'Full' ? 'border-gold bg-gold/5' : 'border-black/10 dark:border-white/10 bg-card hover:border-black/30 dark:hover:border-white/30'}`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="Full"
                    checked={paymentType === 'Full'}
                    onChange={() => setPaymentType('Full')}
                    className="h-4 w-4 accent-gold"
                  />
                  <div>
                    <p className="font-medium text-charcoal">{t('checkout.fullPayment')}</p>
                    <p className="text-xs text-muted">{formatPrice(displayedTotal)} — {t('checkout.payFullNow')}</p>
                  </div>
                </label>

                <label className={`flex cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 text-sm transition ${paymentType === 'Half' ? 'border-gold bg-gold/5' : 'border-black/10 dark:border-white/10 bg-card hover:border-black/30 dark:hover:border-white/30'} ${!isHalfEligible ? 'pointer-events-none opacity-50' : ''}`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="Half"
                    checked={paymentType === 'Half'}
                    onChange={() => setPaymentType('Half')}
                    disabled={!isHalfEligible}
                    className="h-4 w-4 accent-gold"
                  />
                  <div>
                    <p className="font-medium text-charcoal">{t('checkout.halfPayment')}</p>
                    <p className="text-xs text-muted">{formatPrice(displayedHalfTotal)} — {t('checkout.halfPayNow')}</p>
                    {!isHalfEligible && halfReason && (
                      <p className="mt-1 text-xs text-danger">{halfReason}</p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Desktop submit button */}
            <button
              disabled={isSubmitting || cartHasUnavailable}
              onClick={() => formRef.current?.requestSubmit()}
              className="mt-6 hidden w-full rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 lg:block"
            >
              {isSubmitting ? t('checkout.processing') : `${t('checkout.pay')} ${formatPrice(finalAmount)}`}
            </button>
          </aside>
        </div>
      </motion.div>
    </main>
    <Footer />
  </>
}

function CheckoutInput({ label, value, onChange, error, type = 'text', placeholder, maxLength }: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  placeholder?: string
  maxLength: number
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return (
    <label className="mt-6 block text-sm font-medium text-charcoal">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-gold ${error ? 'border-danger' : 'border-black/10 dark:border-white/10'}`}
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </label>
  )
}

/** Elapsed time counter shown during payment polling. */
function PaymentTimer() {
  const { t } = useLanguage()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  return (
    <p className="mt-4 text-sm text-muted">
      {t('checkout.timeElapsed')} <span className="font-medium text-charcoal">{label}</span>
    </p>
  )
}
