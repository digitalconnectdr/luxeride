'use client'

import { useState, useTransition } from 'react'
import { updateCompanyStatus, updateCompanyPlan } from '@/app/actions/companies'
import type { CompanyStatus, CompanyPlan } from '@/lib/supabase/database.types'

const selectCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-1.5 text-sl-on-surface ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition-all'

export function StatusSelect({
  companyId,
  current,
}: {
  companyId: string
  current: CompanyStatus
}) {
  const [value, setValue] = useState(current)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as CompanyStatus
    const previous = value
    setValue(next)
    setError('')
    startTransition(async () => {
      const result = await updateCompanyStatus(companyId, next)
      if (!result.success) {
        setValue(previous)
        setError(result.error ?? 'No se pudo actualizar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={handleChange}
          disabled={isPending}
          className={selectCls}
        >
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {isPending && (
          <span className="text-xs text-sl-on-surface-muted animate-pulse">Saving…</span>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
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
  const [value, setValue] = useState(current)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as CompanyPlan
    const previous = value
    setValue(next)
    setError('')
    startTransition(async () => {
      const result = await updateCompanyPlan(companyId, next)
      if (!result.success) {
        setValue(previous)
        setError(result.error ?? 'No se pudo actualizar')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={handleChange}
          disabled={isPending}
          className={selectCls}
        >
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        {isPending && (
          <span className="text-xs text-sl-on-surface-muted animate-pulse">Saving…</span>
        )}
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
