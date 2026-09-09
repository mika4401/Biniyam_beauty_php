import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Loader, ReceiptText, Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { fetchRegistrationStats, fetchRegistrations } from '../utils/api'
import type { Registration, RegistrationStats, Program } from '../types/api'
import { fadeUp, formatPrice, regStatusVariant, scheduleLabel } from '../utils/helpers'
import { ClickableMetric, Metric, StatusPillVariant } from '../components/ui'

type DashboardFilter = 'all' | 'paidInFull' | 'halfPaid'

export function DashboardView() {
  const { admin } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState<RegistrationStats | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [filterStatus, setFilterStatus] = useState<DashboardFilter>('all')
  const [page, setPage] = useState(1)
  const [totalRegs, setTotalRegs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(totalRegs / PAGE_SIZE))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setError('')
      try {
        const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) }
        if (filterStatus !== 'all') params.filter = filterStatus
        const [statsRes, regsRes] = await Promise.all([
          fetchRegistrationStats(),
          fetchRegistrations(params),
        ])
        if (cancelled) return
        if (statsRes.success && statsRes.data) setStats(statsRes.data)
        if (regsRes.success && regsRes.data) {
          setRegistrations(regsRes.data)
          setTotalRegs(regsRes.pagination?.total || 0)
        }
      } catch { if (!cancelled) setError(t('dashboard.error.load')) }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [t, page, filterStatus])

  const total = (stats?.total as number) || 0
  const paidInFull = (stats?.paidInFull as number) || 0
  const halfPaid = (stats?.halfPaid as number) || 0
  const totalCollected = (stats?.totalCollected as number) || 0
  const programCounts = (stats?.programCounts as { title: string; count: number; _id: string }[]) || []
  const activePrograms = programCounts.length
  const maxProgCount = programCounts.length > 0 ? Math.max(...programCounts.map((p) => p.count)) : 1

  if (loading) {
    return <section className="flex flex-1 items-center justify-center"><Loader size={28} className="animate-spin text-gold" /></section>
  }

  return (
    <section className="flex-1 px-6 py-8 md:px-12 md:py-12">
      <motion.header {...fadeUp} className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('overview.eyebrow')}</p>
          <h1 className="mt-3 font-display text-4xl font-bold text-charcoal">
            {t('dashboard.goodMorning')}{admin ? `, ${admin.fullName.split(' ')[0]}` : ''}.
          </h1>
          <p className="mt-3 text-sm text-muted">{t('overview.paragraph')}</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-medium text-muted">
          <ArrowUpRight size={16} className="text-gold" />{formatPrice(totalCollected)} {t('dashboard.collected')}
        </span>
      </motion.header>

      {error && <div role="alert" className="mt-6 rounded-[14px] border border-danger/30 bg-danger/10 px-5 py-4 text-sm text-danger">{error}</div>}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t('metric.totalRegistrations')} value={String(total)} icon={<Users size={20} />} />
        <ClickableMetric label={t('metric.paidInFull')} value={String(paidInFull)} icon={<Check size={20} />} tone="success"
          active={filterStatus === 'paidInFull'} onClick={() => { setFilterStatus(filterStatus === 'paidInFull' ? 'all' : 'paidInFull'); setPage(1) }} />
        <ClickableMetric label={t('metric.paidHalf')} value={String(halfPaid)} icon={<ReceiptText size={20} />} tone="warning"
          active={filterStatus === 'halfPaid'} onClick={() => { setFilterStatus(filterStatus === 'halfPaid' ? 'all' : 'halfPaid'); setPage(1) }} />
        <Metric label={t('metric.activePrograms')} value={String(activePrograms)} icon={<BookOpen size={20} />} />
      </section>

      {filterStatus !== 'all' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span>{t('dashboard.showing').replace('{filter}', filterStatus === 'paidInFull' ? t('dashboard.paidInFull') : t('dashboard.halfPaid'))}</span>
          <button onClick={() => { setFilterStatus('all'); setPage(1) }} className="text-gold underline transition hover:text-gold/80">{t('dashboard.clearFilter')}</button>
        </div>
      )}

      <section className="mt-4 grid gap-8 xl:grid-cols-[1.55fr_1fr]">
        <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_10px_30px_rgba(0,0,0,.08)]">
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-charcoal">
                {filterStatus === 'paidInFull' ? t('dashboard.headingPaidInFull') : filterStatus === 'halfPaid' ? t('dashboard.headingHalfPaid') : t('recent.title')}
              </h2>
              <p className="mt-1 text-sm text-muted">{totalRegs} {t(totalRegs !== 1 ? 'dashboard.registrations' : 'dashboard.registration')}</p>
            </div>
            <ReceiptText className="text-gold" size={22} />
          </div>
          {registrations.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted">{t('dashboard.filter.empty')}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-surface text-muted">
                    <tr><th className="px-6 py-4 font-medium">{t('recent.student')}</th><th className="px-6 py-4 font-medium">{t('recent.program')}</th><th className="px-6 py-4 font-medium">{t('dashboard.schedule')}</th><th className="px-6 py-4 font-medium">{t('recent.status')}</th></tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg) => {
                      const regTyped = reg
                      const student = (typeof regTyped.student === 'object' ? regTyped.student : { _id: '', firstName: '', lastName: '', email: '', phone: '' })
                      const progs = (regTyped.programs || []) as Program[]
                      return (
                        <tr key={reg._id} className="border-t border-black/5">
                          <td className="px-6 py-5">
                            <p className="font-semibold text-charcoal">{(student.firstName) || ''} {(student.lastName) || ''}</p>
                            <p className="mt-1 text-xs text-muted">{student.email}</p>
                          </td>
                          <td className="px-6 py-5 text-muted">{progs.map((p) => p.title).join(', ')}</td>
                          <td className="px-6 py-5 text-muted">{scheduleLabel(reg.schedule, t)}</td>
                          <td className="px-6 py-5"><StatusPillVariant variant={regStatusVariant(reg)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
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
              )}
            </>
          )}
        </div>

        <div className="rounded-[20px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
          <div className="flex items-start justify-between">
            <div><h2 className="font-display text-2xl font-bold text-charcoal">{t('demand.title')}</h2><p className="mt-1 text-sm text-muted">{t('demand.subtitle')}</p></div>
            <BookOpen className="text-gold" size={22} />
          </div>
          {programCounts.length === 0 ? (
            <p className="mt-8 text-sm text-muted">{t('demand.empty')}</p>
          ) : (
            <>
              <div className="mt-8 space-y-6">
                {programCounts.map((program) => (
                  <div key={program._id}>
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <p className="font-medium text-charcoal">{program.title}</p>
                      <p className="shrink-0 text-muted">{program.count}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gold transition-all duration-500" style={{ width: `${Math.max(4, Math.round((program.count / maxProgCount) * 100))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-[14px] bg-surface p-4">
                <p className="text-sm font-semibold text-charcoal">{t('demand.mostRequested')}</p>
                <p className="mt-1 text-sm text-muted">{programCounts[0]?.title || '—'} {t('demand.leadsCurrent')} ({programCounts[0]?.count || 0}).</p>
              </div>
            </>
          )}
        </div>
      </section>
    </section>
  )
}
