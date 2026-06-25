'use client'
// ── Nueva Reservación — Formulario de 2 fases ──────────────────────────────────
// Fase 1: Ruta + vehículo + fecha → calcular precio
// Fase 2: Info del pasajero → confirmar reservación

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AddressInput } from '@/components/maps/address-input'
import { calculateQuoteAction, createBookingAction } from '@/app/actions/bookings'
import type { QuoteResult } from '@/app/actions/bookings'
import type { Dictionary } from '@/lib/i18n/server'

type Labels = Dictionary['admin']['bookingNew']

interface VehicleType {
  id: string
  name: string
  class: string
  capacity: number
}

interface Driver {
  id: string
  first_name: string
  last_name: string
}

interface CorporateAccount {
  id: string
  name: string
}

interface Props {
  vehicleTypes: VehicleType[]
  drivers: Driver[]
  corporateAccounts?: CorporateAccount[]
  labels: Labels
}

const BOOKING_TYPE_VALUES = ['one_way', 'airport_pickup', 'airport_dropoff', 'round_trip', 'hourly'] as const

export function NewBookingForm({ vehicleTypes, drivers, corporateAccounts = [], labels: t }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [phase, setPhase] = useState<'route' | 'passenger'>('route')
  const [stopCount, setStopCount] = useState(0) // multi-stop (máx. 3)
  const [quote, setQuote]  = useState<QuoteResult | null>(null)
  const [error, setError]  = useState('')
  const [success, setSuccess] = useState('')

  // Guardamos los valores del formulario de ruta para pasarlos al createBookingAction
  const [routeFormData, setRouteFormData] = useState<FormData | null>(null)
  // Qué botón se pulsó: confirmar reserva o guardar como cotización.
  const asQuoteRef = useRef(false)

  // ── Fase 1: Calcular precio ───────────────────────────────────────────────────

  async function handleCalculatePrice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    setRouteFormData(fd)

    startTransition(async () => {
      const result = await calculateQuoteAction(fd)
      if (!result.success || !result.data) {
        setError(result.error ?? t.errCalc)
        return
      }
      setQuote(result.data)
      setPhase('passenger')
    })
  }

  // ── Fase 2: Crear reservación ─────────────────────────────────────────────────

  async function handleCreateBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!quote || !routeFormData) return
    setError('')

    const passengerFd = new FormData(e.currentTarget)
    // Combinar datos de ruta + pasajero + quote_id
    const combined = new FormData()
    for (const [k, v] of routeFormData.entries()) combined.set(k, v)
    for (const [k, v] of passengerFd.entries()) combined.set(k, v)
    combined.set('quote_id', quote.quoteId)
    const asQuote = asQuoteRef.current
    if (asQuote) combined.set('as_quote', 'true')

    startTransition(async () => {
      const result = await createBookingAction(combined)
      if (!result.success || !result.data) {
        setError(result.error ?? t.errCreate)
        return
      }
      setSuccess((asQuote ? t.successQuote : t.successCreated).replace('{number}', result.data.bookingNumber))
      const dest = asQuote ? '/admin/quotes' : `/admin/bookings/${result.data.bookingId}`
      setTimeout(() => router.push(dest), 1500)
    })
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <p className="text-green-700 font-semibold text-lg">{success}</p>
        <p className="text-sm text-green-600 mt-1">{t.redirecting}</p>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FASE 1: Ruta
  // ─────────────────────────────────────────────────────────────────────────────

  if (phase === 'route') {
    return (
      <form onSubmit={handleCalculatePrice} className="space-y-5">

        {/* Tipo de reservación */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.serviceType}
          </label>
          <select
            name="booking_type"
            defaultValue="one_way"
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          >
            {BOOKING_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>{t.types[v]}</option>
            ))}
          </select>
        </div>

        {/* Vehículo */}
        {vehicleTypes.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
              {t.vehicleType}
            </label>
            <select
              name="vehicle_type_id"
              className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
            >
              <option value="">{t.anyType}</option>
              {vehicleTypes.map((vt) => (
                <option key={vt.id} value={vt.id}>
                  {vt.name} ({vt.class}, {vt.capacity} {t.pax})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Fecha y hora */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.dateTime}
          </label>
          <input
            type="datetime-local"
            name="scheduled_at"
            required
            min={new Date().toISOString().slice(0, 16)}
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {/* Pickup */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.pickupLabel}
          </label>
          <AddressInput
            name="pickup"
            placeholder={t.pickupPlaceholder}
            required
          />
          <p className="mt-1 text-[11px] text-sl-on-surface-muted">
            {t.pickupHint}
          </p>
        </div>

        {/* Multi-stop: paradas intermedias */}
        {Array.from({ length: stopCount }).map((_, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                {t.stop.replace('{n}', String(i + 1))}
              </label>
              {i === stopCount - 1 && (
                <button
                  type="button"
                  onClick={() => setStopCount((c) => c - 1)}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t.remove}
                </button>
              )}
            </div>
            <AddressInput
              name={`stop_${i}`}
              placeholder={t.stopPlaceholder}
            />
          </div>
        ))}

        {stopCount < 3 && (
          <button
            type="button"
            onClick={() => setStopCount((c) => c + 1)}
            className="text-sm font-medium text-[#0071e3] hover:underline"
          >
            {t.addStop}
          </button>
        )}

        {/* Dropoff */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.dropoffLabel}
          </label>
          <AddressInput
            name="dropoff"
            placeholder={t.dropoffPlaceholder}
            required
          />
        </div>

        {/* Número de vuelo (solo para airport) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.flightNumber} <span className="font-normal normal-case">{t.optional}</span>
          </label>
          <input
            type="text"
            name="flight_number"
            placeholder="AA1234"
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-[#0071e3] text-white font-semibold rounded-xl hover:bg-[#0077ed] disabled:opacity-50 transition-colors"
        >
          {isPending ? t.calcLoading : t.calcCta}
        </button>
      </form>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FASE 2: Datos del pasajero
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Resumen del precio */}
      {quote && (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-3">
            {t.priceSummary}
          </p>
          <div className="space-y-1.5 text-sm">
            {quote.distanceMiles != null && (
              <div className="flex justify-between">
                <span className="text-sl-on-surface-muted">{t.distance}</span>
                <span className="text-sl-on-surface">{quote.distanceMiles.toFixed(1)} mi</span>
              </div>
            )}
            {quote.durationMinutes != null && (
              <div className="flex justify-between">
                <span className="text-sl-on-surface-muted">{t.durationEst}</span>
                <span className="text-sl-on-surface">{quote.durationMinutes} min</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sl-on-surface-muted">{t.baseFare}</span>
              <span className="text-sl-on-surface">${quote.baseAmount.toFixed(2)}</span>
            </div>
            {quote.surchargeAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-sl-on-surface-muted">{t.surcharge}</span>
                <span className="text-sl-on-surface">+${quote.surchargeAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-sl-outline-variant pt-2 mt-2">
              <span className="font-semibold text-sl-on-surface">{t.total}</span>
              <span className="font-bold text-xl text-sl-on-surface">
                ${quote.totalAmount.toFixed(2)} {quote.currency}
              </span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleCreateBooking} className="space-y-5">

        {/* Nombre */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.passengerName} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="passenger_name"
            required
            placeholder={t.namePlaceholder}
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.phone}
          </label>
          <input
            type="tel"
            name="passenger_phone"
            placeholder="+1 809 000 0000"
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.email} <span className="font-normal normal-case">{t.optional}</span>
          </label>
          <input
            type="email"
            name="passenger_email"
            placeholder="juan@example.com"
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {/* Pasajeros */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.passengerCount}
          </label>
          <input
            type="number"
            name="passenger_count"
            defaultValue={1}
            min={1}
            max={20}
            className="w-28 rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
          />
        </div>

        {/* Cuenta corporativa (F1.11) */}
        {corporateAccounts.length > 0 && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
              {t.corporateAccount} <span className="font-normal normal-case">{t.corporateHint}</span>
            </label>
            <select
              name="corporate_account_id"
              defaultValue=""
              className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20"
            >
              <option value="">{t.individualClient}</option>
              {corporateAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Instrucciones especiales */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.specialInstructions} <span className="font-normal normal-case">{t.optional}</span>
          </label>
          <textarea
            name="special_instructions"
            rows={2}
            placeholder={t.specialPlaceholder}
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 resize-none"
          />
        </div>

        {/* Notas internas */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted mb-2">
            {t.internalNotes} <span className="font-normal normal-case">{t.staffOnly}</span>
          </label>
          <textarea
            name="internal_notes"
            rows={2}
            placeholder={t.internalPlaceholder}
            className="w-full rounded-xl border border-sl-outline-variant bg-white px-4 py-2.5 text-sm text-sl-on-surface focus:border-[#0071e3] focus:outline-none focus:ring-2 focus:ring-[#0071e3]/20 resize-none"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => { setPhase('route'); setError('') }}
            className="px-5 py-3 border border-sl-outline-variant text-sm font-medium rounded-xl hover:border-[#0071e3] transition-colors text-sl-on-surface"
          >
            {t.back}
          </button>
          <button
            type="submit"
            onClick={() => { asQuoteRef.current = true }}
            disabled={isPending}
            className="px-5 py-3 border border-sl-outline-variant text-sm font-medium rounded-xl hover:border-[#0071e3] disabled:opacity-50 transition-colors text-sl-on-surface"
          >
            {t.saveQuote}
          </button>
          <button
            type="submit"
            onClick={() => { asQuoteRef.current = false }}
            disabled={isPending}
            className="flex-1 min-w-[140px] py-3 bg-[#0071e3] text-white font-semibold rounded-xl hover:bg-[#0077ed] disabled:opacity-50 transition-colors"
          >
            {isPending ? t.createLoading : t.createCta}
          </button>
        </div>
      </form>
    </div>
  )
}
