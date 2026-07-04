'use client'
// ── F1.9 — Panel de pagos en el detalle de booking ────────────────────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPaymentLinkAction,
  refundPaymentAction,
  recordManualPaymentAction,
} from '@/app/actions/payments'

interface PaymentRow {
  id: string
  amount: number
  currency: string
  status: string
  payment_method: string
  description: string | null
  failure_message: string | null
  captured_at: string | null
  created_at: string
}

interface Props {
  bookingId: string
  payments: PaymentRow[]
  stripeConfigured: boolean
  canRefund: boolean
  bookingTotal?: number | null
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  succeeded:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
  refunded:   'bg-gray-100 text-gray-600',
  partially_refunded: 'bg-gray-100 text-gray-600',
  cancelled:  'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', processing: 'Procesando', succeeded: 'Pagado',
  failed: 'Fallido', refunded: 'Reembolsado',
  partially_refunded: 'Reembolso parcial', cancelled: 'Cancelado',
}

export function BookingPayments({ bookingId, payments, stripeConfigured, canRefund, bookingTotal }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [paymentUrl, setPaymentUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [showManual, setShowManual] = useState(false)

  const hasSuccessful = payments.some((p) => ['succeeded', 'processing'].includes(p.status))
  const paidTotal = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((s, p) => s + Number(p.amount), 0)
  const remaining = bookingTotal != null ? Math.max(0, Number(bookingTotal) - paidTotal) : null

  function handleGenerateLink() {
    setError('')
    startTransition(async () => {
      const result = await createPaymentLinkAction(bookingId)
      if (!result.success || !result.data) {
        setError(result.error ?? 'Error al generar link de pago')
        return
      }
      setPaymentUrl(result.data.url)
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(paymentUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRefund(paymentId: string) {
    if (!window.confirm('¿Reembolsar este pago completo? Esta acción no se puede deshacer.')) return
    setError('')
    startTransition(async () => {
      const result = await refundPaymentAction(paymentId, 'Solicitado por la empresa')
      if (!result.success) setError(result.error ?? 'Error al reembolsar')
      router.refresh()
    })
  }

  function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await recordManualPaymentAction({
        bookingId,
        method: (fd.get('method') as string) ?? 'cash',
        amount: parseFloat(fd.get('amount') as string),
        reference: (fd.get('reference') as string) || undefined,
      })
      if (!result.success) {
        setError(result.error ?? 'Error al registrar el pago')
        return
      }
      setShowManual(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Pagos
          </p>
          {remaining != null && remaining > 0 && paidTotal > 0 && (
            <p className="text-[11px] text-yellow-600 mt-0.5">
              Balance pendiente: ${remaining.toFixed(2)}
            </p>
          )}
          {remaining === 0 && paidTotal > 0 && (
            <p className="text-[11px] text-green-600 mt-0.5">✓ Pagado completo</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowManual((v) => !v); setError('') }}
            className="text-xs font-medium px-3 py-1.5 border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
          >
            {showManual ? '✕ Cancelar' : '+ Pago manual'}
          </button>
          {!hasSuccessful && (
            stripeConfigured ? (
              <button
                onClick={handleGenerateLink}
                disabled={isPending}
                className="text-xs font-medium px-3 py-1.5 bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? 'Generando…' : 'Generar link de pago'}
              </button>
            ) : (
              <span className="text-xs text-sl-on-surface-muted">
                Pagos en línea no configurados
              </span>
            )
          )}
        </div>
      </div>

      {/* Registro de pago manual (cash / Zelle / transferencia) */}
      {showManual && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-sl-bg border border-sl-outline-variant rounded-xl p-4 space-y-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Registrar pago recibido fuera de Stripe
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">Método</label>
              <select
                name="method"
                defaultValue="cash"
                className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none"
              >
                <option value="cash">Efectivo</option>
                <option value="zelle">Zelle</option>
                <option value="bank_transfer">Transferencia bancaria</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">Monto (USD)</label>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                required
                defaultValue={remaining != null && remaining > 0 ? remaining.toFixed(2) : undefined}
                className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-sl-on-surface-muted mb-1">
                Referencia <span className="normal-case">(núm. de confirmación Zelle, etc. — opcional)</span>
              </label>
              <input
                name="reference"
                type="text"
                maxLength={120}
                placeholder="p. ej. ZELLE-83749"
                className="w-full text-sm bg-white border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="text-xs font-medium px-4 py-2 bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Registrando…' : '✓ Registrar pago'}
            </button>
          </div>
        </form>
      )}

      {paymentUrl && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
          <p className="flex-1 text-xs font-mono text-[#0071e3] truncate">{paymentUrl}</p>
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-[#0071e3] hover:underline shrink-0"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-sl-on-surface-muted">Sin pagos registrados.</p>
      ) : (
        <div className="divide-y divide-sl-outline-variant">
          {payments.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span className="text-xs text-sl-on-surface-muted capitalize">
                    {p.payment_method === 'card' ? 'Tarjeta' : p.payment_method}
                  </span>
                </div>
                <p className="text-xs text-sl-on-surface-muted mt-1">
                  {new Date(p.created_at).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}
                  {p.failure_message && <span className="text-red-500"> — {p.failure_message}</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-sm font-semibold text-sl-on-surface">
                  ${Number(p.amount).toFixed(2)} <span className="text-xs font-normal text-sl-on-surface-muted">{p.currency}</span>
                </p>
                {canRefund && p.status === 'succeeded' && (
                  <button
                    onClick={() => handleRefund(p.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:text-red-600 hover:underline disabled:opacity-50"
                  >
                    Reembolsar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
