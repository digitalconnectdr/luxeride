'use client'
// ── Controles del panel de solicitudes (super-admin) ────────────────────────

import { useTransition } from 'react'
import { updateFeatureRequestStatusAction } from '@/app/actions/feature-requests'
import type { FeatureRequestStatus } from '@/lib/supabase/database.types'

const STATUSES: FeatureRequestStatus[] = ['submitted', 'pending', 'in_progress', 'resolved']
const STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  submitted: 'Enviada',
  pending: 'Pendiente',
  in_progress: 'En trabajo',
  resolved: 'Solucionada',
}

export function FeatureRequestStatusSelect({
  requestId,
  current,
}: {
  requestId: string
  current: FeatureRequestStatus
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      defaultValue={current}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateFeatureRequestStatusAction(requestId, e.target.value as FeatureRequestStatus)
        })
      }
      className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
  )
}
