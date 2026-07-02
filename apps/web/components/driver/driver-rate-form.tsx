'use client'
// ── Calificación del pasajero por el conductor (uso interno, no se muestra al pasajero) ──
// Patrón espejo del flujo del pasajero (/review/[id]): un botón "Calificar viaje"
// que abre un modal con estrellas + comentario, en vez de un formulario siempre
// expandido en la lista.

import { useState, useTransition } from 'react'
import { submitDriverRatingAction } from '@/app/actions/driver'

export interface DriverRateFormLabels {
  cta: string
  modalTitle: string
  starsHint: string
  ratingLabels: string[]
  commentPlaceholder: string
  submit: string
  submitting: string
  dismiss: string
  close: string
  errorRating: string
  errorGeneric: string
}

export function DriverRateForm({
  bookingId,
  bookingNumber,
  passengerName,
  brandColor,
  labels,
}: {
  bookingId: string
  bookingNumber: string
  passengerName: string
  brandColor: string
  labels: DriverRateFormLabels
}) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (done || dismissed) return null

  function submit() {
    if (rating < 1) {
      setError(labels.errorRating)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await submitDriverRatingAction(bookingId, rating, comment)
      if (!result.success) {
        setError(labels.errorGeneric)
        return
      }
      setDone(true)
    })
  }

  const active = hover || rating

  return (
    <>
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1d1b18] truncate">{passengerName}</p>
          <p className="text-[11px] text-[#a8a39a] font-mono">{bookingNumber}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 rounded-full text-xs font-semibold text-[#1d1b18] transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: brandColor }}
          >
            {labels.cta} →
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-[11px] text-[#a8a39a] hover:text-[#75716a] transition-colors"
          >
            {labels.dismiss}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={labels.close}
              className="absolute top-4 right-4 text-[#a8a39a] hover:text-[#1d1b18] transition-colors text-lg leading-none"
            >
              ✕
            </button>

            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#75716a] mb-1">{labels.modalTitle}</p>
            <p className="text-sm font-medium text-[#1d1b18] mb-4">{passengerName}</p>

            <div className="flex items-center gap-1.5 mb-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={labels.ratingLabels[n - 1]}
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => { setRating(n); setError('') }}
                  disabled={isPending}
                  className="text-3xl leading-none transition-transform hover:scale-110 disabled:opacity-60"
                  style={{ color: n <= active ? brandColor : '#e5e1d8' }}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="text-xs font-medium mb-4 h-4" style={{ color: active > 0 ? brandColor : '#a8a39a' }}>
              {active > 0 ? labels.ratingLabels[active - 1] : labels.starsHint}
            </p>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={labels.commentPlaceholder}
              disabled={isPending}
              className="w-full rounded-xl border border-[#e5e1d8] px-3.5 py-2.5 text-sm text-[#1d1b18] placeholder:text-[#a8a39a] focus:outline-none focus:border-[#8a6520] resize-none transition-colors mb-4"
            />

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="w-full py-3 rounded-xl text-sm font-semibold text-[#1d1b18] transition-opacity disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              {isPending ? labels.submitting : labels.submit}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
