'use client'
// ── El conductor agrega una parada a su viaje (con re-cotización) ──────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapsProvider } from '@/components/maps/maps-provider'
import { AddressInput } from '@/components/maps/address-input'
import { quoteTripStopAction, driverAddTripStopAction, type StopQuote } from '@/app/actions/trip'

interface StopPlace { address: string; lat?: number; lng?: number }

export interface AddStopLabels {
  trigger: string
  title: string
  placeholder: string
  confirm: string
  cancel: string
  done: string
  saving: string
  costUnknown: string
  costFree: string
  costExtra: string
}

export function DriverAddStop({ bookingId, labels }: { bookingId: string; labels: AddStopLabels }) {
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

  const costLine = (() => {
    if (!quote) return null
    if (quote.extraAmount == null) return { text: labels.costUnknown, cls: 'text-[#75716a]' }
    if (quote.extraAmount <= 0) return { text: labels.costFree, cls: 'text-green-600' }
    return { text: labels.costExtra.replace('{amount}', `${quote.extraAmount.toFixed(2)} ${quote.currency}`), cls: 'text-[#8a6520]' }
  })()

  return (
    <div className="pt-2 space-y-2">
      <p className="text-xs font-semibold text-[#1d1b18]">{labels.title}</p>
      <MapsProvider>
        <AddressInput
          placeholder={labels.placeholder}
          onPlaceSelect={(p) => onSelect({ address: p.address, lat: p.lat, lng: p.lng })}
          onChange={(v) => { setPlace({ address: v }); setQuote(null) }}
          className="w-full rounded-lg border border-[#e5e1d8] bg-white px-3 py-2 text-sm text-[#1d1b18] placeholder:text-[#a8a39a] focus:outline-none focus:border-[#8a6520]"
        />
      </MapsProvider>
      {costLine && <p className={`text-xs ${costLine.cls}`}>{costLine.text}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => { setOpen(false); setPlace(null); setQuote(null); setError('') }}
          disabled={isPending}
          className="flex-1 py-2 text-xs font-medium border border-[#e5e1d8] rounded-lg text-[#75716a] hover:text-[#1d1b18] transition-colors"
        >
          {labels.cancel}
        </button>
        <button
          onClick={confirm}
          disabled={isPending || !place?.address}
          className="flex-1 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? labels.saving : labels.confirm}
        </button>
      </div>
    </div>
  )
}
