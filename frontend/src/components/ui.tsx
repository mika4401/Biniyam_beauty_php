import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function ButtonLink({ to, children, secondary = false }: { to: string; children: ReactNode; secondary?: boolean }) {
  return <Link to={to} className={`inline-flex items-center justify-center rounded-[14px] px-6 py-4 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 ${secondary ? 'border border-gold bg-card text-gold' : 'bg-gold text-white shadow-[0_10px_30px_rgba(0,0,0,.08)]'}`}>{children}</Link>
}

export function Stat({ value, label }: { value: string; label: string }) {
  return <div><p className="font-display text-2xl font-bold text-white">{value}</p><p className="mt-1 text-sm text-white/70">{label}</p></div>
}

export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="max-w-xl"><p className="text-sm font-semibold uppercase tracking-[0.15em] text-gold">{eyebrow}</p><h2 className="mt-4 font-display text-4xl font-bold leading-tight text-charcoal">{title}</h2></div>
}
