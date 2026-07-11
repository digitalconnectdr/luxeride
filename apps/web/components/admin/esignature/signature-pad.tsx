'use client'
// ── Captura de firma en canvas (web) ───────────────────────────────────────────
// Implementación propia con mouse/touch en vez de una librería externa — el
// caso de uso es simple (dibujar trazos, exportar como PNG) y ya existe un
// patrón equivalente en React Native (apps/driver-mobile/components/SignatureModal.tsx)
// que no es reusable aquí por ser DOM vs. RN.
//
// La resolución interna del canvas se ajusta al tamaño real renderizado (más
// devicePixelRatio) en vez de usar un width/height fijo — un canvas de
// resolución fija se estira por CSS en pantallas angostas (cualquier
// celular), y ahí las coordenadas del dedo dejan de coincidir con donde
// realmente se dibuja el trazo. Este ajuste corre solo al montar (el modal
// se abre fresco cada vez que se firma), así que no hay riesgo de borrar una
// firma a medio hacer por un resize.

import { useEffect, useRef, useState } from 'react'

const DISPLAY_HEIGHT = 160

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = DISPLAY_HEIGHT * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1d1d1f'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    if (!hasStroke) setHasStroke(true)
  }

  function end() {
    if (!drawing.current) return
    drawing.current = false
    const canvas = canvasRef.current
    onChange(canvas ? canvas.toDataURL('image/png') : null)
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} style={{ height: DISPLAY_HEIGHT }} className="w-full">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          className="w-full h-full bg-white border border-sl-outline-variant rounded-lg touch-none cursor-crosshair"
        />
      </div>
      <button type="button" onClick={clear} className="text-xs text-sl-on-surface-muted hover:underline">
        Limpiar
      </button>
    </div>
  )
}
