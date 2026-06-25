'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { submitReviewAction } from '@/app/actions/review'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type ReviewDict = Dictionary['review']

export function ReviewForm({
  bookingId,
  brandColor,
  t,
}: {
  bookingId: string
  brandColor: string
  t: ReviewDict
}) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (rating < 1) {
      setError(t.errorRating)
      return
    }
    setError('')
    startTransition(async () => {
      const result = await submitReviewAction(bookingId, rating, comment)
      if (!result.success) {
        setError(t.errorGeneric)
        return
      }
      router.refresh() // la página servidor re-renderiza el estado "ya calificado / gracias"
    })
  }

  const active = hover || rating
  const activeLabel = active > 0 ? t.ratingLabels[active - 1] : ''

  return (
    <div className="space-y-6">
      {/* Estrellas */}
      <div>
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5" role="radiogroup" aria-label={t.title}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t.ratingLabels[n - 1]}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => { setRating(n); setError('') }}
              disabled={isPending}
              className="text-[2.75rem] sm:text-5xl leading-none transition-all hover:scale-110 focus:outline-none disabled:opacity-60"
              style={{
                color: n <= active ? brandColor : 'rgba(255,255,255,0.18)',
                filter: n <= active ? `drop-shadow(0 2px 10px ${brandColor}55)` : 'none',
              }}
            >
              ★
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-medium h-5 transition-colors" style={{ color: activeLabel ? brandColor : 'rgba(255,255,255,0.4)' }}>
          {activeLabel || t.starsHint}
        </p>
      </div>

      {/* Comentario */}
      <div>
        <label htmlFor="review-comment" className="block text-xs uppercase tracking-widest text-white/50 mb-2">
          {t.commentLabel}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder={t.commentPlaceholder}
          disabled={isPending}
          className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full py-3.5 rounded-xl text-[#08080a] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        style={{ backgroundColor: brandColor }}
      >
        {isPending ? t.submitting : t.submit}
      </button>
    </div>
  )
}
