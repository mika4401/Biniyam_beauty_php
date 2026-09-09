import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-6">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gold/10">
          <Loader size={28} className="animate-spin text-gold" />
        </span>
      </main>
    )
  }
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface px-6">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-gold/10">
          <Loader size={28} className="animate-spin text-gold" />
        </span>
      </main>
    )
  }
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>
}
