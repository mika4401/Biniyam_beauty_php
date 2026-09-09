import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { Banknote, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, GraduationCap, Image, Loader, Mail, Phone, Search, X } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchRegistrations, fetchRegistrationPayments, recordSecondPayment, updateRegistrationStatus } from '../utils/api'
import type { Registration, Payment, Program, Student } from '../types/api'
import { fadeUp, formatPrice, regStatusVariant, scheduleLabel, drawerScheduleLabel, statusLabelKey } from '../utils/helpers'
import { DetailItem, PaymentTypeBadge, StatusPillVariant } from '../components/ui'

export function RegistrationsView() {
  const { t } = useLanguage()
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [totalRegs, setTotalRegs] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalRegs / limit))

  const fetchData = useCallback(async (p: number, s: string, st: string) => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { page: String(p), limit: String(limit) }
      if (s.trim()) params.search = s.trim()
      if (st === 'Half') {
        // "Half paid" is a combined paymentType/status filter — the list endpoint
        // exposes it via the `filter` param (mirrors the dashboard half-paid filter)
        params.filter = 'halfPaid'
      } else if (st) {
        params.status = st
      }
      const res = await fetchRegistrations(params)
      if (res.success && res.data) {
        setRegistrations(res.data || [])
        setTotalRegs(res.pagination?.total || 0)
      }
    } catch { setError(t('registrations.error.load')) }
    finally { setLoading(false) }
  }, [limit, t])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(page, search, statusFilter)
  }, [page, search, statusFilter, fetchData])

  const openDrawer = (reg: Registration) => { setSelectedReg(reg); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setSelectedReg(null), 200) }

  return (
    <section className="flex-1 px-6 py-8 md:px-12 md:py-12">
      <motion.header {...fadeUp}>
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('registrations.eyebrow')}</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-charcoal">{t('nav.registrations')}</h1>
        <p className="mt-3 text-sm text-muted">{t('registrations.subtitle')}</p>
      </motion.header>

      {/* Search + filters */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('registrations.searchPlaceholder')}
            className="w-full rounded-[14px] border border-black/10 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-gold" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-[14px] border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-gold">
          <option value="">{t('registrations.filter.all')}</option>
          <option value="Pending">{t('status.pending')}</option>
          <option value="Confirmed">{t('status.confirmed')}</option>
          <option value="Paid">{t('status.paid')}</option>
          <option value="Half">{t('status.halfPaid')}</option>
          <option value="Cancelled">{t('status.cancelled')}</option>
        </select>
      </div>

      {error && <div role="alert" className="mt-6 rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">{error}</div>}

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-[20px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.08)]">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader size={28} className="animate-spin text-gold" /></div>
        ) : registrations.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted">{t('registrations.empty')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-surface text-muted">
                  <tr>
                    <th className="px-6 py-4 font-medium">{t('recent.student')}</th>
                    <th className="px-6 py-4 font-medium">{t('registrations.table.programs')}</th>
                    <th className="px-6 py-4 font-medium">{t('dashboard.schedule')}</th>
                    <th className="px-6 py-4 font-medium">{t('registrations.table.type')}</th>
                    <th className="px-6 py-4 font-medium">{t('recent.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => {
                    const regTyped = reg
                    const student = (typeof regTyped.student === 'object' ? regTyped.student : { firstName: '', lastName: '', email: '' }) as Student
                    const progs = (regTyped.programs || []) as Program[]
                    return (
                      <tr key={regTyped._id}
                        onClick={() => openDrawer(reg)}
                        className="cursor-pointer border-t border-black/5 transition-colors hover:bg-gold/5">
                        <td className="px-6 py-5">
                          <p className="font-semibold text-charcoal">{(student.firstName) || ''} {(student.lastName) || ''}</p>
                          <p className="mt-1 text-xs text-muted">{student.email}</p>
                        </td>
                        <td className="px-6 py-5 text-muted">{progs.map((p) => p.title).join(', ')}</td>
                        <td className="px-6 py-5 text-muted">{scheduleLabel(reg.schedule, t)}</td>
                        <td className="px-6 py-5"><PaymentTypeBadge type={reg.paymentType} /></td>
                        <td className="px-6 py-5"><StatusPillVariant variant={regStatusVariant(reg)} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-black/5 px-6 py-4">
              <p className="text-sm text-muted">{t('registrations.page')} {page} {t('registrations.of')} {totalPages} ({totalRegs} {t('registrations.total')})</p>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-charcoal transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-black/10 text-charcoal transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {drawerOpen && selectedReg && (
          <RegistrationDetailDrawer reg={selectedReg} onClose={closeDrawer} onUpdate={() => fetchData(page, search, statusFilter)} />
        )}
      </AnimatePresence>
    </section>
  )
}

function RegistrationDetailDrawer({ reg, onClose, onUpdate }: {
  reg: Registration
  onClose: () => void
  onUpdate: () => void
}) {
  const { t } = useLanguage()
  const student = (typeof reg.student === 'object' ? reg.student : { _id: '', firstName: '', lastName: '', email: '', phone: '' })
  const programs = (reg.programs || []) as Program[]
  const [payments, setPayments] = useState<Payment[]>([])
  const [totalPaid, setTotalPaid] = useState(0)
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const totalCost = programs.reduce((sum, p) => sum + (p.price || 0), 0)
  const remainingBalance = Math.max(0, totalCost - totalPaid)
  const isHalfPaidNotComplete = reg.paymentType === 'Half' && reg.status !== 'Paid'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetchRegistrationPayments(reg._id)
        if (!cancelled && res.success && res.data) {
    const payData = res.data as { payments: Payment[]; totalPaid: number }
    setPayments(payData.payments || [])
    setTotalPaid(payData.totalPaid || 0)
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setPaymentsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [reg._id])

  const handleMarkFullyPaid = async () => {
    setActionMsg('')
    try {
      const res = await recordSecondPayment(reg._id)
      if (res.success) {
        setActionMsg(t('drawer.markedFullyPaid'))
        onUpdate()
        // Refresh payments
        const refreshed = await fetchRegistrationPayments(reg._id)
        if (refreshed.success && refreshed.data) {
    const payData = refreshed.data as { payments: Payment[]; totalPaid: number }
    setPayments(payData.payments || [])
    setTotalPaid(payData.totalPaid || 0)
        }
      } else {
        setActionMsg(res.message || t('messages.failedRecordPayment'))
      }
    } catch { setActionMsg(t('messages.errorOccurred')) }
  }

  const handleUpdateStatus = async (status: string) => {
    setActionMsg('')
    try {
      const res = await updateRegistrationStatus(reg._id, status)
      if (res.success) {
        setActionMsg(t('drawer.statusUpdatedMessage').replace('{status}', status))
        onUpdate()
      } else {
        setActionMsg(res.message || t('messages.failedUpdateStatus'))
      }
    } catch { setActionMsg(t('messages.errorOccurred')) }
  }

  const formatDate = (d: unknown) => {
    if (!d) return '—'
    return new Date(d as string).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const drawerVariants: Variants = {
    hidden: { x: '100%' },
    visible: { x: 0, transition: { type: 'spring', damping: 25, stiffness: 250 } },
    exit: { x: '100%', transition: { duration: 0.15 } },
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <motion.aside variants={drawerVariants} initial="hidden" animate="visible" exit="exit"
        className="relative w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('drawer.registration')}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-charcoal">
              {(student.firstName) || ''} {(student.lastName) || ''}
            </h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-surface hover:text-charcoal">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">
          {/* Action message */}
          {actionMsg && (
            <div className={`rounded-[14px] border px-5 py-4 text-sm ${
              actionMsg.includes('error') || actionMsg.includes('Failed')
                ? 'border-danger/30 bg-danger/10 text-danger'
                : 'border-success/30 bg-success/10 text-success'
            }`}>
              {actionMsg}
            </div>
          )}

          {/* Student info */}
          <section>
            <h3 className="font-display text-xl font-bold text-charcoal">{t('drawer.studentDetails')}</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailItem icon={<Mail size={16} />} label={t('drawer.email')} value={student.email} />
              <DetailItem icon={<Phone size={16} />} label={t('drawer.phone')} value={student.phone} />
              <DetailItem icon={<BookOpen size={16} />} label={t('drawer.education')} value={(student.educationLevel as string) || '—'} />
              {['Degree', 'Masters', 'PhD'].includes(student.educationLevel as string) && (
                <DetailItem icon={<GraduationCap size={16} />} label={t('drawer.fieldOfStudy')} value={(student.fieldOfStudy as string) || '—'} />
              )}
              <DetailItem icon={<CalendarDays size={16} />} label={t('drawer.registered')} value={formatDate(reg.createdAt)} />
              {reg.paymentType && (
                <DetailItem icon={<CreditCard size={16} />} label={t('drawer.paymentPlan')} value={reg.paymentType === 'Half' ? t('drawer.halfPayment') : t('drawer.fullPayment')} />
              )}
            </div>

            {/* National ID image */}
            {(() => {
              const idUrl = student.nationalIdImage || student.nationalId
              if (!idUrl) return null
              return (
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted mb-2">
                    <Image size={14} className="inline mr-1" />
                    {t('drawer.nationalId')}
                  </p>
                  <button
                    onClick={() => window.open(idUrl, '_blank')}
                    className="group relative block w-full overflow-hidden rounded-xl border border-black/10 bg-surface transition hover:border-gold"
                  >
                    <img
                      src={idUrl}
                      alt={t('drawer.nationalId')}
                      className="h-48 w-full object-contain p-2 transition group-hover:scale-105"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-sm font-medium text-white transition group-hover:bg-black/40 group-hover:opacity-100 opacity-0">
                      {t('drawer.clickToViewFull')}
                    </span>
                  </button>
                </div>
              )
            })()}
          </section>

          {/* Programs */}
          <section>
            <h3 className="font-display text-xl font-bold text-charcoal">{t('drawer.enrolledPrograms')}</h3>
            <div className="mt-4 space-y-3">
              {programs.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-[14px] bg-surface px-4 py-3">
                  <div><p className="font-medium text-charcoal">{p.title}</p><p className="text-xs text-muted">{p.duration || ''}</p></div>
                  <p className="font-semibold text-charcoal">{p.price ? formatPrice(p.price) : ''}</p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-[14px] bg-gold/10 px-4 py-3">
                <p className="font-semibold text-charcoal">{t('drawer.totalCost')}</p>
                <p className="font-display text-lg font-bold text-charcoal">{formatPrice(totalCost)}</p>
              </div>
            </div>
          </section>

          {/* Schedule */}
          <section>
            <h3 className="font-display text-xl font-bold text-charcoal">{t('drawer.schedule')}</h3>
            <p className="mt-2 text-sm text-muted">{drawerScheduleLabel(reg.schedule, t)}</p>
            <div className="mt-3"><StatusPillVariant variant={regStatusVariant(reg)} /></div>
          </section>

          {/* Payment history */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-charcoal">{t('drawer.paymentHistory')}</h3>
              <span className="text-sm font-semibold text-success">{formatPrice(totalPaid)} {t('drawer.paid')}</span>
            </div>
            {paymentsLoading ? (
              <div className="mt-4 flex items-center justify-center py-8"><Loader size={20} className="animate-spin text-gold" /></div>
            ) : payments.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t('drawer.noPayments')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {payments.map((pmt) => (
                  <div key={pmt._id} className="flex items-center justify-between rounded-[14px] border border-black/5 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${pmt.status === 'Completed' ? 'bg-success' : 'bg-warning'}`} />
                        <p className="text-sm font-medium text-charcoal">{pmt.method as string}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">{formatDate(pmt.createdAt)}</p>
                      {pmt.notes && <p className="mt-1 text-xs text-muted italic">{pmt.notes}</p>}
                    </div>
                    <p className="text-sm font-semibold text-charcoal">{formatPrice(pmt.amount)}</p>
                  </div>
                ))}
              </div>
            )}
            {remainingBalance > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-[14px] bg-warning/10 px-4 py-3">
                <p className="text-sm font-medium text-warning">{t('drawer.remainingBalance')}</p>
                <p className="text-sm font-bold text-warning">{formatPrice(remainingBalance)}</p>
              </div>
            )}
          </section>

          {/* Actions */}
          <section className="border-t border-black/10 pt-6">
            <h3 className="font-display text-xl font-bold text-charcoal">{t('drawer.actions')}</h3>
            <div className="mt-4 space-y-3">
              {/* Mark as fully paid (for Half registrations) */}
              {isHalfPaidNotComplete && (
                <button onClick={handleMarkFullyPaid}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-success px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
                  <Check size={18} />{t('drawer.markFullyPaid')}
                </button>
              )}

              {/* Record manual payment */}
              <button onClick={() => setShowPaymentForm(!showPaymentForm)}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-gold bg-white px-6 py-4 text-sm font-semibold text-gold transition hover:-translate-y-0.5">
                <Banknote size={18} />{showPaymentForm ? t('common.cancel') : t('drawer.recordManualPayment')}
              </button>

              {/* Manual payment form */}
              {showPaymentForm && (
                <ManualPaymentForm
                  regId={reg._id}
                  remainingBalance={remainingBalance}
                  onSuccess={() => {
                    setShowPaymentForm(false)
                    setActionMsg(t('drawer.paymentRecorded'))
                    onUpdate()
                    // Refresh payments
                    fetchRegistrationPayments(reg._id).then((r) => {
                      if (r.success && r.data) {
                        const payData = r.data as { payments: Payment[]; totalPaid: number }
                        setPayments(payData.payments || [])
                        setTotalPaid(payData.totalPaid || 0)
                      }
                    })
                  }}
                />
              )}

              {/* Status management */}
              <div className="pt-4">
                <p className="text-sm font-medium text-charcoal mb-3">{t('drawer.updateStatus')}</p>
                <div className="flex flex-wrap gap-2">
                  {['Pending', 'Confirmed', 'Paid', 'Cancelled'].map((status) => (
                    <button key={status} disabled={reg.status === status}
                      onClick={() => handleUpdateStatus(status)}
                      className={`rounded-[10px] px-4 py-2 text-xs font-semibold transition ${
                        reg.status === status
                          ? 'bg-charcoal text-white cursor-default'
                          : 'bg-surface text-muted hover:bg-gold/10 hover:text-gold'
                      }`}>
                      {t(statusLabelKey[status] || 'status.pending')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </motion.aside>
    </motion.div>
  )
}

function ManualPaymentForm({ regId, remainingBalance, onSuccess }: {
  regId: string
  remainingBalance: number
  onSuccess: () => void
}) {
  const { t } = useLanguage()
  const [amount, setAmount] = useState(String(remainingBalance))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const amountNum = Number(amount)
  const isValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= remainingBalance

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      setError(t('drawer.invalidAmount'))
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const res = await recordSecondPayment(regId, amountNum)
      if (res.success) {
        onSuccess()
      } else {
        setError(res.message || t('messages.failedRecordPayment'))
      }
    } catch { setError(t('messages.errorOccurred')) }
    finally { setIsSubmitting(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] bg-surface p-4 space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="rounded-[12px] border border-warning/20 bg-warning/5 px-4 py-3">
        <p className="text-xs text-muted">{t('drawer.remainingBalanceToCollect')}</p>
        <p className="text-lg font-bold text-charcoal">{formatPrice(remainingBalance)}</p>
        <p className="mt-1 text-xs text-muted">{t('drawer.cashNote')}</p>
      </div>
      <div>
        <label htmlFor="payment-amount" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-muted">
          {t('drawer.amountLabel')}
        </label>
        <input
          id="payment-amount"
          type="number"
          min={1}
          max={Math.max(1, remainingBalance)}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-[12px] border border-black/10 bg-white px-4 py-3 text-sm text-charcoal outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <p className="mt-1 text-xs text-muted">{t('drawer.amountHint').replace('{remaining}', formatPrice(remainingBalance))}</p>
      </div>
      <button type="submit" disabled={isSubmitting || remainingBalance <= 0 || !isValid}
        className="w-full rounded-[14px] bg-gold px-6 py-3 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? t('drawer.recording') : t('drawer.confirmCashPayment').replace('{amount}', formatPrice(amountNum > 0 && amountNum <= remainingBalance ? amountNum : remainingBalance))}
      </button>
    </form>
  )
}
