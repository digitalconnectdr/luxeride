'use client'

// Barra de búsqueda del hero (plantilla Ivory). Estética tipo "search bar" del
// rubro: lugar de recogida + fecha/hora + botón. Es la PUERTA de entrada al flujo
// de reserva — al enviar navega a /reservar (el wizard recoge el detalle ahí).

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function IvoryBookingBar({
  reservarUrl,
  brandColor,
  labels,
}: {
  reservarUrl: string
  brandColor: string
  labels: { from: string; when: string; cta: string }
}) {
  const router = useRouter()
  const [from, setFrom] = useState('')
  const [when, setWhen] = useState('')

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const qs = new URLSearchParams()
    if (from.trim()) qs.set('from', from.trim())
    if (when) qs.set('when', when)
    const q = qs.toString()
    router.push(q ? `${reservarUrl}?${q}` : reservarUrl)
  }

  return (
    <form
      onSubmit={go}
      className="mt-9 w-full max-w-xl rounded-2xl bg-white ring-1 ring-black/10 shadow-xl shadow-black/[0.07] p-2 flex flex-col sm:flex-row items-stretch gap-2"
    >
      <label className="flex-1 flex flex-col px-4 py-2.5 rounded-xl hover:bg-black/[0.02] transition-colors cursor-text">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a948a]">{labels.from}</span>
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="—"
          className="bg-transparent outline-none text-sm text-[#1d1b18] placeholder:text-[#c9c3b8] mt-0.5"
        />
      </label>
      <span className="hidden sm:block w-px self-stretch bg-black/[0.07]" />
      <label className="flex-1 flex flex-col px-4 py-2.5 rounded-xl hover:bg-black/[0.02] transition-colors cursor-pointer">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a948a]">{labels.when}</span>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="bg-transparent outline-none text-sm text-[#1d1b18] mt-0.5 w-full [color-scheme:light]"
        />
      </label>
      <button
        type="submit"
        className="shrink-0 px-7 py-3.5 rounded-xl text-white text-sm font-semibold tracking-wide transition-transform hover:scale-[1.03] inline-flex items-center justify-center gap-2"
        style={{ backgroundColor: brandColor }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        {labels.cta}
      </button>
    </form>
  )
}
