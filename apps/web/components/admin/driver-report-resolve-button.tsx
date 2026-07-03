'use client'

import { useTransition } from 'react'
import { resolveTripReportAction } from '@/app/actions/driver-reports'

export function DriverReportResolveButton({
  reportId,
  label,
  resolving,
}: {
  reportId: string
  label: string
  resolving: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => { await resolveTripReportAction(reportId) })}
      className="text-xs font-medium text-bronze hover:text-bronze/80 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? resolving : label}
    </button>
  )
}
