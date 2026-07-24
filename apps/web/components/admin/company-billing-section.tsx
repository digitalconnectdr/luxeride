'use client'
// ── "Facturación adicional" (operador) — cargos aparte del plan que LuxeRide
// configura manualmente (ej. hosting de dominio con costo variable, ver
// app/actions/domains.ts). Solo lectura + botón para guardar tarjeta una vez
// (autorización única, el cobro en sí lo dispara un cron — ver
// app/actions/company-billing.ts).

import { useState, useTransition } from 'react'
import { createBillingCardSetupCheckoutAction } from '@/app/actions/company-billing'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['admin']['settings']

interface ChargeRow {
  id: string
  label: string
  amountCents: number
  currency: string
  frequencyMonths: number
  nextChargeDate: string
  active: boolean
}

function fmtMoney(cents: number, currency: string): string {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
}

export function CompanyBillingSection({
  cardSaved,
  charges,
  t,
}: {
  cardSaved: boolean
  charges: ChargeRow[]
  t: T
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function saveCard() {
    setError('')
    startTransition(async () => {
      const result = await createBillingCardSetupCheckoutAction()
      if (!result.success || !result.data) {
        setError(result.error ?? t.errorGeneric)
        return
      }
      window.location.href = result.data.url
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-sl-on-surface">{t.extraChargesTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted">{t.extraChargesDesc}</p>

      {charges.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.extraChargeLabel}</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.extraChargeAmount}</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.extraChargeFrequency}</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.extraChargeNextDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-sl-on-surface">{c.label}</td>
                  <td className="px-3 py-2 text-sl-on-surface">{fmtMoney(c.amountCents, c.currency)}</td>
                  <td className="px-3 py-2 text-sl-on-surface-muted">
                    {c.frequencyMonths === 12 ? t.extraChargeAnnual : t.extraChargeMonthly}
                  </td>
                  <td className="px-3 py-2 text-sl-on-surface-muted">
                    {new Date(c.nextChargeDate).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cardSaved ? (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 inline-block">
          {t.extraChargeCardSaved}
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t.extraChargeNoCard}
          </p>
          <button
            type="button"
            onClick={saveCard}
            disabled={isPending}
            className="text-sm font-medium px-4 py-2 bg-bronze text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {t.extraChargeSaveCard}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
