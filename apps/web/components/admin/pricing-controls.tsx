'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { togglePricingRuleActiveAction, deletePricingRuleAction } from '@/app/actions/pricing'

export function PricingRuleActiveToggle({
  ruleId,
  isActive,
}: {
  ruleId: string
  isActive: boolean
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
          : 'text-gray-500 border-gray-300 bg-gray-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300',
      ].join(' ')}
    >
      {isPending ? '…' : isActive ? 'Active' : 'Inactive'}
    </button>
  )
}

export function PricingRuleDeleteButton({ ruleId }: { ruleId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm('¿Eliminar esta regla de precio? Esta acción no se puede deshacer.')) return
        startTransition(async () => {
          await deletePricingRuleAction(ruleId)
        })
      }}
      title="Eliminar"
      aria-label="Eliminar"
      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? <span className="text-xs">…</span> : <Trash2 size={14} strokeWidth={2} />}
    </button>
  )
}
