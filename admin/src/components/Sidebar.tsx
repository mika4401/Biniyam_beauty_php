import type { ReactNode } from 'react'
import { BookOpen, GraduationCap, Image, KeyRound, LayoutDashboard, LogOut, ReceiptText, UserPlus } from 'lucide-react'
import type { AdminProfile } from '../context/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { LanguageToggle } from './LanguageToggle'

export type AdminView = 'dashboard' | 'registrations' | 'programs' | 'gallery' | 'password' | 'register-student'

export function Sidebar({ admin, logout, view, onViewChange }: {
  admin: AdminProfile | null
  logout: () => void
  view: AdminView
  onViewChange: (v: AdminView) => void
}) {
  const { t } = useLanguage()
  return (
    <aside className="flex flex-col bg-charcoal px-6 py-6 text-white md:min-h-screen md:w-72 md:px-8 md:py-8">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-gold text-white"><GraduationCap size={22} /></span>
        <div><p className="font-display text-xl font-bold">{t('brand.name')}</p><p className="text-xs text-white/60">{t('brand.subtitle')}</p></div>
      </div>
      <nav className="mt-8 space-y-1 md:mt-16">
        <NavButton active={view === 'dashboard'} onClick={() => onViewChange('dashboard')}><LayoutDashboard size={18} />{t('nav.dashboard')}</NavButton>
        <NavButton active={view === 'registrations'} onClick={() => onViewChange('registrations')}><ReceiptText size={18} />{t('nav.registrations')}</NavButton>
        <NavButton active={view === 'register-student'} onClick={() => onViewChange('register-student')}><UserPlus size={18} />{t('nav.registerStudent')}</NavButton>
        <NavButton active={view === 'programs'} onClick={() => onViewChange('programs')}><BookOpen size={18} />{t('nav.programs')}</NavButton>
        <NavButton active={view === 'gallery'} onClick={() => onViewChange('gallery')}><Image size={18} />{t('nav.gallery')}</NavButton>
        <div className="pt-4 mt-4 border-t border-white/10">
          <NavButton active={view === 'password'} onClick={() => onViewChange('password')}><KeyRound size={18} />{t('nav.changePassword')}</NavButton>
        </div>
      </nav>
      <div className="mt-auto pt-8">
        <div className="border-t border-white/10 pt-6">
          <div className="mb-4"><LanguageToggle light /></div>
          {admin && (
            <div className="mb-4">
              <p className="text-sm font-medium text-white">{admin.fullName}</p>
              <p className="text-xs text-white/50">{admin.email}</p>
            </div>
          )}
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut size={18} />{t('sidebar.signOut')}
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left text-sm font-semibold transition-colors ${
        active ? 'bg-gold text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}>
      {children}
    </button>
  )
}
