import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle, CreditCard, Loader, ReceiptText, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useLanguage } from '../i18n/LanguageContext'
import { API_BASE, formatPrice, fadeUp } from '../constants'
import type { Payment } from '../types/api'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

/** Payment /payment/success and /payment/result page */
export function PaymentResultPage() {
  const { t, language } = useLanguage()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const txRef = searchParams.get('tx_ref')
  const statusParam = searchParams.get('status')

  const [pageState, setPageState] = useState<'verifying' | 'success' | 'failed' | 'error'>('verifying')
  const [paymentData, setPaymentData] = useState<Payment | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    /* eslint-disable react-hooks/set-state-in-effect */

    if (!txRef) {
      setPageState('error')
      setErrorMsg(t('payment.noReference'))
      return
    }

    let initialStatusFromParam: '' | 'success' | 'failed' = ''
    if (statusParam) {
      if (statusParam === 'Completed' || statusParam === 'success') {
        initialStatusFromParam = 'success'
      } else if (statusParam === 'Failed' || statusParam === 'failed') {
        initialStatusFromParam = 'failed'
      }
    }

    // Set the state immediately from statusParam for snappy UX
    if (initialStatusFromParam) {
      setPageState(initialStatusFromParam)
      // NOTE: Do NOT return — we still need to fetch paymentData for the receipt
    } else {
      setPageState('verifying')
    }

    const verifyPayment = async () => {
    try {
      const response = await fetch(`${API_BASE}/chapa/verify/${encodeURIComponent(txRef)}`)
      const result = await response.json()
      if (cancelled) return

      if (result.success && result.data) {
        setPaymentData(result.data as Payment)
        const dataStatus = String(result.data.status ?? '')
        // Only update page state if not already set from statusParam
        if (!initialStatusFromParam) {
          if (dataStatus === 'Completed') {
            setPageState('success')
          } else if (dataStatus === 'Failed' || dataStatus === 'Refunded') {
            setPageState('failed')
          } else {
            setErrorMsg(`${t('payment.statusPrefix')} ${dataStatus}. ${t('payment.checkLater')}`)
            setPageState('error')
          }
        }
      } else if (!initialStatusFromParam) {
        setErrorMsg(result.message || t('payment.verifyError'))
        setPageState('error')
      }
    } catch {
      if (!initialStatusFromParam) {
        setErrorMsg(t('payment.serverError'))
        setPageState('error')
      }
    }
    }

    verifyPayment()

    /* eslint-enable react-hooks/set-state-in-effect */
    return () => { cancelled = true }
  }, [txRef, statusParam, t])

  if (pageState === 'verifying') {
    return <PaymentResultShell>
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/10">
        <Loader size={40} className="animate-spin text-gold" />
      </span>
      <h1 className="mt-8 font-display text-4xl font-bold text-charcoal">{t('payment.verifying')}</h1>
      <p className="mt-4 leading-7 text-muted">{t('payment.verifyingParagraph')}</p>
    </PaymentResultShell>
  }

  if (pageState === 'success') {
    const chapaReference = paymentData?.chapaReference
    return <PaymentResultShell>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle size={40} />
        </span>
      </motion.div>
      <motion.h1 {...fadeUp} className="mt-8 font-display text-4xl font-bold text-charcoal">{t('payment.successTitle')}</motion.h1>
      <motion.p {...fadeUp} className="mt-4 leading-7 text-muted">{t('payment.successParagraph')}</motion.p>
      {paymentData && (
        <motion.div {...fadeUp} className="mt-8 w-full rounded-[20px] bg-surface p-6 text-left print:border print:border-black/10 print:shadow-none">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-gold print:text-charcoal">{t('payment.receipt')}</h2>
            <button onClick={() => window.print()} className="print:hidden inline-flex items-center gap-1.5 rounded-[10px] border border-gold px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold hover:text-white">
              <ReceiptText size={14} /> {t('payment.print')}
            </button>
          </div>
          <div className="mt-2 border-t border-black/5 dark:border-white/10 pt-3 text-center">
            <p className="text-lg font-semibold text-charcoal">{t('nav.brandPrimary')} {t('nav.brandAccent')} {t('nav.academy')}</p>
          </div>
          <div className="mt-4 space-y-3">
            <DetailRow label={t('payment.reference')} value={txRef!} />
            {(() => {
              const reg = typeof paymentData.registration === 'object' ? paymentData.registration : null
              const programsArr = reg?.programs ?? []
              const titles = programsArr
                .map((p) => (typeof p === 'object' ? (language === 'am' ? p.titleAm || p.title : p.title) : p))
                .filter(Boolean)
                .join(', ')
              if (!titles) return null
              return <DetailRow label={programsArr.length === 1 ? t('payment.program') : t('payment.programs')} value={titles} />
            })()}
            {(() => {
              const student = typeof paymentData.registration === 'object' && typeof paymentData.registration.student === 'object'
                ? paymentData.registration.student
                : null
              if (!student) return null
              return <DetailRow label={t('payment.student')} value={`${student.firstName} ${student.lastName}`} />
            })()}
            {paymentData.amount > 0 && (
              <DetailRow label={t('payment.amount')} value={formatPrice(paymentData.amount)} />
            )}
            <div className="border-t border-black/5 dark:border-white/10 pt-3">
              <DetailRow label={t('payment.status')} value={t('payment.completed')} />
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted print:text-charcoal/60">{t('payment.thankYou')}</p>
        </motion.div>
      )}          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <motion.button {...fadeUp} onClick={() => window.print()} className="print:hidden inline-flex items-center gap-2 rounded-[14px] border border-gold bg-card px-6 py-4 text-sm font-semibold text-gold transition hover:-translate-y-0.5">
              <ReceiptText size={16} /> {t('payment.printReceipt')}
            </motion.button>
            {chapaReference && (
              <motion.button
                {...fadeUp}
                onClick={() => window.open(`https://checkout.chapa.co/checkout/test-payment-receipt/${chapaReference}`, '_blank')}
                className="inline-flex items-center gap-2 rounded-[14px] border border-gold bg-card px-6 py-4 text-sm font-semibold text-gold transition hover:-translate-y-0.5"
              >
                <CreditCard size={16} /> {t('payment.officialChapa')}
              </motion.button>
            )}
            <motion.button {...fadeUp} onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
              <ArrowLeft size={16} /> {t('payment.backHome')}
            </motion.button>
          </div>
    </PaymentResultShell>
  }

  if (pageState === 'failed') {
    return <PaymentResultShell>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-danger/15 text-danger">
          <XCircle size={40} />
        </span>
      </motion.div>
      <motion.h1 {...fadeUp} className="mt-8 font-display text-4xl font-bold text-charcoal">{t('payment.failedTitle')}</motion.h1>
      <motion.p {...fadeUp} className="mt-4 leading-7 text-muted">{t('payment.failedParagraph')}</motion.p>
      <motion.button {...fadeUp} onClick={() => navigate('/')} className="mt-8 inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
        <ArrowLeft size={16} /> {t('payment.backHome')}
      </motion.button>
    </PaymentResultShell>
  }

  // Error state
  return <PaymentResultShell>
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-warning/15 text-warning">
        <AlertTriangle size={40} />
      </span>
    </motion.div>
    <motion.h1 {...fadeUp} className="mt-8 font-display text-4xl font-bold text-charcoal">{t('payment.errorTitle')}</motion.h1>
    <motion.p {...fadeUp} className="mt-4 leading-7 text-muted">{errorMsg}</motion.p>
    {txRef && <p className="mt-2 text-xs text-muted">{t('payment.referenceLabel')} {txRef}</p>}
    <motion.button {...fadeUp} onClick={() => navigate('/')} className="mt-8 inline-flex items-center gap-2 rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5">
      <ArrowLeft size={16} /> {t('payment.backHome')}
    </motion.button>
  </PaymentResultShell>
}

/** Card shell for payment result pages */
function PaymentResultShell({ children }: { children: ReactNode }) {
  return <>
    <Navbar />
    <main className="grid min-h-screen place-items-center bg-surface px-6 pt-24">
      <motion.section {...fadeUp} className="flex w-full max-w-lg flex-col items-center rounded-[20px] bg-card p-8 text-center shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-12">
        {children}
      </motion.section>
    </main>
    <Footer />
  </>
}

/** A label–value row for transaction details */
function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 text-sm">
    <span className="text-muted">{label}</span>
    <span className="max-w-[60%] truncate font-medium text-charcoal">{value}</span>
  </div>
}
