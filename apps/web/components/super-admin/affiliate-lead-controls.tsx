'use client'
// ── Control de estado de leads de Affiliate Network (super-admin) ─────────────

import { useTransition } from 'react'
import { updateAffiliateNetworkLeadStatusAction } from '@/app/actions/affiliates'

type Status = 'new' | 'contacted' | 'converted' | 'rejected'

const STATUSES: Status[] = ['new', 'contacted', 'converted', 'rejected']
const STATUS_LABEL: Record<Status, string> = {
  new: 'Nuevo', contacted: 'Contactado', converted: 'Convertido', rejected: 'Rechazado',
}

export function AffiliateLeadStatusSelect({ leadId, current }: { leadId: string; current: Status }) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      defaultValue={current}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateAffiliateNetworkLeadStatusAction(leadId, e.target.value as Status)
        })
      }
      className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze disabled:opacity-60"
    >
      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  )
}
