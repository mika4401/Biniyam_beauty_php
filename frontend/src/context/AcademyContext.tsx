/* eslint-disable react-refresh/only-export-components -- context files legitimately export hooks alongside the provider */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Program } from '../types/api'
import { registrations as seedRegistrations } from '../data/registrations'
import type { Registration } from '../data/registrations'
import { API_BASE } from '../constants'

interface AcademyContextValue {
  programs: Program[]
  registrations: Registration[]
  isLoadingPrograms: boolean
  addRegistration: (registration: Omit<Registration, 'id' | 'status'>) => void
  markPaid: (id: string) => void
  saveProgram: (program: Program) => void
  deleteProgram: (id: string) => void
}

const AcademyContext = createContext<AcademyContextValue | null>(null)

export const useAcademy = () => {
  const value = useContext(AcademyContext)
  if (!value) throw new Error('Academy context is unavailable')
  return value
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  // Start with an empty array — NEVER fall back to stale seed data.
  // The user sees a loading skeleton until the real data arrives.
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(true)
  const [registrations, setRegistrations] = useState(seedRegistrations)

  // Fetch programs from the backend API and keep them fresh: admin price changes,
  // deactivations, and new courses are reflected without a manual page reload.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/programs`, {
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        })
        const data = await res.json()
        if (!cancelled && data.success && Array.isArray(data.data)) {
          // Map backend programs (with slug & _id) to frontend Program type (with id = slug)
          const backendPrograms: Program[] = data.data.map((p: Record<string, unknown>) => ({
            id: (p.slug as string) || (p._id as string),
            title: p.title as string,
            description: p.description as string,
            fullDescription: (p.fullDescription as string) || (p.description as string),
            price: p.price as number,
            duration: p.duration as string,
            image: p.image as string,
            discount: (p.discount as string) || undefined,
            allowsHalfPayment: Boolean(p.allowsHalfPayment),
            isActive: p.isActive !== false,
            included: (p.included as string[]) || [],
            titleAm: (p.titleAm as string) || undefined,
            descriptionAm: (p.descriptionAm as string) || undefined,
            fullDescriptionAm: (p.fullDescriptionAm as string) || undefined,
            durationAm: (p.durationAm as string) || undefined,
            includedAm: (p.includedAm as string[]) || undefined,
          }))
          // Only re-render when the data actually changed (avoids churn every poll)
          setPrograms((current) => {
            if (JSON.stringify(current) === JSON.stringify(backendPrograms)) return current
            return backendPrograms
          })
          setIsLoadingPrograms(false)
        }
      } catch {
        // Backend unavailable — clear loading state; do NOT fall back to stale seed data.
        console.warn('[AcademyProvider] Backend unavailable — programs will not display stale data')
        setIsLoadingPrograms(false)
      }
    }
    load()
    // Refresh every 30s and whenever the tab regains focus/visibility
    const intervalId = setInterval(load, 30_000)
    const onFocus = () => { void load() }
    const onVisibility = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const value = useMemo(() => ({
    programs,
    registrations,
    isLoadingPrograms,
    addRegistration: (registration: Omit<Registration, 'id' | 'status'>) => setRegistrations((current) => [{ ...registration, id: `r-${Date.now()}`, status: 'Pending' }, ...current]),
    markPaid: (id: string) => setRegistrations((current) => current.map((entry) => entry.id === id ? { ...entry, status: 'Paid' } : entry)),
    saveProgram: (program: Program) => setPrograms((current) => current.some((item) => item.id === program.id) ? current.map((item) => item.id === program.id ? program : item) : [...current, program]),
    deleteProgram: (id: string) => setPrograms((current) => current.filter((item) => item.id !== id)),
  }), [programs, registrations, isLoadingPrograms])
  return <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>
}
