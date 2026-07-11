'use client'
// ── Activar/desactivar un código promocional ───────────────────────────────────

import { useTransition } from 'react'
import { setPromoCodeActiveAction } from '@/app/actions/promo-codes'

export function PromoCodeActiveToggle({
  promoCodeId,
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  promoCodeId: string
  isActive: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await setPromoCodeActiveAction(promoCodeId, !isActive) })}
      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
        isActive
          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
      }`}
    >
      {isActive ? activeLabel : inactiveLabel}
    </button>
  )
}
