/* eslint-disable react-refresh/only-export-components -- context files legitimately export hooks alongside the provider */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem } from '../utils/cart'
import {
  getCart,
  addToCart as addToCartStorage,
  removeFromCart as removeFromCartStorage,
  clearCart as clearCartStorage,
  isInCart,
  getPaymentEligibility,
} from '../utils/cart'
import { useLanguage } from '../i18n/LanguageContext'

interface CartContextValue {
  items: CartItem[]
  count: number
  total: number
  halfTotal: number
  halfAllowed: boolean
  halfReason: string
  addItem: (item: CartItem) => boolean
  removeItem: (programId: string) => void
  clearCart: () => void
  isInCart: (programId: string) => boolean
}

const CartContext = createContext<CartContextValue | null>(null)

export const useCart = () => {
  const value = useContext(CartContext)
  if (!value) throw new Error('Cart context is unavailable')
  return value
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage()
  const [items, setItems] = useState<CartItem[]>(getCart)
  const [renderTick, setRenderTick] = useState(0)

  // Sync from localStorage on mount and on storage events (cross-tab updates)
  useEffect(() => {
    const handler = () => {
      setItems(getCart())
      setRenderTick((t) => t + 1)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Force re-read from localStorage (used after mutations)
  const refresh = useCallback(() => {
    setItems(getCart())
    setRenderTick((t) => t + 1)
  }, [])

  const count = items.length
  const total = items.reduce((sum, i) => sum + i.price, 0)
  const halfTotal = Math.round(total / 2)
  const eligibility = getPaymentEligibility()

  const addItem = useCallback((item: CartItem): boolean => {
    const { added } = addToCartStorage(item)
    if (added) refresh()
    return added
  }, [refresh])

  const removeItem = useCallback((programId: string) => {
    removeFromCartStorage(programId)
    refresh()
  }, [refresh])

  const clearCartFn = useCallback(() => {
    clearCartStorage()
    refresh()
  }, [refresh])

  const isInCartFn = useCallback((programId: string): boolean => {
    return isInCart(programId)
  }, [])

  const halfReason = eligibility.halfAllowed
    ? ''
    : eligibility.reasonKey === 'cartEmpty'
      ? t('checkout.halfReasonEmpty')
      : `${t('checkout.fullPaymentRequired')} — ${eligibility.names.join(', ')} ${eligibility.names.length > 1 ? t('checkout.dontQualify') : t('checkout.doesntQualify')}`

  const value = useMemo<CartContextValue>(() => ({
    items,
    count,
    total,
    halfTotal,
    halfAllowed: eligibility.halfAllowed,
    halfReason,
    addItem,
    removeItem,
    clearCart: clearCartFn,
    isInCart: isInCartFn,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [renderTick, count, total, halfTotal, eligibility.halfAllowed, halfReason, addItem, removeItem, clearCartFn, isInCartFn])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
