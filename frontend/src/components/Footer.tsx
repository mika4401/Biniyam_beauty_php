import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext'

export function Footer() {
  const { t } = useLanguage()
  const links = [
    { label: t('nav.home'), to: '/' },
    { label: t('nav.about'), to: '/about' },
    { label: t('nav.courses'), to: '/#courses' },
    { label: t('nav.gallery'), to: '/gallery' },
    { label: t('nav.contact'), to: '/#contact' },
  ]
  return (
    <footer className="bg-surface px-6 py-10 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link to="/" className="font-display text-xl font-bold text-charcoal">{t('nav.brandPrimary')} <span className="text-gold">{t('nav.brandAccent')}</span></Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted">{t('hero.paragraph')}</p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('nav.about')}</p>
            <nav className="mt-4 flex flex-col gap-2">
              {links.map((link) => (
                <Link key={link.label} to={link.to} className="text-sm text-muted transition-colors hover:text-gold">{link.label}</Link>
              ))}
            </nav>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('footer.contact')}</p>
            <div className="mt-4 space-y-2">
              <a href="tel:+251934917090" className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-gold">
                <Phone size={16} className="text-gold" />+251 93 491 7090
              </a>
              <a href="mailto:info@biniyambeautyacademy.et" className="flex items-center gap-3 text-sm text-muted transition-colors hover:text-gold">
                <Mail size={16} className="text-gold" />info@biniyambeautyacademy.et
              </a>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{t('footer.locations')}</p>
            <div className="mt-4 space-y-3">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Ferensay Gurara Old CBE Building 3rd Floor Addis Ababa')}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-sm text-muted transition-colors hover:text-gold">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gold" />
                <span>{t('footer.address1')}</span>
              </a>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Megenagna WACH Building 6th Floor Addis Ababa')}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-sm text-muted transition-colors hover:text-gold">
                <MapPin size={16} className="mt-0.5 shrink-0 text-gold" />
                <span>{t('footer.address2')}</span>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-black/10 dark:border-white/10 pt-6 text-center text-sm text-muted">
          &copy; {new Date().getFullYear()} Biniyam Beauty Academy. {t('footer.copyright')}
        </div>
      </div>
    </footer>
  )
}
