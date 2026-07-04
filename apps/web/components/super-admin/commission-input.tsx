'use client'

import { useState, useTransition } from 'react'
import { updateCompanyCommissionAction } from '@/app/actions/companies'

export function CommissionInput({ companyId, current }: { companyId: string; current: number }) {
  const [value, setValue] = useState(String(current))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleSave() {
    setError('')
    const pct = parseFloat(value)
    startTransition(async () => {
      const result = await updateCompanyCommissionAction(companyId, pct)
      if (!result.success) setError(result.error ?? 'Error saving commission')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        max="50"
        step="0.5"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="w-20 text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-1.5 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze disabled:opacity-60 transition-all"
      />
      <span className="text-sm text-sl-on-surface-muted">%</span>
      <button
        onClick={handleSave}
        disabled={isPending || parseFloat(value) === current}
        className="text-xs font-medium px-3 py-1.5 bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
