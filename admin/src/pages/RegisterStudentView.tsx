import { useEffect, useState, useCallback, useRef } from 'react'
import type { FormEvent } from 'react'
import { Check, CreditCard, Loader, UserPlus, Banknote } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchPrograms, adminCreateRegistration, recordSecondPayment } from '../utils/api'
import type { Program } from '../types/api'
import { EDU_LEVELS, SCHEDULE_OPTIONS } from '../constants'

interface Props {
  onNavigate: () => void
}

type PaymentMode = 'chapa' | 'cash' | null

export function RegisterStudentView({ onNavigate }: Props) {
  const { t } = useLanguage()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Payment state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(null)
  const [createdRegistrationId, setCreatedRegistrationId] = useState<string | null>(null)
  const [chapaUrl, setChapaUrl] = useState('')
  const [waitingForPayment, setWaitingForPayment] = useState(false)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [cashRecorded, setCashRecorded] = useState(false)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [educationLevel, setEducationLevel] = useState('')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const [schedule, setSchedule] = useState('')
  const [paymentType, setPaymentType] = useState<'Full' | 'Half'>('Full')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const res = await fetchPrograms()
        if (res.success && res.data) {
          const activePrograms = Array.isArray(res.data) ? res.data.filter((p: Program) => p.isActive !== false) : []
          setPrograms(activePrograms)
        }
      } catch {
        setError(t('registerStudent.error.load'))
      } finally {
        setLoadingPrograms(false)
      }
    }
    loadPrograms()
  }, [t])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  const toggleProgram = (programId: string) => {
    setSelectedPrograms(prev =>
      prev.includes(programId)
        ? prev.filter(id => id !== programId)
        : [...prev, programId]
    )
    setFormErrors(prev => ({ ...prev, programs: '' }))
  }

  const inputClass = (field: string) =>
    `mt-2 w-full rounded-xl border bg-card px-4 py-3 text-sm outline-none transition focus:border-gold ${
      formErrors[field] ? 'border-danger' : 'border-black/10'
    }`

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!firstName.trim()) next.firstName = t('registerStudent.error.allFields')
    if (!lastName.trim()) next.lastName = t('registerStudent.error.allFields')
    if (!email.trim()) next.email = t('registerStudent.error.allFields')
    if (!phone.trim()) next.phone = t('registerStudent.error.allFields')
    if (!educationLevel) next.educationLevel = t('registerStudent.error.allFields')
    if (['Degree', 'Masters', 'PhD'].includes(educationLevel) && !fieldOfStudy.trim()) {
      next.fieldOfStudy = t('registerStudent.error.allFields')
    }
    if (selectedPrograms.length === 0) next.programs = t('registerStudent.error.allFields')
    if (!schedule) next.schedule = t('registerStudent.error.allFields')
    setFormErrors(next)
    return Object.keys(next).length === 0
  }

  const total = programs
    .filter(p => selectedPrograms.includes(String(p._id || p.id)))
    .reduce((sum, p) => sum + (Number(p.price) || 0), 0)
  const displayAmount = paymentType === 'Half' ? Math.round(total / 2) : total

  // ── Step 1: Create registration ──
  const createRegistration = async (): Promise<string | null> => {
    try {
      const res = await adminCreateRegistration({
        student: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          educationLevel,
          fieldOfStudy: fieldOfStudy.trim() || undefined,
        },
        programs: selectedPrograms,
        schedule,
        paymentType,
      })

      if (res.success && res.data) {
        const regId = String((res.data as Record<string, unknown>).id || (res.data as Record<string, unknown>)._id || (res.data as Record<string, unknown>).registrationId || '')
        return regId || null
      } else {
        setError(res.message || t('registerStudent.error.register'))
        return null
      }
    } catch {
      setError(t('registerStudent.error.register'))
      return null
    }
  }

  // ── Step 2a: Initialize Chapa payment ──
  const initChapaPayment = async (registrationId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('http://localhost/Biniyam_PHP/api/v1/chapa/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_access_token') || ''}`,
        },
        body: JSON.stringify({ registrationId }),
      })
      const body = await res.json()

      if (body.success && body.data?.checkoutUrl) {
        setChapaUrl(body.data.checkoutUrl)
        setCreatedRegistrationId(registrationId)
        setWaitingForPayment(true)
        setPaymentMode('chapa')
        // Open Chapa in new tab
        window.open(body.data.checkoutUrl, '_blank')
        // Start polling for payment status
        startPaymentPolling(body.data.transactionReference || body.data.tx_ref || '')
      } else {
        setError(body.message || 'Failed to initialize Chapa payment')
        setSubmitting(false)
      }
    } catch {
      setError('Failed to connect to Chapa payment gateway')
      setSubmitting(false)
    }
  }

  // ── Step 2b: Record cash payment ──
  const recordCashPayment = async (registrationId: string) => {
    setSubmitting(true)
    try {
      const res = await recordSecondPayment(registrationId, displayAmount)
      if (res.success) {
        setCashRecorded(true)
        setCreatedRegistrationId(registrationId)
        setPaymentMode('cash')
        setSuccess(true)
      } else {
        setError(res.message || 'Failed to record cash payment')
      }
    } catch {
      setError('Failed to record cash payment')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Poll for Chapa payment confirmation ──
  const startPaymentPolling = useCallback((txRef: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost/Biniyam_PHP/api/v1/chapa/verify/${encodeURIComponent(txRef)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_access_token') || ''}` },
        })
        const body = await res.json()

        if (body.success && body.data) {
          const status = body.data.status
          if (status === 'Completed' || status === 'success') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setWaitingForPayment(false)
            setPaymentConfirmed(true)
            setSuccess(true)
          } else if (status === 'Failed' || status === 'cancelled') {
            if (pollingRef.current) clearInterval(pollingRef.current)
            setWaitingForPayment(false)
            setError('Payment was not completed. Please try again.')
          }
        }
      } catch {
        // Silently retry — network glitch
      }
    }, 3000) // Poll every 3 seconds
  }, [])

  // ── Form submit → create registration, then ask payment method ──
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setError('')

    try {
      const res = await adminCreateRegistration({
        student: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          educationLevel,
          fieldOfStudy: fieldOfStudy.trim() || undefined,
        },
        programs: selectedPrograms,
        schedule,
        paymentType,
      })

      if (res.success && res.data) {
        const regData = res.data as Record<string, unknown>
        const regId = String(regData.id || regData._id || '')
        setCreatedRegistrationId(regId)
        setPaymentMode(null) // Show payment method chooser
      } else {
        setError(res.message || t('registerStudent.error.register'))
      }
    } catch {
      setError(t('registerStudent.error.register'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setNationalIdImage('')
    setEducationLevel('')
    setFieldOfStudy('')
    setSelectedPrograms([])
    setSchedule('')
    setPaymentType('Full')
    setFormErrors({})
    setSuccess(false)
    setError('')
    setPaymentMode(null)
    setCreatedRegistrationId(null)
    setChapaUrl('')
    setWaitingForPayment(false)
    setPaymentConfirmed(false)
    setCashRecorded(false)
    if (pollingRef.current) clearInterval(pollingRef.current)
  }

  // ── State: Success ──
  if (success) {
    return (
      <div className="flex-1 p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-lg rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]"
        >
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
            <Check size={32} />
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold text-charcoal">
            {cashRecorded ? 'Cash Payment Recorded' : paymentConfirmed ? 'Payment Confirmed' : t('registerStudent.successTitle')}
          </h1>
          <p className="mt-4 text-muted">
            {cashRecorded
              ? `Successfully recorded ${displayAmount.toLocaleString()} ETB cash payment for ${firstName} ${lastName}.`
              : paymentConfirmed
                ? `Payment of ${displayAmount.toLocaleString()} ETB confirmed for ${firstName} ${lastName}.`
                : t('registerStudent.successMessage')
            }
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={onNavigate}
              className="rounded-[14px] bg-gold px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
            >
              {t('registerStudent.successViewList')}
            </button>
            <button
              onClick={resetForm}
              className="rounded-[14px] border border-black/10 bg-card px-6 py-3 text-sm font-semibold text-charcoal transition hover:border-gold hover:text-gold"
            >
              {t('registerStudent.successNew')}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── State: Payment method chooser (after registration created) ──
  if (createdRegistrationId && paymentMode === null) {
    return (
      <div className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] bg-card p-8 shadow-[0_10px_30px_rgba(0,0,0,.08)]"
          >
            <h1 className="font-display text-2xl font-bold text-charcoal">Registration Created</h1>
            <p className="mt-2 text-muted">
              Student <strong>{firstName} {lastName}</strong> has been registered.
              How would you like to record the payment?
            </p>
            <p className="mt-3 font-display text-xl font-bold text-gold">
              {displayAmount.toLocaleString()} ETB
              {paymentType === 'Half' && <span className="text-sm font-normal text-muted"> (half payment)</span>}
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => initChapaPayment(createdRegistrationId)}
                disabled={submitting}
                className="flex items-center justify-center gap-3 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader size={16} className="animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard size={18} /> Pay via Chapa (Online)</>
                )}
              </button>

              <button
                onClick={() => recordCashPayment(createdRegistrationId)}
                disabled={submitting}
                className="flex items-center justify-center gap-3 rounded-[14px] border-2 border-success bg-success/10 px-6 py-4 text-sm font-semibold text-success transition enabled:hover:-translate-y-0.5 disabled:opacity-60"
              >
                {submitting ? (
                  <><Loader size={16} className="animate-spin" /> Recording...</>
                ) : (
                  <><Banknote size={18} /> Record Cash Payment</>
                )}
              </button>

              <button
                onClick={resetForm}
                className="rounded-[14px] border border-black/10 bg-card px-6 py-3 text-sm font-semibold text-charcoal transition hover:border-gold hover:text-gold"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── State: Waiting for Chapa payment ──
  if (waitingForPayment) {
    return (
      <div className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)]"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold/15">
              <Loader size={32} className="animate-spin text-gold" />
            </div>
            <h1 className="mt-6 font-display text-2xl font-bold text-charcoal">
              Waiting for Payment
            </h1>
            <p className="mt-4 text-muted">
              The Chapa payment page has been opened in a new tab.
              Complete the payment there — this page will update automatically.
            </p>
            <p className="mt-2 text-sm text-muted">
              Amount: <strong>{displayAmount.toLocaleString()} ETB</strong>
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {chapaUrl && (
                <button
                  onClick={() => window.open(chapaUrl, '_blank')}
                  className="rounded-[14px] border border-gold bg-gold/10 px-6 py-3 text-sm font-semibold text-gold transition hover:bg-gold hover:text-white"
                >
                  Reopen Payment Page
                </button>
              )}
              <button
                onClick={() => {
                  if (pollingRef.current) clearInterval(pollingRef.current)
                  setWaitingForPayment(false)
                  setError('')
                  setPaymentMode(null)
                }}
                className="rounded-[14px] border border-black/10 bg-card px-6 py-3 text-sm font-semibold text-charcoal transition hover:border-danger hover:text-danger"
              >
                Cancel Payment
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── State: Registration form ──
  return (
    <div className="flex-1 p-6 md:p-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">
          {t('registerStudent.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-charcoal">
          {t('registerStudent.title')}
        </h1>
        <p className="mt-2 text-muted">{t('registerStudent.subtitle')}</p>

        {error && (
          <div role="alert" className="mt-6 rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-8">
          {/* ── Student Details ── */}
          <section className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
            <h2 className="font-display text-xl font-bold text-charcoal">
              {t('registerStudent.studentDetails')}
            </h2>
            <div className="mt-2 h-1 w-12 rounded-full bg-gold" />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-charcoal">
                {t('registerStudent.firstName')}
                <input
                  value={firstName}
                  onChange={e => { setFirstName(e.target.value); setFormErrors(prev => ({ ...prev, firstName: '' })) }}
                  placeholder={t('registerStudent.firstNamePlaceholder')}
                  className={inputClass('firstName')}
                />
              </label>
              <label className="block text-sm font-medium text-charcoal">
                {t('registerStudent.lastName')}
                <input
                  value={lastName}
                  onChange={e => { setLastName(e.target.value); setFormErrors(prev => ({ ...prev, lastName: '' })) }}
                  placeholder={t('registerStudent.lastNamePlaceholder')}
                  className={inputClass('lastName')}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-charcoal">
                {t('registerStudent.email')}
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setFormErrors(prev => ({ ...prev, email: '' })) }}
                  placeholder={t('registerStudent.emailPlaceholder')}
                  className={inputClass('email')}
                />
              </label>
              <label className="block text-sm font-medium text-charcoal">
                {t('registerStudent.phone')}
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setFormErrors(prev => ({ ...prev, phone: '' })) }}
                  placeholder={t('registerStudent.phonePlaceholder')}
                  className={inputClass('phone')}
                />
              </label>
            </div>

            {/* Education Level */}
            <label className="mt-6 block text-sm font-medium text-charcoal">
              {t('registerStudent.educationLevel')}
              <select
                value={educationLevel}
                onChange={e => { setEducationLevel(e.target.value); setFormErrors(prev => ({ ...prev, educationLevel: '' })) }}
                className={inputClass('educationLevel')}
              >
                <option value="">{t('registerStudent.selectLevel')}</option>
                {EDU_LEVELS.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>

            {/* Field of Study (conditional) */}
            {['Degree', 'Masters', 'PhD'].includes(educationLevel) && (
              <label className="mt-4 block text-sm font-medium text-charcoal">
                {t('registerStudent.fieldOfStudy')}
                <input
                  value={fieldOfStudy}
                  onChange={e => { setFieldOfStudy(e.target.value); setFormErrors(prev => ({ ...prev, fieldOfStudy: '' })) }}
                  placeholder={t('registerStudent.fieldOfStudyPlaceholder')}
                  className={inputClass('fieldOfStudy')}
                />
              </label>
            )}
          </section>

          {/* ── Program Selection ── */}
          <section className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
            <h2 className="font-display text-xl font-bold text-charcoal">
              {t('registerStudent.programSelection')}
            </h2>
            <p className="mt-1 text-sm text-muted">{t('registerStudent.programSelectionHint')}</p>
            <div className="mt-2 h-1 w-12 rounded-full bg-gold" />

            {loadingPrograms ? (
              <div className="mt-4 flex items-center gap-3 text-sm text-muted">
                <Loader size={16} className="animate-spin" />
                Loading programs…
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {programs.map(program => {
                  const id = String(program._id || program.id)
                  const selected = selectedPrograms.includes(id)
                  return (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                        selected
                          ? 'border-gold bg-gold/5'
                          : 'border-black/10 bg-card hover:border-black/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProgram(id)}
                        className="h-4 w-4 accent-gold"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-charcoal">{program.title}</p>
                        <p className="text-xs text-muted">
                          {Number(program.price).toLocaleString()} ETB
                          {program.allowsHalfPayment && ' · Half OK'}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
            {formErrors.programs && (
              <p role="alert" className="mt-2 text-sm text-danger">{formErrors.programs}</p>
            )}
          </section>

          {/* ── Schedule & Payment ── */}
          <section className="rounded-[20px] bg-card p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
            {/* Schedule */}
            <label className="block text-sm font-medium text-charcoal">
              {t('registerStudent.schedule')}
              <select
                value={schedule}
                onChange={e => { setSchedule(e.target.value); setFormErrors(prev => ({ ...prev, schedule: '' })) }}
                className={inputClass('schedule')}
              >
                <option value="">{t('registerStudent.selectSchedule')}</option>
                {SCHEDULE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            {/* Payment Type */}
            <div className="mt-6">
              <p className="text-sm font-medium text-charcoal">{t('registerStudent.paymentType')}</p>
              <div className="mt-3 flex gap-3">
                <label className={`flex-1 cursor-pointer rounded-[14px] border px-4 py-3 text-center text-sm transition ${
                  paymentType === 'Full' ? 'border-gold bg-gold/5 font-semibold' : 'border-black/10 hover:border-black/30'
                }`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="Full"
                    checked={paymentType === 'Full'}
                    onChange={() => setPaymentType('Full')}
                    className="sr-only"
                  />
                  {t('registerStudent.fullPayment')}
                </label>
                <label className={`flex-1 cursor-pointer rounded-[14px] border px-4 py-3 text-center text-sm transition ${
                  paymentType === 'Half' ? 'border-gold bg-gold/5 font-semibold' : 'border-black/10 hover:border-black/30'
                }`}>
                  <input
                    type="radio"
                    name="paymentType"
                    value="Half"
                    checked={paymentType === 'Half'}
                    onChange={() => setPaymentType('Half')}
                    className="sr-only"
                  />
                  {t('registerStudent.halfPayment')}
                </label>
              </div>
            </div>

            {/* Total */}
            {selectedPrograms.length > 0 && (
              <div className="mt-6 rounded-xl bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-charcoal">{t('registerStudent.total')}</span>
                  <span className="font-display text-xl font-bold text-charcoal">
                    {displayAmount.toLocaleString()} ETB
                  </span>
                </div>
                {paymentType === 'Half' && (
                  <p className="mt-1 text-xs text-muted">
                    Paying now: {displayAmount.toLocaleString()} ETB · Remaining: {(total - displayAmount).toLocaleString()} ETB
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Submit Button ── */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <><Loader size={16} className="animate-spin" /> {t('registerStudent.processing')}</>
              ) : (
                <><UserPlus size={16} /> {t('registerStudent.registerAndPay')}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
