import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, ShoppingCart } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useLanguage } from '../i18n/LanguageContext'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { count: cartCount } = useCart()
  const { t } = useLanguage()
  const location = useLocation()
  useEffect(() => { const handler = () => setScrolled(window.scrollY > 24); window.addEventListener('scroll', handler); return () => window.removeEventListener('scroll', handler) }, [])
  const links = [{ label: t('nav.home'), to: '/' }, { label: t('nav.about'), to: '/about' }, { label: t('nav.courses'), to: '/#courses' }, { label: t('nav.gallery'), to: '/gallery' }, { label: t('nav.contact'), to: '/#contact' }, { label: t('nav.checkout'), to: '/checkout' }]
  const transparent = !scrolled && (location.pathname === '/' || location.pathname === '/about' || location.pathname === '/gallery')
  const baseLinkClass = `inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-gold `
  return <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-card shadow-[0_10px_30px_rgba(0,0,0,.08)]' : 'bg-transparent'}`}>
    <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-12">
      <Link to="/" className={`font-display text-xl font-bold ${transparent ? 'text-white' : 'text-charcoal'}`}>{t('nav.brandPrimary')} <span className="text-gold">{t('nav.brandAccent')}</span></Link>
      <div className="hidden items-center gap-6 lg:flex">
        <nav className="flex items-center gap-6">{links.map((link) => {
        const isCheckout = link.to === '/checkout'
        return <Link key={link.label} to={link.to} className={`${baseLinkClass} relative ${transparent ? 'text-white' : 'text-charcoal'}`}>
          {isCheckout && <ShoppingCart size={16} />}
          {link.label}
          {isCheckout && cartCount > 0 && (
            <span className="absolute -right-3 -top-2.5 grid min-w-[20px] place-items-center rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Link>
      })}</nav>
        <LanguageToggle light={transparent} />
        <ThemeToggle light={transparent} />
      </div>
      <div className="flex items-center gap-3 lg:hidden">
        <LanguageToggle light={transparent} />
        <ThemeToggle light={transparent} />
        <button aria-label="Open navigation" onClick={() => setOpen(!open)} className={`grid h-10 w-10 place-items-center lg:hidden ${transparent ? 'text-white' : 'text-charcoal'}`}><Menu size={24} /></button>
    </div>
    </div>
    {open && <div className="bg-card px-6 py-4 shadow-[0_10px_30px_rgba(0,0,0,.08)] lg:hidden">{links.map((link) => {
      const isCheckout = link.to === '/checkout'
      return <Link onClick={() => setOpen(false)} key={link.label} to={link.to} className="flex items-center gap-2 py-2 text-sm font-medium text-charcoal">
        {isCheckout && <ShoppingCart size={16} />}
        {link.label}
        {isCheckout && cartCount > 0 && (
          <span className="grid min-w-[20px] place-items-center rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </Link>
    })}</div>}
  </header>
}
