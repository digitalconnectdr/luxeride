'use client'
// ── Selector de riel de pago activo — cuando el operador tiene Stripe Y Whop
// conectados, elige cuál se usa realmente para cobrarle a sus pasajeros.

import { useTransition } from 'react'
import { setActivePaymentProviderAction } from '@/app/actions/whop-connect'

export function ActivePaymentProviderSelect({
  current,
  labels,
}: {
  current: 'stripe' | 'whop' | null
  labels: { label: string; stripe: string; whop: string; saving: string; error: string }
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-sl-on-surface-muted">{labels.label}</label>
      <select
        defaultValue={current ?? ''}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            await setActivePaymentProviderAction(e.target.value as 'stripe' | 'whop')
          })
        }
        className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {!current && <option value="" disabled>—</option>}
        <option value="stripe">{labels.stripe}</option>
        <option value="whop">{labels.whop}</option>
      </select>
      {isPending && <span className="text-xs text-sl-on-surface-muted animate-pulse">{labels.saving}</span>}
    </div>
  )
}
