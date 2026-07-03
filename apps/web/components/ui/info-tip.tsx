'use client'
// ── InfoTip — popup explicativo (hover en desktop, tap en móvil) ──────────────
// Uso: <label>Cargo de pickup ($) <InfoTip text="..." /></label>
//
// El popup se renderiza en un portal a document.body con position:fixed
// calculada desde la posición real del botón — así nunca se corta por el
// overflow-hidden de una tarjeta/tabla contenedora (antes se cortaba cuando
// el ícono estaba dentro de un <th> de tabla, p.ej. en /super-admin/tracking).
//
// Además se mide la altura real del contenido (2 pasadas: se renderiza oculto
// primero) para decidir si el popup abre hacia ARRIBA o hacia ABAJO del ícono
// — si el ícono está cerca del borde superior de la ventana, abrir siempre
// hacia arriba lo empujaba fuera de la pantalla y se veía "cortado".

import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const TOOLTIP_WIDTH = 288 // w-72
const VIEWPORT_MARGIN = 10

type Placement = 'top' | 'bottom'

interface Pos {
  top: number
  left: number
  placement: Placement
  ready: boolean
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const buttonRectRef = useRef<DOMRect | null>(null)

  // Cerrar al hacer clic fuera (para el modo tap)
  useLayoutEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Segunda pasada: una vez el tooltip está en el DOM (oculto), medimos su
  // altura real y decidimos arriba/abajo + posición final.
  useLayoutEffect(() => {
    if (!open || !pos || pos.ready || !tipRef.current) return
    const rect = buttonRectRef.current
    if (!rect) return
    const height = tipRef.current.offsetHeight
    const spaceAbove = rect.top
    const spaceBelow = window.innerHeight - rect.bottom
    const placement: Placement = spaceAbove >= height + 16 || spaceAbove >= spaceBelow ? 'top' : 'bottom'
    const top = placement === 'top' ? rect.top - 8 : rect.bottom + 8
    setPos({ ...pos, top, placement, ready: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos])

  function show() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    buttonRectRef.current = rect
    const half = TOOLTIP_WIDTH / 2
    const rawLeft = rect.left + rect.width / 2
    const left = Math.min(Math.max(rawLeft, half + VIEWPORT_MARGIN), window.innerWidth - half - VIEWPORT_MARGIN)
    setPos({ top: rect.top - 8, left, placement: 'top', ready: false })
    setOpen(true)
  }

  const transform = pos?.placement === 'bottom' ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'

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
          ref={tipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform,
            width: TOOLTIP_WIDTH,
            visibility: pos.ready ? 'visible' : 'hidden',
          }}
          className="z-[200] rounded-xl bg-[#1d1b18] text-[#f5f2ec] text-[11px] leading-relaxed px-3.5 py-3 shadow-2xl normal-case font-normal tracking-normal whitespace-normal text-left block"
        >
          {text}
          {pos.placement === 'top' ? (
            <span className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-[#1d1b18]" />
          ) : (
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full border-[6px] border-transparent border-b-[#1d1b18]" />
          )}
        </span>,
        document.body,
      )}
    </span>
  )
}
