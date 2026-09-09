/** Shopping cart item — minimal fields needed for cart display and checkout */
export interface CartItem {
  programId: string
  title: string
  price: number
  allowsHalfPayment: boolean
  image: string
}

const STORAGE_KEY = 'beauty_academy_cart'

/** Read the current cart from localStorage (empty array fallback) */
export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Persist cart to localStorage */
function saveCart(items: CartItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

/** Add an item to the cart. If it already exists, no-op. Returns the updated cart. */
export function addToCart(item: CartItem): { added: boolean; items: CartItem[] } {
  const items = getCart()
  const exists = items.some((i) => i.programId === item.programId)
  if (exists) return { added: false, items }

  const updated = [...items, item]
  saveCart(updated)
  return { added: true, items: updated }
}

/** Remove an item by programId. Returns the updated cart. */
export function removeFromCart(programId: string): CartItem[] {
  const items = getCart().filter((i) => i.programId !== programId)
  saveCart(items)
  return items
}

/** Empty the cart entirely */
export function clearCart(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** Check whether a program is already in the cart */
export function isInCart(programId: string): boolean {
  return getCart().some((i) => i.programId === programId)
}

/** Total number of items in the cart */
export function cartCount(): number {
  return getCart().length
}

/** Payment eligibility — whether half payment is allowed for all items */
export type PaymentEligibility =
  | { halfAllowed: true }
  | { halfAllowed: false; reasonKey: 'cartEmpty' | 'fullPaymentRequired'; names: string[] }

/**
 * Determine payment eligibility based on cart contents.
 *
 * - If cart is empty → half not allowed (reasonKey: 'cartEmpty')
 * - If every item allows half → half ALLOWED
 * - If any item forbids half → half NOT allowed with the restricted program names
 */
export function getPaymentEligibility(): PaymentEligibility {
  const items = getCart()
  if (items.length === 0) return { halfAllowed: false, reasonKey: 'cartEmpty', names: [] }

  const restricted = items.filter((i) => !i.allowsHalfPayment)
  if (restricted.length === 0) return { halfAllowed: true }

  return {
    halfAllowed: false,
    reasonKey: 'fullPaymentRequired',
    names: restricted.map((i) => i.title),
  }
}
