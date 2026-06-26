'use client'

import { useRef } from 'react'
import type { GoogleReview } from '@/lib/reviews/google'

function Stars({ rating, color, inactive }: { rating: number; color: string; inactive: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= Math.round(rating) ? color : inactive }}>★</span>
      ))}
    </div>
  )
}

export function ReviewsCarousel({
  reviews,
  rating,
  total,
  title,
  reviewsLabel,
  brandColor,
  light = false,
}: {
  reviews: GoogleReview[]
  rating: number | null
  total: number | null
  title: string
  reviewsLabel: string
  brandColor: string
  light?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })

  // Tokens por tema (Noir oscuro / Ivory claro)
  const sectionCls = light ? 'bg-[#f6f3ec] text-[#1d1b18]' : 'bg-[#0b0b0c] text-white'
  const muted = light ? 'text-[#75716a]' : 'text-white/50'
  const subtle = light ? 'text-[#9a948a]' : 'text-white/40'
  const body = light ? 'text-[#4e4639]' : 'text-white/65'
  const navBtn = light ? 'border-black/15 hover:bg-black/5' : 'border-white/20 hover:bg-white/10'
  const cardCls = light ? 'border-black/10 bg-white' : 'border-white/10 bg-white/[0.03]'
  const starInactive = light ? 'rgba(29,27,24,0.15)' : 'rgba(255,255,255,0.2)'

  return (
    <section className={`py-24 ${sectionCls}`}>
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2 className="font-playfair text-3xl sm:text-4xl font-semibold italic">{title}</h2>
            {rating != null && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-2xl font-semibold" style={{ color: brandColor }}>{rating.toFixed(1)}</span>
                <Stars rating={rating} color={brandColor} inactive={starInactive} />
                {total != null && <span className={`text-sm ${muted}`}>· {total} {reviewsLabel}</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(-1)} aria-label="‹" className={`h-10 w-10 rounded-full border transition-colors ${navBtn}`}>‹</button>
            <button onClick={() => scroll(1)} aria-label="›" className={`h-10 w-10 rounded-full border transition-colors ${navBtn}`}>›</button>
          </div>
        </div>

        <div ref={ref} className="flex gap-5 overflow-x-auto pb-3 snap-x" style={{ scrollbarWidth: 'none' }}>
          {reviews.map((r, i) => (
            <div key={i} className={`snap-start shrink-0 w-[340px] rounded-2xl border p-6 ${cardCls}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: `${brandColor}26`, color: brandColor }}>
                  {r.author.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.author}</p>
                  <p className={`text-xs ${subtle}`}>{r.relativeTime}</p>
                </div>
                <span className="ml-auto text-xs font-bold" style={{ color: '#4285F4' }} aria-label="Google">G</span>
              </div>
              <Stars rating={r.rating} color={brandColor} inactive={starInactive} />
              <p className={`mt-3 text-sm leading-relaxed line-clamp-6 ${body}`}>{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
