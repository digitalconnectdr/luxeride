'use client'
// ── InfoTip — popup explicativo (hover en desktop, tap en móvil) ──────────────
// Uso: <label>Cargo de pickup ($) <InfoTip text="..." /></label>
//
// El popup se renderiza en un portal a document.body con position:fixed
// calculada desde la posición real del botón — así nunca se corta por el
// overflow-hidden de una tarjeta/tabla contenedora (antes se cortaba cuando
// el ícono estaba dentro de un <th> de tabla, p.ej. en /super-admin/tracking).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_WIDTH = 288 // w-72
const VIEWPORT_MARGIN = 10

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Cerrar al hacer clic fuera (para el modo tap)
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function show() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const half = TOOLTIP_WIDTH / 2
      const rawLeft = rect.left + rect.width / 2
      const left = Math.min(Math.max(rawLeft, half + VIEWPORT_MARGIN), window.innerWidth - half - VIEWPORT_MARGIN)
      setPos({ top: rect.top - 8, left })
    }
    setOpen(true)
  }

  return (
    <span
      ref={wrapRef}
      className="relative inline-block align-middle ml-1.5"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          if (open) setOpen(false)
          else show()
        }}
        aria-label={text}
        aria-expanded={open}
        className={`w-4 h-4 inline-flex items-center justify-center rounded-full border text-[9px] font-bold cursor-help select-none transition-colors ${
          open
            ? 'border-bronze text-bronze bg-bronze/10'
            : 'border-sl-outline-variant bg-sl-bg text-sl-on-surface-muted'
        }`}
      >
        i
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <span
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translate(-50%, -100%)', width: TOOLTIP_WIDTH }}
          className="z-[200] rounded-xl bg-[#1d1b18] text-[#f5f2ec] text-[11px] leading-relaxed px-3.5 py-3 shadow-2xl normal-case font-normal tracking-normal whitespace-normal text-left block"
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-[#1d1b18]" />
        </span>,
        document.body,
      )}
    </span>
  )
}
