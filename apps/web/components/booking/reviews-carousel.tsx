'use client'

import { useRef } from 'react'
import type { GoogleReview } from '@/lib/reviews/google'

function Stars({ rating, color }: { rating: number; color: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(rating) ? color : 'rgba(255,255,255,0.2)' }}>★</span>
      ))}
    </div>
  )
}

export function ReviewsCarousel({
  reviews,
  rating,
  total,
  title,
  brandColor,
}: {
  reviews: GoogleReview[]
  rating: number | null
  total: number | null
  title: string
  brandColor: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })

  return (
    <section className="py-24 bg-[#0b0b0c]">
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold italic">{title}</h2>
            {rating != null && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-2xl font-semibold" style={{ color: brandColor }}>{rating.toFixed(1)}</span>
                <Stars rating={rating} color={brandColor} />
                {total != null && <span className="text-sm text-white/50">· {total} reseñas en Google</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(-1)} aria-label="Anterior" className="h-10 w-10 rounded-full border border-white/20 hover:bg-white/10 transition-colors">‹</button>
            <button onClick={() => scroll(1)} aria-label="Siguiente" className="h-10 w-10 rounded-full border border-white/20 hover:bg-white/10 transition-colors">›</button>
          </div>
        </div>

        <div ref={ref} className="flex gap-5 overflow-x-auto pb-3 snap-x" style={{ scrollbarWidth: 'none' }}>
          {reviews.map((r, i) => (
            <div key={i} className="snap-start shrink-0 w-[340px] rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: `${brandColor}26`, color: brandColor }}>
                  {r.author.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.author}</p>
                  <p className="text-xs text-white/40">{r.relativeTime}</p>
                </div>
                <span className="ml-auto text-xs font-bold" style={{ color: '#4285F4' }} aria-label="Google">G</span>
              </div>
              <Stars rating={r.rating} color={brandColor} />
              <p className="mt-3 text-sm text-white/65 leading-relaxed line-clamp-6">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
