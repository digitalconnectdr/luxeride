'use client'
// ── Configurar el modelo de pago de un conductor (comisión o tarifa fija) ──────

import { useState, useTransition } from 'react'
import { updateDriverPayrollSettingsAction } from '@/app/actions/payroll'
import type { PayrollType } from '@/lib/payroll/engine'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['admin']['payroll']

const inputCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5 ' +
  'text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function DriverPayrollSettingsForm({
  driverId,
  initialType,
  initialRate,
  t,
}: {
  driverId: string
  initialType: PayrollType | null
  initialRate: number | null
  t: T
}) {
  const [payrollType, setPayrollType] = useState<PayrollType>(initialType ?? 'commission')
  const [rate, setRate] = useState(initialRate?.toString() ?? '')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function save() {
    setError('')
    const rateNum = Number(rate)
    startTransition(async () => {
      const result = await updateDriverPayrollSettingsAction(driverId, payrollType, rateNum)
      if (!result.success) setError(result.error ?? 'Error')
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={payrollType}
        onChange={(e) => setPayrollType(e.target.value as PayrollType)}
        className={inputCls}
      >
        <option value="commission">{t.commission}</option>
        <option value="flat_per_trip">{t.flatPerTrip}</option>
      </select>
      <input
        type="number"
        step="0.01"
        min="0"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
        placeholder={t.rate}
        className={`${inputCls} w-24`}
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending || !rate}
        className="text-xs font-medium px-2.5 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {t.save}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
