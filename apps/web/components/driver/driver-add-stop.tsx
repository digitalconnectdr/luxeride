'use client'
// ── El conductor agrega una parada a su viaje (con re-cotización) ──────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapsProvider } from '@/components/maps/maps-provider'
import { AddressInput } from '@/components/maps/address-input'
import { quoteTripStopAction, driverAddTripStopAction, type StopQuote } from '@/app/actions/trip'

interface StopPlace { address: string; lat?: number; lng?: number }

export function DriverAddStop({ bookingId }: { bookingId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<StopPlace | null>(null)
  const [quote, setQuote] = useState<StopQuote | null>(null)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function onSelect(p: StopPlace) {
    setPlace(p); setQuote(null)
    if (!p.address) return
    startTransition(async () => {
      const r = await quoteTripStopAction(bookingId, p)
      if (r.success && r.quote) setQuote(r.quote)
    })
  }

  function confirm() {
    if (!place?.address) return
    setError('')
    startTransition(async () => {
      const r = await driverAddTripStopAction(bookingId, place)
      if (!r.success) { setError(r.error ?? 'Error'); return }
      setDone(true); setOpen(false); setPlace(null); setQuote(null)
      router.refresh()
    })
  }

  if (done) return <p className="text-xs text-gold pt-2">✓ Parada agregada al viaje.</p>

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--brand)] hover:opacity-80 transition-opacity pt-1"
      >
        ➕ Agregar parada
      </button>
    )
  }

  const costLine = (() => {
    if (!quote) return null
    if (quote.extraAmount == null) return { text: 'El operador confirmará si tiene costo.', cls: 'text-sl-on-surface-muted' }
    if (quote.extraAmount <= 0) return { text: '✓ Sin costo adicional.', cls: 'text-green-400' }
    return { text: `Costo adicional: ${quote.extraAmount.toFixed(2)} ${quote.currency}`, cls: 'text-gold' }
  })()

  return (
    <div className="pt-2 space-y-2">
      <p className="text-xs font-semibold text-sl-on-surface">Agregar una parada</p>
      <MapsProvider>
        <AddressInput
          placeholder="Dirección de la parada…"
          onPlaceSelect={(p) => onSelect({ address: p.address, lat: p.lat, lng: p.lng })}
          onChange={(v) => { setPlace({ address: v }); setQuote(null) }}
          className="w-full rounded-lg border border-sl-outline-variant bg-sl-surface px-3 py-2 text-sm text-sl-on-surface placeholder:text-sl-on-surface-muted focus:outline-none focus:border-gold"
        />
      </MapsProvider>
      {costLine && <p className={`text-xs ${costLine.cls}`}>{costLine.text}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setPlace(null); setQuote(null); setError('') }}
          disabled={isPending}
          className="flex-1 py-2 text-xs font-medium border border-sl-outline-variant rounded-lg text-sl-on-surface-muted hover:text-sl-on-surface transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={confirm}
          disabled={isPending || !place?.address}
          className="flex-1 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Guardando…' : 'Confirmar parada'}
        </button>
      </div>
    </div>
  )
}
