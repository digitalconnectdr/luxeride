'use client'
// ── Marcar un periodo de comisión de partner como pagado (congela monto/viajes) ─

import { useTransition } from 'react'
import { markPartnerPeriodPaidAction } from '@/app/actions/partners'

export function MarkPartnerPaidButton({
  partnerId,
  periodStart,
  periodEnd,
  label,
}: {
  partnerId: string
  periodStart: string
  periodEnd: string
  label: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markPartnerPeriodPaidAction({ partnerId, periodStart, periodEnd }) })}
      className="text-xs font-medium px-3 py-1.5 border border-sl-outline-variant rounded-lg hover:border-bronze disabled:opacity-50 transition-colors text-sl-on-surface"
    >
      {isPending ? '...' : label}
    </button>
  )
}
