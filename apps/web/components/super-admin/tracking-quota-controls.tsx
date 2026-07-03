'use client'
// ── Editor de cuota mensual de tracking en vivo por plan (super-admin) ────────

import { useState, useTransition } from 'react'
import { updatePlanQuotaAction, updatePlanPriceAction } from '@/app/actions/companies'
import type { CompanyPlan } from '@/lib/supabase/database.types'

export function QuotaInput({
  plan,
  current,
}: {
  plan: CompanyPlan
  current: number | null
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(current === null ? '' : String(current))
  const [error, setError] = useState('')

  function save() {
    setError('')
    const quota = value.trim() === '' ? null : Number(value)
    if (quota !== null && (!Number.isFinite(quota) || quota < 0)) {
      setError('Inválido')
      return
    }
    startTransition(async () => {
      const result = await updatePlanQuotaAction(plan, quota)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        placeholder="Sin límite"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-28 text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5 text-sl-on-surface focus:border-bronze focus:outline-none disabled:opacity-50"
      />
      <span className="text-[10px] text-sl-on-surface-muted">/mes</span>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}

export function PriceInput({
  plan,
  current,
}: {
  plan: CompanyPlan
  current: number
}) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(String(current))
  const [error, setError] = useState('')

  function save() {
    setError('')
    const price = Number(value)
    if (!Number.isFinite(price) || price < 0) {
      setError('Inválido')
      return
    }
    startTransition(async () => {
      const result = await updatePlanPriceAction(plan, price)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-sl-on-surface-muted">$</span>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        disabled={isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-24 text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5 text-sl-on-surface focus:border-bronze focus:outline-none disabled:opacity-50"
      />
      <span className="text-[10px] text-sl-on-surface-muted">/mes</span>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}
