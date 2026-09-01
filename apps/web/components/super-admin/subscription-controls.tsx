'use client'
// ── Controles del panel de suscripciones (super-admin) ────────────────────────

import { useState, useTransition } from 'react'
import {
  renewSubscriptionAction,
  approveCompanyAction,
  rejectCompanyAction,
  updateCompanyPlan,
  extendTrialAction,
} from '@/app/actions/companies'
import type { CompanyPlan } from '@/lib/supabase/database.types'

const PLANS: CompanyPlan[] = ['free', 'starter', 'professional', 'elite', 'enterprise']

export function RenewButtons({ companyId }: { companyId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function renew(months: number) {
    setError('')
    startTransition(async () => {
      const result = await renewSubscriptionAction(companyId, months)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {[1, 3, 12].map((m) => (
        <button
          key={m}
          disabled={isPending}
          onClick={() => renew(m)}
          title={`Renovar ${m} mes${m > 1 ? 'es' : ''}`}
          className="px-2.5 py-1 text-[11px] font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          +{m}m
        </button>
      ))}
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}

export function PlanSelect({
  companyId,
  current,
}: {
  companyId: string
  current: CompanyPlan
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <select
      defaultValue={current}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await updateCompanyPlan(companyId, e.target.value as CompanyPlan)
        })
      }
      className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface capitalize focus:border-bronze focus:outline-none disabled:opacity-50"
    >
      {PLANS.map((p) => (
        <option key={p} value={p} className="capitalize">{p}</option>
      ))}
    </select>
  )
}

export function ExtendTrialButtons({ companyId }: { companyId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function extend(days: number) {
    setError('')
    startTransition(async () => {
      const result = await extendTrialAction(companyId, days)
      if (!result.success) setError(result.error ?? 'Error')
      else {
        setDone(true)
        setTimeout(() => setDone(false), 2000)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {[7, 14, 30].map((d) => (
        <button
          key={d}
          disabled={isPending}
          onClick={() => extend(d)}
          title={`Extender la prueba ${d} días`}
          className="px-2.5 py-1 text-[11px] font-medium bg-sl-surface-variant text-sl-on-surface border border-sl-outline-variant rounded-lg hover:border-bronze disabled:opacity-50 transition-colors"
        >
          +{d}d
        </button>
      ))}
      {done && <span className="text-[10px] text-green-600">✓ Extendida</span>}
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}

export function ApproveRejectButtons({ companyId }: { companyId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function run(fn: (id: string) => Promise<{ success: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await fn(companyId)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        disabled={isPending}
        onClick={() => run(approveCompanyAction)}
        className="px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        ✓ Aprobar
      </button>
      <button
        disabled={isPending}
        onClick={() => {
          if (!window.confirm('¿Rechazar esta solicitud? La empresa quedará cancelada.')) return
          run(rejectCompanyAction)
        }}
        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        ✕ Rechazar
      </button>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
