import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle, Eye, EyeOff, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { changeAdminPassword, storeTokens } from '../utils/api'
import { fadeUp } from '../utils/helpers'

export function ChangePasswordView() {
  useAuth() // ensure AuthProvider is mounted
  const { t } = useLanguage()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordsMatch = newPassword === confirmNewPassword
  const newIsLongEnough = newPassword.length >= 8
  const canSubmit = currentPassword.length > 0 && newPassword.length > 0 && confirmNewPassword.length > 0 && passwordsMatch && newIsLongEnough

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await changeAdminPassword(currentPassword, newPassword, confirmNewPassword)
      if (result.success) {
        // Save the fresh tokens issued by the backend so the session stays valid.
        // All tokens issued BEFORE the password change are automatically invalidated
        // because their iat < password_changed_at in the auth middleware.
        if (result.accessToken && result.refreshToken) {
          storeTokens(result.accessToken, result.refreshToken)
        }
        setSuccess(result.message || t('changePassword.success'))
        setCurrentPassword('')
        setNewPassword('')
        setConfirmNewPassword('')
      } else {
        setError(result.message || t('changePassword.error'))
      }
    } catch {
      setError(t('changePassword.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-gold'

  return (
    <section className="flex-1 px-6 py-8 md:px-12 md:py-12">
      <motion.div {...fadeUp} className="mx-auto max-w-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('changePassword.eyebrow')}</p>
        <h1 className="mt-3 font-display text-4xl font-bold text-charcoal">{t('changePassword.title')}</h1>
        <p className="mt-3 text-sm text-muted">{t('changePassword.subtitle')}</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div role="alert" className="flex items-start gap-3 rounded-[14px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          {success && (
            <div role="alert" className="flex items-start gap-3 rounded-[14px] border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              <CheckCircle size={16} className="mt-0.5 shrink-0" /><span>{success}</span>
            </div>
          )}

          <label className="block text-sm font-medium text-charcoal">
            {t('changePassword.currentPassword')}
            <div className="relative mt-2">
              <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t('changePassword.currentPasswordPlaceholder')} autoComplete="current-password" className={inputClass} />
              <button type="button" onClick={() => setShowCurrent((p) => !p)} aria-label={showCurrent ? t('common.hidePassword') : t('common.showPassword')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-charcoal">
                {showCurrent ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>

          <label className="block text-sm font-medium text-charcoal">
            {t('changePassword.newPassword')}
            <div className="relative mt-2">
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('changePassword.newPasswordPlaceholder')} autoComplete="new-password" className={inputClass} />
              <button type="button" onClick={() => setShowNew((p) => !p)} aria-label={showNew ? t('common.hidePassword') : t('common.showPassword')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-charcoal">
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {newPassword.length > 0 && !newIsLongEnough && <p className="mt-2 text-sm text-danger">{t('changePassword.minLength')}</p>}
          </label>

          <label className="block text-sm font-medium text-charcoal">
            {t('changePassword.confirmPassword')}
            <div className="relative mt-2">
              <input type={showConfirm ? 'text' : 'password'} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder={t('changePassword.confirmPasswordPlaceholder')} autoComplete="new-password" className={inputClass} />
              <button type="button" onClick={() => setShowConfirm((p) => !p)} aria-label={showConfirm ? t('common.hidePassword') : t('common.showPassword')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-charcoal">
                {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {confirmNewPassword.length > 0 && !passwordsMatch && <p className="mt-2 text-sm text-danger">{t('changePassword.mismatch')}</p>}
          </label>

          <button type="submit" disabled={!canSubmit || isSubmitting}
            className="w-full rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader size={16} className="animate-spin" />{t('changePassword.updating')}</span> : t('changePassword.title')}
          </button>
        </form>

        {success && (
          <p className="mt-6 text-center text-sm text-muted">
            {t('changePassword.reloginNote')}
          </p>
        )}
      </motion.div>
    </section>
  )
}
