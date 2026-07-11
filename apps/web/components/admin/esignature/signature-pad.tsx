'use client'
// ── Captura de firma en canvas (web) ───────────────────────────────────────────
// Implementación propia con mouse/touch en vez de una librería externa — el
// caso de uso es simple (dibujar trazos, exportar como PNG) y ya existe un
// patrón equivalente en React Native (apps/driver-mobile/components/SignatureModal.tsx)
// que no es reusable aquí por ser DOM vs. RN.

import { useRef, useState } from 'react'

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasStroke, setHasStroke] = useState(false)

  function getPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
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
      <canvas
        ref={canvasRef}
        width={500}
        height={160}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-40 bg-white border border-sl-outline-variant rounded-lg touch-none cursor-crosshair"
      />
      <button type="button" onClick={clear} className="text-xs text-sl-on-surface-muted hover:underline">
        Limpiar
      </button>
    </div>
  )
}
