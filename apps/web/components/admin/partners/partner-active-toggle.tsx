'use client'
// ── Activar/desactivar un Partner Portal ────────────────────────────────────────

import { useTransition } from 'react'
import { togglePartnerActiveAction } from '@/app/actions/partners'

export function PartnerActiveToggle({
  partnerId,
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  partnerId: string
  isActive: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await togglePartnerActiveAction(partnerId, !isActive) })}
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
