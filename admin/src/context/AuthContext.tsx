import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  getStoredAccessToken,
  getStoredAdminProfile,
  loginAdmin,
  logoutAdmin,
} from '../utils/api'
import type { AdminProfile } from '../types/api'

export type { AdminProfile }

interface AuthContextValue {
  isAuthenticated: boolean
  isLoading: boolean
  admin: AdminProfile | null
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [admin, setAdmin] = useState<AdminProfile | null>(null)

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = getStoredAccessToken()
    const profile = getStoredAdminProfile()
    if (token && profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdmin(profile)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginAdmin(email, password)

    if (result.success && result.admin) {
      setAdmin(result.admin)
      return { success: true }
    }

    return {
      success: false,
      message: result.message || undefined,
    }
  }, [])

  const logout = useCallback(async () => {
    await logoutAdmin()
    setAdmin(null)
  }, [])

  const isAuthenticated = admin !== null && getStoredAccessToken() !== null

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return value
}
