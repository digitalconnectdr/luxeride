'use client'
// ── El conductor agrega un cargo extra (pasajero/equipaje/peaje-parking) ──────
// Pasajero y equipaje usan un monto UNITARIO que define el operador en
// Configuración (settings.fees) — solo se muestran si está en > 0. Peaje/
// parking siempre está disponible: es el costo real que el conductor pagó en
// el momento, no algo que el operador pueda fijar de antemano, así que usa un
// monto libre en vez de unidad × cantidad. El cargo suma al total del viaje,
// queda en booking_fees y se avisa al pasajero por el chat del viaje.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { driverAddExtraChargeAction, type ExtraChargeType } from '@/app/actions/trip'

export interface AddChargeLabels {
  trigger: string
  title: string
  desc: string
  passenger: string
  luggage: string
  tollParking: string
  tollParkingPlaceholder: string
  qty: string
  total: string
  confirm: string
  cancel: string
  done: string
  saving: string
}

export function DriverAddCharge({
  bookingId,
  fees,
  currency,
  labels,
}: {
  bookingId: string
  fees: { passenger: number; luggage: number }
  currency: string
  labels: AddChargeLabels
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<ExtraChargeType>(fees.passenger > 0 ? 'extra_passenger' : fees.luggage > 0 ? 'extra_luggage' : 'toll_parking')
  const [qty, setQty] = useState(1)
  const [customAmount, setCustomAmount] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const unitOptions: { value: ExtraChargeType; label: string; unit: number }[] = [
    ...(fees.passenger > 0 ? [{ value: 'extra_passenger' as const, label: labels.passenger, unit: fees.passenger }] : []),
    ...(fees.luggage > 0 ? [{ value: 'extra_luggage' as const, label: labels.luggage, unit: fees.luggage }] : []),
  ]
  const options = [...unitOptions, { value: 'toll_parking' as const, label: labels.tollParking, unit: 0 }]

  const isTollParking = type === 'toll_parking'
  const unit = unitOptions.find((o) => o.value === type)?.unit ?? 0
  const parsedCustom = Number(customAmount.replace(',', '.'))
  const total = isTollParking
    ? (Number.isFinite(parsedCustom) ? Math.round(parsedCustom * 100) / 100 : 0)
    : Math.round(unit * qty * 100) / 100

  function confirm() {
    setError('')
    if (isTollParking && (!Number.isFinite(parsedCustom) || parsedCustom <= 0)) {
      setError('Monto inválido')
      return
    }
    if (isTollParking && parsedCustom > 500) {
      setError('El monto máximo por cargo es 500. Para montos mayores, contacta a soporte.')
      return
    }
    startTransition(async () => {
      const r = await driverAddExtraChargeAction(bookingId, type, qty, isTollParking ? parsedCustom : undefined)
      if (!r.success) { setError(r.error ?? 'Error'); return }
      setDone(true); setOpen(false)
      router.refresh()
    })
  }

  if (done) return <p className="text-xs text-[#8a6520] pt-2">{labels.done}</p>

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[#8a6520] hover:opacity-80 transition-opacity pt-1"
      >
        {labels.trigger}
      </button>
    )
  }

  return (
    <div className="pt-2 space-y-2">
      <p className="text-xs font-semibold text-[#1d1b18]">{labels.title}</p>
      <p className="text-xs text-[#75716a]">{labels.desc}</p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => { setType(o.value); setError('') }}
            className={[
              'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              type === o.value
                ? 'border-[#8a6520] bg-[#8a6520]/10 text-[#8a6520]'
                : 'border-[#e5e1d8] bg-white text-[#75716a] hover:text-[#1d1b18]',
            ].join(' ')}
          >
            {o.label}
            {o.value !== 'toll_parking' && (
              <span className="block text-[10px] font-normal mt-0.5">
                {o.unit.toFixed(2)} {currency} c/u
              </span>
            )}
          </button>
        ))}
      </div>

      {isTollParking ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e1d8] bg-white px-3 py-2">
          <span className="text-xs text-[#75716a]">{currency}</span>
          <input
            type="text"
            inputMode="decimal"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={labels.tollParkingPlaceholder}
            className="flex-1 text-sm text-[#1d1b18] focus:outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-[#e5e1d8] bg-white px-3 py-2">
          <span className="text-xs text-[#75716a]">{labels.qty}</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              className="w-7 h-7 rounded-full border border-[#e5e1d8] text-sm text-[#1d1b18] disabled:opacity-40 hover:border-[#8a6520] transition-colors"
              aria-label="−"
            >
              −
            </button>
            <span className="text-sm font-semibold text-[#1d1b18] w-5 text-center">{qty}</span>
            <button
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              disabled={qty >= 10}
              className="w-7 h-7 rounded-full border border-[#e5e1d8] text-sm text-[#1d1b18] disabled:opacity-40 hover:border-[#8a6520] transition-colors"
              aria-label="+"
            >
              +
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-[#8a6520]">
        {labels.total}: <span className="font-semibold">{total.toFixed(2)} {currency}</span>
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setQty(1); setCustomAmount(''); setError('') }}
          disabled={isPending}
          className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:text-[#1d1b18] transition-colors"
        >
          {labels.cancel}
        </button>
        <button
          onClick={confirm}
          disabled={isPending}
          className="flex-1 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? labels.saving : labels.confirm}
        </button>
      </div>
    </div>
  )
}
