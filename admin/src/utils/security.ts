export type ValidationResult = { valid: true; value: string } | { valid: false; error: string }

// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim()
  if (!trimmed) return { valid: false, error: 'Email address is required.' }
  if (trimmed.length > 254 || controlCharacters.test(trimmed) || !emailPattern.test(trimmed)) return { valid: false, error: 'Enter a valid email address.' }
  return { valid: true, value: trimmed }
}
