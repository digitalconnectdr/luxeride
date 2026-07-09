'use client'
// ── Sección G — Interruptor de Affiliate Network por empresa (super-admin) ────

import { useTransition } from 'react'
import { toggleAffiliateNetworkAction } from '@/app/actions/affiliates'

export function AffiliateNetworkToggle({
  companyId,
  enabled,
  enabledAt,
}: {
  companyId: string
  enabled: boolean
  enabledAt: string | null
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={() => startTransition(async () => { await toggleAffiliateNetworkAction(companyId, !enabled) })}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-green-500' : 'bg-sl-outline-variant'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-xs text-sl-on-surface-muted">
        {enabled ? `Enabled${enabledAt ? ` since ${new Date(enabledAt).toLocaleDateString()}` : ''}` : 'Disabled'}
      </span>
    </div>
  )
}
