'use client'
// ── "Cargos adicionales" (super-admin) — LuxeRide cobra al operador ────────
// Caso de uso original: hosting de dominio personalizado con costo variable
// (ver app/actions/company-billing.ts). Genérico: cualquier cargo especial
// futuro. Lista los cargos recurrentes activos + el historial de cobros
// individuales con opción de reversar (acreditar) uno puntual sin afectar
// los demás.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCompanyExtraChargeAction,
  toggleCompanyExtraChargeActiveAction,
  deleteCompanyExtraChargeAction,
  reverseCompanyExtraChargePaymentAction,
  type ExtraChargeRow,
  type ExtraChargePaymentRow,
} from '@/app/actions/company-billing'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtMoney(cents: number, currency: string): string {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`
}

const STATUS_BADGE: Record<ExtraChargePaymentRow['status'], string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  succeeded: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40',
}

export function CompanyExtraCharges({
  companyId,
  cardSaved,
  charges,
  payments,
}: {
  companyId: string
  cardSaved: boolean
  charges: ExtraChargeRow[]
  payments: ExtraChargePaymentRow[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<'1' | '12'>('1')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  function submitNewCharge() {
    setError('')
    const amountNum = Number(amount)
    startTransition(async () => {
      const result = await createCompanyExtraChargeAction(companyId, label, amountNum, Number(frequency) as 1 | 12, startDate)
      if (!result.success) {
        setError(result.error ?? 'Error')
        return
      }
      setLabel('')
      setAmount('')
      setShowForm(false)
      router.refresh()
    })
  }

  function toggleActive(chargeId: string, active: boolean) {
    setError('')
    startTransition(async () => {
      const result = await toggleCompanyExtraChargeActiveAction(chargeId, companyId, active)
      if (!result.success) setError(result.error ?? 'Error')
      router.refresh()
    })
  }

  function remove(chargeId: string) {
    if (!confirm('¿Eliminar este cargo? Esta acción no se puede deshacer.')) return
    setError('')
    startTransition(async () => {
      const result = await deleteCompanyExtraChargeAction(chargeId, companyId)
      if (!result.success) setError(result.error ?? 'Error')
      router.refresh()
    })
  }

  function reverse(paymentId: string) {
    const reason = prompt('Motivo de la reversión (opcional):') ?? undefined
    setError('')
    startTransition(async () => {
      const result = await reverseCompanyExtraChargePaymentAction(paymentId, companyId, reason)
      if (!result.success) setError(result.error ?? 'Error')
      router.refresh()
    })
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6 space-y-4 sm:col-span-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-1">
            Cargos adicionales
          </h2>
          <p className="text-xs text-sl-on-surface-muted">
            LuxeRide cobra al operador (ej. hosting de dominio con costo variable) — separado del plan/add-ons.{' '}
            {cardSaved ? (
              <span className="text-green-400">Tarjeta guardada.</span>
            ) : (
              <span className="text-amber-400">Sin tarjeta guardada — el operador debe guardarla desde Configuración.</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="text-xs font-medium px-3 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 transition-opacity shrink-0"
        >
          {showForm ? 'Cancelar' : '+ Nuevo cargo'}
        </button>
      </div>

      {showForm && (
        <div className="bg-sl-bg border border-sl-outline-variant rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div className="col-span-2 sm:col-span-2">
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Etiqueta</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Hosting de dominio"
              className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Monto (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Frecuencia</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as '1' | '12')}
              className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-2 py-1.5"
            >
              <option value="1">Mensual</option>
              <option value="12">Anual</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-sl-on-surface-muted mb-1">Primer cobro</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-2 py-1.5"
            />
          </div>
          <div className="col-span-2 sm:col-span-5">
            <button
              type="button"
              onClick={submitNewCharge}
              disabled={isPending || !label.trim() || !amount}
              className="text-xs font-medium px-3 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Crear cargo
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {charges.length === 0 ? (
        <p className="text-xs text-sl-on-surface-muted">Sin cargos configurados todavía.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                {['Etiqueta', 'Monto', 'Frecuencia', 'Próximo cobro', 'Estado', ''].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {charges.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-sl-on-surface">{c.label}</td>
                  <td className="px-3 py-2 text-sl-on-surface">{fmtMoney(c.amountCents, c.currency)}</td>
                  <td className="px-3 py-2 text-sl-on-surface-muted">{c.frequencyMonths === 12 ? 'Anual' : 'Mensual'}</td>
                  <td className="px-3 py-2 text-sl-on-surface-muted">{fmtDate(c.nextChargeDate)}</td>
                  <td className="px-3 py-2">
                    <span className={c.active ? 'text-green-400 text-xs' : 'text-sl-on-surface-muted text-xs'}>
                      {c.active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => toggleActive(c.id, !c.active)}
                      className="text-xs text-bronze hover:opacity-80 disabled:opacity-50 mr-3"
                    >
                      {c.active ? 'Pausar' : 'Reactivar'}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => remove(c.id)}
                      className="text-xs text-red-400 hover:opacity-80 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2 mt-2">
            Historial de cobros
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant">
                  {['Fecha', 'Monto', 'Estado', 'Detalle', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant/50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-sl-on-surface-muted text-xs">{fmtDate(p.chargedAt)}</td>
                    <td className="px-3 py-2 text-sl-on-surface">{fmtMoney(p.amountCents, p.currency)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium border ${STATUS_BADGE[p.status]}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-sl-on-surface-muted">
                      {p.status === 'failed' && p.failureMessage}
                      {p.status === 'refunded' && (p.refundReason || 'Sin motivo especificado')}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {p.status === 'succeeded' && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => reverse(p.id)}
                          className="text-xs text-amber-400 hover:opacity-80 disabled:opacity-50"
                        >
                          Reversar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
