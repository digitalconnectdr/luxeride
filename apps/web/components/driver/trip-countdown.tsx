'use client'
// ── Conteo regresivo hasta la hora programada de un viaje en cola ─────────────
// Puramente informativo para el conductor (no bloquea nada) — le ayuda a
// priorizar cuál de sus viajes asignados-pero-no-iniciados debe atender antes.

import { useEffect, useState } from 'react'

export interface TripCountdownLabels {
  startsIn: string // placeholder {time}
  overdue: string // placeholder {time}
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(Math.abs(ms) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (days > 0 || hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}min`)
  return parts.join(' ')
}

export function TripCountdown({
  targetIso,
  labels,
}: {
  targetIso: string
  labels: TripCountdownLabels
}) {
  // null en el primer render (servidor) — evita un mismatch de hidratación,
  // ya que el servidor no conoce "ahora" en el momento exacto del cliente.
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (now === null) return null

  const diffMs = new Date(targetIso).getTime() - now
  const overdue = diffMs < 0
  const text = (overdue ? labels.overdue : labels.startsIn).replace('{time}', formatDuration(diffMs))

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 border whitespace-nowrap ${
        overdue
          ? 'text-red-600 bg-red-50 border-red-200'
          : 'text-[#8a6520] bg-[#8a6520]/10 border-[#8a6520]/20'
      }`}
    >
      ⏱ {text}
    </span>
  )
}
