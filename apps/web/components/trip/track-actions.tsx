'use client'
// ── Acciones del pasajero en el link de seguimiento ───────────────────────────
// Cancelar (respeta la política de cancelación), reportar al conductor y
// agregar una parada durante el viaje.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapsProvider } from '@/components/maps/maps-provider'
import { AddressInput } from '@/components/maps/address-input'
import {
  cancelTripByClientAction,
  reportDriverAction,
  addTripStopAction,
  quoteTripStopAction,
  getCancellationPreviewAction,
  type CancellationPreview,
  type StopQuote,
} from '@/app/actions/trip'

interface Labels {
  cancel: {
    action: string; title: string; desc: string
    reasonPh: string; confirm: string; back: string; done: string
    freeNote: string; feeNote: string
  }
  report: {
    action: string; title: string; desc: string
    reasonPh: string; send: string; done: string
    cats: { false_arrival: string; no_contact: string; unsafe: string; other: string }
  }
  addStop: {
    action: string; title: string; desc: string
    placeholder: string; send: string; done: string
    costFree: string; costExtra: string; costUnknown: string; payNote: string
  }
}

interface StopPlace { address: string; lat?: number; lng?: number }

type Panel = 'none' | 'cancel' | 'report' | 'addStop'

export function TrackActions({
  bookingId,
  brandColor,
  canCancel,
  canReport,
  canAddStop,
  labels,
}: {
  bookingId: string
  brandColor: string
  canCancel: boolean
  canReport: boolean
  canAddStop: boolean
  labels: Labels
}) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('none')
  const [reason, setReason] = useState('')
  const [stopPlace, setStopPlace] = useState<StopPlace | null>(null)
  const [stopQuote, setStopQuote] = useState<StopQuote | null>(null)
  const [category, setCategory] = useState<keyof Labels['report']['cats']>('false_arrival')
  const [error, setError] = useState('')
  const [reportDone, setReportDone] = useState(false)
  const [stopDone, setStopDone] = useState(false)
  const [preview, setPreview] = useState<CancellationPreview | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!canCancel && !canReport && !canAddStop) return null

  function openCancel() {
    setPanel('cancel'); setError(''); setPreview(null)
    startTransition(async () => {
      const res = await getCancellationPreviewAction(bookingId)
      if (res.success && res.preview) setPreview(res.preview)
    })
  }

  function doCancel() {
    setError('')
    startTransition(async () => {
      const res = await cancelTripByClientAction(bookingId, reason)
      if (!res.success) { setError(res.error ?? 'Error'); return }
      router.refresh()
    })
  }

  function doReport() {
    setError('')
    startTransition(async () => {
      const res = await reportDriverAction(bookingId, category, reason)
      if (!res.success) { setError(res.error ?? 'Error'); return }
      setReportDone(true); setPanel('none'); setReason('')
    })
  }

  function onStopSelect(place: StopPlace) {
    setStopPlace(place)
    setStopQuote(null)
    if (!place.address) return
    // Cotiza el costo de la parada al seleccionar la dirección
    startTransition(async () => {
      const res = await quoteTripStopAction(bookingId, place)
      if (res.success && res.quote) setStopQuote(res.quote)
    })
  }

  function doAddStop() {
    if (!stopPlace?.address) return
    setError('')
    startTransition(async () => {
      const res = await addTripStopAction(bookingId, stopPlace)
      if (!res.success) { setError(res.error ?? 'Error'); return }
      if (res.paymentUrl) { window.location.href = res.paymentUrl; return }
      setStopDone(true); setPanel('none'); setStopPlace(null); setStopQuote(null)
      router.refresh()
    })
  }

  const stopCostLine = (() => {
    if (!stopQuote) return null
    if (stopQuote.extraAmount == null) return { text: labels.addStop.costUnknown, tone: 'muted' as const }
    if (stopQuote.extraAmount <= 0) return { text: labels.addStop.costFree, tone: 'free' as const }
    const amount = `${stopQuote.extraAmount.toFixed(2)} ${stopQuote.currency}`
    return { text: labels.addStop.costExtra.replace('{amount}', amount), tone: 'fee' as const }
  })()

  const feeNote = preview && !preview.free
    ? labels.cancel.feeNote
        .replace('{amount}', `${preview.feeAmount.toFixed(2)} ${preview.currency}`)
        .replace('{pct}', String(preview.feePct))
    : null

  return (
    <div className="space-y-3">
      {reportDone && (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 text-center">
          {labels.report.done}
        </p>
      )}
      {stopDone && (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400 text-center">
          {labels.addStop.done}
        </p>
      )}

      {panel === 'cancel' ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 space-y-3">
          <p className="text-sm font-semibold text-white">{labels.cancel.title}</p>
          <p className="text-xs text-white/50">{labels.cancel.desc}</p>
          {/* Preview del cargo según política */}
          {preview && (
            <p className={`text-xs rounded-lg px-3 py-2 ${preview.free ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-300'}`}>
              {preview.free ? labels.cancel.freeNote : feeNote}
            </p>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.cancel.reasonPh}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setPanel('none'); setError('') }} disabled={isPending}
              className="flex-1 py-2.5 text-sm font-medium border border-white/15 rounded-xl text-white/80 hover:bg-white/5 transition-colors">
              {labels.cancel.back}
            </button>
            <button onClick={doCancel} disabled={isPending}
              className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
              {labels.cancel.confirm}
            </button>
          </div>
        </div>
      ) : panel === 'report' ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <p className="text-sm font-semibold text-white">{labels.report.title}</p>
          <p className="text-xs text-white/50">{labels.report.desc}</p>
          <div className="space-y-1.5">
            {(Object.keys(labels.report.cats) as Array<keyof Labels['report']['cats']>).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input type="radio" name="cat" checked={category === k} onChange={() => setCategory(k)} className="accent-[var(--brand)]" />
                {labels.report.cats[k]}
              </label>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.report.reasonPh}
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setPanel('none'); setError('') }} disabled={isPending}
              className="flex-1 py-2.5 text-sm font-medium border border-white/15 rounded-xl text-white/80 hover:bg-white/5 transition-colors">←</button>
            <button onClick={doReport} disabled={isPending}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-gray-900 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: brandColor }}>
              {labels.report.send}
            </button>
          </div>
        </div>
      ) : panel === 'addStop' ? (
        <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-5 space-y-3">
          <p className="text-sm font-semibold text-white">{labels.addStop.title}</p>
          <p className="text-xs text-white/50">{labels.addStop.desc}</p>
          <MapsProvider>
            <AddressInput
              placeholder={labels.addStop.placeholder}
              onPlaceSelect={(p) => onStopSelect({ address: p.address, lat: p.lat, lng: p.lng })}
              onChange={(v) => { setStopPlace({ address: v }); setStopQuote(null) }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
            />
          </MapsProvider>
          {/* Costo calculado de la parada */}
          {stopCostLine && (
            <p className={`text-xs rounded-lg px-3 py-2 ${
              stopCostLine.tone === 'free' ? 'bg-green-500/10 text-green-400'
              : stopCostLine.tone === 'fee' ? 'bg-amber-500/10 text-amber-300'
              : 'bg-white/5 text-white/50'
            }`}>
              {stopCostLine.text}
              {stopCostLine.tone === 'fee' && <span className="block mt-1 text-white/40">{labels.addStop.payNote}</span>}
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setPanel('none'); setError(''); setStopPlace(null); setStopQuote(null) }} disabled={isPending}
              className="flex-1 py-2.5 text-sm font-medium border border-white/15 rounded-xl text-white/80 hover:bg-white/5 transition-colors">←</button>
            <button onClick={doAddStop} disabled={isPending || !stopPlace?.address}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl text-gray-900 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: brandColor }}>
              {labels.addStop.send}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-2 justify-center items-center">
          {canAddStop && !stopDone && (
            <button onClick={() => { setPanel('addStop'); setError('') }}
              className="text-xs font-medium text-[var(--brand)] hover:opacity-80 transition-opacity">
              {labels.addStop.action}
            </button>
          )}
          {canReport && !reportDone && (
            <button onClick={() => { setPanel('report'); setError('') }}
              className="text-xs text-white/50 hover:text-white/80 underline underline-offset-2 transition-colors">
              {labels.report.action}
            </button>
          )}
          {canCancel && (
            <button onClick={openCancel}
              className="text-xs text-red-400/70 hover:text-red-400 underline underline-offset-2 transition-colors">
              {labels.cancel.action}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
