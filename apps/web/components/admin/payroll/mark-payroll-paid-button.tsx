'use client'
// ── Marcar un periodo de nómina como pagado (congela monto/viajes) ─────────────

import { useTransition } from 'react'
import { markPayrollPeriodPaidAction } from '@/app/actions/payroll'

export function MarkPayrollPaidButton({
  driverId,
  periodStart,
  periodEnd,
  label,
}: {
  driverId: string
  periodStart: string
  periodEnd: string
  label: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await markPayrollPeriodPaidAction({ driverId, periodStart, periodEnd }) })}
      className="text-xs font-medium px-3 py-1.5 border border-sl-outline-variant rounded-lg hover:border-bronze disabled:opacity-50 transition-colors text-sl-on-surface"
    >
      {isPending ? '...' : label}
    </button>
  )
}
