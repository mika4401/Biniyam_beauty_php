export type ValidationResult = { valid: true; value: string } | { valid: false; error: string }

const forbiddenText = /<\/?[a-z][\s\S]*>|javascript\s*:|\b(select|insert|update|delete|drop|union|alter|exec|execute)\b|--|\/\*|\*\//i
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function sanitizeText(value: string): ValidationResult {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return { valid: false, error: 'This field is required.' }
  if (controlCharacters.test(normalized) || forbiddenText.test(normalized)) return { valid: false, error: 'Please remove unsupported characters or unsafe content.' }
  return { valid: true, value: normalized }
}

export function validateUsername(value: string): ValidationResult {
  const sanitized = sanitizeText(value)
  if (!sanitized.valid) return sanitized
  if (sanitized.value.length < 3 || sanitized.value.length > 30) return { valid: false, error: 'Full name must be between 3 and 30 characters.' }
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(sanitized.value)) return { valid: false, error: 'Full name may contain letters and single spaces only.' }
  return sanitized
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: 'Email address is required.' }
  if (trimmed.length > 254 || controlCharacters.test(trimmed) || !emailPattern.test(trimmed)) return { valid: false, error: 'Enter a valid email address.' }

  // Only allow .com emails — Chapa validates emails on its side and
  // the vast majority of users have .com addresses (Gmail, Yahoo, Outlook, etc.)
  const lastDot = trimmed.lastIndexOf('.')
  const tld = trimmed.slice(lastDot + 1).toLowerCase()
  if (tld !== 'com') {
    return { valid: false, error: 'Please use a .com email address.' }
  }

  return { valid: true, value: trimmed }
}

export function validateURL(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: 'A URL is required.' }
  try {
    const url = new URL(trimmed)
    if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol)) return { valid: false, error: 'Use an http, https, mailto, or tel URL.' }
    return { valid: true, value: url.toString() }
  } catch { return { valid: false, error: 'Enter a valid URL.' } }
}

export function validatePhone(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!/^\+?[0-9][0-9 ()-]{6,19}$/.test(trimmed)) return { valid: false, error: 'Enter a valid phone number.' }
  return { valid: true, value: trimmed }
}
