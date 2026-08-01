'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { togglePricingRuleActiveAction, deletePricingRuleAction } from '@/app/actions/pricing'

export function PricingRuleActiveToggle({
  ruleId,
  isActive,
  labels,
}: {
  ruleId: string
  isActive: boolean
  labels: { active: string; inactive: string }
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await togglePricingRuleActiveAction(ruleId, !isActive)
        })
      }
      className={[
        'text-xs font-medium px-2.5 py-1 rounded-lg border transition-all',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isActive
          ? 'text-green-700 border-green-300 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          // gray-600 y no gray-500: sobre bg-gray-50 el 500 da 4.36:1, por
          // debajo del 4.5:1 que pide AA para texto de este tamaño.
          : 'text-gray-600 border-gray-300 bg-gray-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300',
      ].join(' ')}
    >
      {isPending ? '…' : isActive ? labels.active : labels.inactive}
    </button>
  )
}

export function PricingRuleDeleteButton({
  ruleId,
  labels,
}: {
  ruleId: string
  labels: { delete: string; confirmDelete: string }
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm(labels.confirmDelete)) return
        startTransition(async () => {
          await deletePricingRuleAction(ruleId)
        })
      }}
      title={labels.delete}
      aria-label={labels.delete}
      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? <span className="text-xs">…</span> : <Trash2 size={14} strokeWidth={2} />}
    </button>
  )
}
