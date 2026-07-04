'use client'
// ── Controles del panel de leads Enterprise (super-admin) ──────────────────────

import { useState, useTransition } from 'react'
import { updateEnterpriseLeadStatusAction, deleteEnterpriseLeadAction } from '@/app/actions/enterprise-leads'
import type { EnterpriseLeadStatus } from '@/lib/supabase/database.types'

const STATUSES: EnterpriseLeadStatus[] = ['new', 'contacted', 'converted', 'rejected']
const STATUS_LABEL: Record<EnterpriseLeadStatus, string> = {
  new: 'Nuevo', contacted: 'Contactado', converted: 'Convertido', rejected: 'Rechazado',
}

export function LeadStatusSelect({
  leadId,
  current,
}: {
  leadId: string
  current: EnterpriseLeadStatus
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      defaultValue={current}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateEnterpriseLeadStatusAction(leadId, e.target.value as EnterpriseLeadStatus)
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

export function LeadDeleteButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => {
          if (!confirm('¿Eliminar este lead? Esta acción no se puede deshacer.')) return
          setError('')
          startTransition(async () => {
            const result = await deleteEnterpriseLeadAction(leadId)
            if (!result.success) setError(result.error ?? 'Error')
          })
        }}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? '…' : 'Eliminar'}
      </button>
      {error && <p className="text-[10px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}
