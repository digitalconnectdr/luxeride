'use client'
// ── Calificación del pasajero por el conductor (uso interno, no se muestra al pasajero) ──

import { useState, useTransition } from 'react'
import { submitDriverRatingAction } from '@/app/actions/driver'

export interface DriverRateFormLabels {
  starsHint: string
  ratingLabels: string[]
  commentPlaceholder: string
  submit: string
  submitting: string
  dismiss: string
  errorRating: string
  errorGeneric: string
}

export function DriverRateForm({
  bookingId,
  passengerName,
  brandColor,
  labels,
}: {
  bookingId: string
  passengerName: string
  brandColor: string
  labels: DriverRateFormLabels
}) {
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
    <div className="rounded-xl border border-[#e5e1d8] bg-white p-4 space-y-3">
      <p className="text-sm font-medium text-[#1d1b18] truncate">{passengerName}</p>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={labels.ratingLabels[n - 1]}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => { setRating(n); setError('') }}
            disabled={isPending}
            className="text-2xl leading-none transition-transform hover:scale-110 disabled:opacity-60"
            style={{ color: n <= active ? brandColor : '#e5e1d8' }}
          >
            ★
          </button>
        ))}
        {active > 0 && (
          <span className="ml-2 text-xs font-medium text-[#75716a]">{labels.ratingLabels[active - 1]}</span>
        )}
      </div>
      {active === 0 && <p className="text-[11px] text-[#a8a39a]">{labels.starsHint}</p>}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={labels.commentPlaceholder}
        disabled={isPending}
        className="w-full rounded-lg border border-[#e5e1d8] px-3 py-2 text-xs text-[#1d1b18] placeholder:text-[#a8a39a] focus:outline-none focus:border-[#8a6520] resize-none transition-colors"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#1d1b18] transition-opacity disabled:opacity-60"
          style={{ backgroundColor: brandColor }}
        >
          {isPending ? labels.submitting : labels.submit}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          disabled={isPending}
          className="px-3 py-2 rounded-lg text-xs font-medium text-[#75716a] hover:bg-[#faf8f3] transition-colors disabled:opacity-60"
        >
          {labels.dismiss}
        </button>
      </div>
    </div>
  )
}
