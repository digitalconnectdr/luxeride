'use client'

import { useEffect, useRef } from 'react'
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

type ReviewsVariant = 'noir' | 'ivory' | 'bold' | 'corporate'

// Tokens por plantilla — cada una con su propia identidad tipográfica y de color,
// no solo claro/oscuro invertido.
const TOKENS: Record<ReviewsVariant, {
  section: string; title: string; muted: string; subtle: string; body: string
  navBtn: string; card: string; starInactive: string
}> = {
  noir: {
    section: 'bg-[#0b0b0c] text-white',
    title: 'font-playfair italic font-semibold',
    muted: 'text-white/50', subtle: 'text-white/40', body: 'text-white/65',
    navBtn: 'border-white/20 hover:bg-white/10', card: 'rounded-2xl border-white/10 bg-white/[0.03]',
    starInactive: 'rgba(255,255,255,0.2)',
  },
  ivory: {
    section: 'bg-[#f6f3ec] text-[#1d1b18]',
    title: 'font-playfair italic font-semibold',
    muted: 'text-[#75716a]', subtle: 'text-[#9a948a]', body: 'text-[#4e4639]',
    navBtn: 'border-black/15 hover:bg-black/5', card: 'rounded-2xl border-black/10 bg-white',
    starInactive: 'rgba(29,27,24,0.15)',
  },
  bold: {
    section: 'bg-[#f7f4ee] text-[#171512]',
    title: 'font-playfair italic font-medium',
    muted: 'text-[#7a7367]', subtle: 'text-[#9c9587]', body: 'text-[#48443c]',
    navBtn: 'border-black/15 hover:bg-black/5', card: 'rounded-2xl border-black/[0.06] bg-white shadow-sm shadow-black/[0.05]',
    starInactive: 'rgba(23,21,18,0.15)',
  },
  corporate: {
    section: 'bg-white text-[#161a1f]',
    title: 'font-sans font-semibold',
    muted: 'text-[#6b7280]', subtle: 'text-[#9ca3af]', body: 'text-[#42484f]',
    navBtn: 'border-black/10 hover:bg-black/[0.03]', card: 'rounded-xl border-black/[0.08] bg-white shadow-sm shadow-black/[0.03]',
    starInactive: 'rgba(22,26,31,0.15)',
  },
}

export function ReviewsCarousel({
  reviews,
  rating,
  total,
  title,
  reviewsLabel,
  brandColor,
  variant = 'noir',
}: {
  reviews: GoogleReview[]
  rating: number | null
  total: number | null
  title: string
  reviewsLabel: string
  brandColor: string
  variant?: ReviewsVariant
}) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 360, behavior: 'smooth' })

  // Auto-desplazamiento continuo (marquee elegante). Loop sin saltos duplicando
  // las reseñas: al pasar la mitad del track restamos la mitad → empalme invisible.
  // Pausa al pasar el cursor/tocar y respeta prefers-reduced-motion.
  const pausedRef = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    const speed = 0.45 // px por frame (~27px/s)
    const tick = () => {
      const half = el.scrollWidth / 2
      // Solo si el contenido realmente desborda
      if (!pausedRef.current && half > el.clientWidth + 8) {
        el.scrollLeft += speed
        if (el.scrollLeft >= half) el.scrollLeft -= half
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const tok = TOKENS[variant]

  // Duplicamos para el loop continuo (el auto-scroll necesita el track al doble).
  const track = [...reviews, ...reviews]

  return (
    <section className={`py-24 ${tok.section}`}>
      <div className="max-w-[1300px] mx-auto px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <h2 className={`text-3xl sm:text-4xl ${tok.title}`}>{title}</h2>
            {rating != null && (
              <div className="flex items-center gap-3 mt-3">
                <span className="text-2xl font-semibold" style={{ color: brandColor }}>{rating.toFixed(1)}</span>
                <Stars rating={rating} color={brandColor} inactive={tok.starInactive} />
                {total != null && <span className={`text-sm ${tok.muted}`}>· {total} {reviewsLabel}</span>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => scroll(-1)} aria-label="‹" className={`h-10 w-10 rounded-full border transition-colors ${tok.navBtn}`}>‹</button>
            <button onClick={() => scroll(1)} aria-label="›" className={`h-10 w-10 rounded-full border transition-colors ${tok.navBtn}`}>›</button>
          </div>
        </div>

        <div
          ref={ref}
          className="flex gap-5 overflow-x-auto pb-3"
          style={{ scrollbarWidth: 'none' }}
          onPointerEnter={() => { pausedRef.current = true }}
          onPointerLeave={() => { pausedRef.current = false }}
          onTouchStart={() => { pausedRef.current = true }}
          onTouchEnd={() => { pausedRef.current = false }}
        >
          {track.map((r, i) => (
            <div key={i} aria-hidden={i >= reviews.length} className={`shrink-0 w-[340px] border p-6 ${tok.card}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0" style={{ backgroundColor: `${brandColor}26`, color: brandColor }}>
                  {r.author.trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.author}</p>
                  <p className={`text-xs ${tok.subtle}`}>{r.relativeTime}</p>
                </div>
                <span className="ml-auto text-xs font-bold" style={{ color: '#4285F4' }} aria-label="Google">G</span>
              </div>
              <Stars rating={r.rating} color={brandColor} inactive={tok.starInactive} />
              <p className={`mt-3 text-sm leading-relaxed line-clamp-6 ${tok.body}`}>{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
