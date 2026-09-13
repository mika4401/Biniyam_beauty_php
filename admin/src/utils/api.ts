export const API_BASE = 'https://api.biniyambeautytraining.com.et/api/v1'

// ──────────────────────────────────────────────
//  Token management
// ──────────────────────────────────────────────

const STORAGE_KEYS = {
  accessToken: 'admin_access_token',
  refreshToken: 'admin_refresh_token',
  adminProfile: 'admin_profile',
} as const

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken)
}

export function getStoredAdminProfile(): AdminProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.adminProfile)
    return raw ? (JSON.parse(raw) as AdminProfile) : null
  } catch {
    return null
  }
}

export function storeTokens(accessToken: string, refreshToken: string, admin?: AdminProfile): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
  localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
  if (admin) {
    localStorage.setItem(STORAGE_KEYS.adminProfile, JSON.stringify(admin))
  }
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.adminProfile)
}

// ──────────────────────────────────────────────
//  API client
// ──────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  pagination?: Pagination
  accessToken?: string
  refreshToken?: string
  admin?: AdminProfile
}

async function request<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getStoredAccessToken()
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const body = await res.json().catch(() => ({ success: false, message: 'Invalid response from server' }))

  // If 401 and we have a refresh token, try refreshing
  if (res.status === 401 && getStoredRefreshToken()) {
    const refreshed = await attemptTokenRefresh()
    if (refreshed) {
      // Retry the original request with the new token
      headers.set('Authorization', `Bearer ${getStoredAccessToken()}`)
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      })
      return retryRes.json().catch(() => ({ success: false, message: 'Invalid response from server' }))
    }
    // Refresh failed — clear tokens
    clearTokens()
  }

  return body as ApiResponse<T>
}

async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    const body = await res.json()

    if (body.success && body.accessToken) {
      storeTokens(body.accessToken, body.refreshToken || refreshToken)
      return true
    }

    return false
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────
//  Auth endpoints
// ──────────────────────────────────────────────

export async function loginAdmin(email: string, password: string): Promise<ApiResponse> {
    try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const body = await res.json().catch(() => ({ success: false, message: 'Invalid response from server' }))

    if (body.success && body.accessToken) {
      storeTokens(body.accessToken, body.refreshToken, body.admin)
    }

    return body
  } catch {
    // Network failure or CORS block — surface a readable error instead of rejecting
    // (an unhandled rejection left the login button spinning forever).
    return { success: false, message: 'Could not reach the server. Check your connection and try again.' }
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await request('/auth/logout', { method: 'POST' })
  } catch {
    // Swallow error — we clear locally regardless
  }
  clearTokens()
}

import type { RegistrationStats, RegistrationPayments, Registration, Program, GalleryItem, GalleryUsage, Pagination, AdminProfile } from '../types/api'

// ──────────────────────────────────────────────
//  Dashboard endpoints
// ──────────────────────────────────────────────

export async function fetchRegistrationStats() {
  return request<RegistrationStats>('/registrations/stats/summary')
}

export async function fetchRegistrations(params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : ''
  return request<Registration[]>(`/registrations${query}`)
}

export async function fetchRegistrationPayments(registrationId: string) {
  return request<RegistrationPayments>(`/registrations/${registrationId}/payments`)
}

export async function recordSecondPayment(registrationId: string, amount?: number) {
  return request(`/registrations/${registrationId}/payment`, {
    method: 'PATCH',
    body: JSON.stringify(amount !== undefined ? { amount } : {}),
  })
}

export async function updateRegistrationStatus(registrationId: string, status: string) {
  return request(`/registrations/${registrationId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export async function fetchPrograms() {
  return request<Program[]>('/programs')
}

export async function updateProgram(programId: string, data: Partial<Program>) {
  return request(`/programs/${programId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function createProgram(data: Omit<Program, '_id' | 'id' | 'createdAt' | 'updatedAt'>) {
  return request('/programs', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteProgram(programId: string) {
  return request(`/programs/${programId}`, {
    method: 'DELETE',
  })
}

export async function changeAdminPassword(currentPassword: string, newPassword: string, confirmNewPassword: string) {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
  })
}

// ──────────────────────────────────────────────
//  Admin — Register student in-person
// ──────────────────────────────────────────────

export async function adminCreateRegistration(payload: {
  student: {
    firstName: string
    lastName: string
    email: string
    phone: string
    educationLevel?: string
    fieldOfStudy?: string
    nationalIdImage?: string
  }
  programs: (string | number)[]
  schedule: string
  paymentType: 'Full' | 'Half'
}) {
  return request('/registrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ──────────────────────────────────────────────
//  Gallery endpoints
// ──────────────────────────────────────────────

export async function fetchGalleryItems() {
  return request<GalleryItem[]>('/gallery')
}

export async function createGalleryItem(payload: { imageData: string; caption: string; category: string }) {
  return request('/gallery', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function deleteGalleryItem(id: string) {
  return request(`/gallery/${id}`, {
    method: 'DELETE',
  })
}

export async function fetchGalleryUsage() {
  return request<GalleryUsage>('/gallery/usage')
}
