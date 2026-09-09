import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Eye, EyeOff, GraduationCap, Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { validateEmail } from '../utils/security'
import { fadeUp } from '../utils/helpers'

export function LoginPage() {
  const { login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) { setError(t('login.errors.required')); return }
    const emailResult = validateEmail(trimmedEmail)
    if (!emailResult.valid) { setError(emailResult.error === 'Email address is required.' ? t('login.errors.emailRequired') : t('login.errors.emailInvalid')); return }
    if (password.length < 6) { setError(t('login.errors.passwordLength')); return }
    setIsSubmitting(true)
    const result = await login(trimmedEmail, password)
    setIsSubmitting(false)
    if (result.success) { navigate('/', { replace: true }) }
    else { setError(result.message || t('login.errors.failed')) }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6">
      <motion.section {...fadeUp} className="w-full max-w-md">
        <div className="rounded-[20px] bg-white p-8 shadow-[0_10px_30px_rgba(0,0,0,.08)] md:p-10">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-gold text-white"><GraduationCap size={24} /></span>
            <div><p className="font-display text-2xl font-bold text-charcoal">{t('brand.name')}</p><p className="text-xs text-muted">{t('login.subtitle')}</p></div>
          </div>
          <h1 className="mt-8 font-display text-3xl font-bold text-charcoal">{t('login.welcome')}</h1>
          <p className="mt-2 text-sm text-muted">{t('login.subheading')}</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-[14px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}
            <label className="block text-sm font-medium text-charcoal">
              {t('login.email')}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" autoComplete="email" autoFocus
                className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-gold" />
            </label>
            <label className="block text-sm font-medium text-charcoal">
              {t('login.password')}
              <div className="relative mt-2">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('login.passwordPlaceholder')} autoComplete="current-password"
                  className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 pr-12 text-sm outline-none transition focus:border-gold" />
                <button type="button" onClick={() => setShowPassword((prev) => !prev)} aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-charcoal">
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </label>
            <button type="submit" disabled={isSubmitting}
              className="w-full rounded-[14px] bg-gold px-6 py-4 text-sm font-semibold text-white transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? <span className="inline-flex items-center gap-2"><Loader size={16} className="animate-spin" />{t('login.signingIn')}</span> : t('login.signIn')}
            </button>
          </form>
        </div>
      </motion.section>
    </main>
  )
}
