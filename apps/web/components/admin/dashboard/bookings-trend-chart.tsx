'use client'
// ── Tendencia de reservas — barras (no línea SVG estirada) ─────────────────
// La versión anterior era un <path> de SVG con preserveAspectRatio="none"
// sobre un viewBox fijo — con series de enteros pequeños (0/1/2) eso dibuja
// picos triangulares muy agresivos y, cuando max=1, Math.round(max/2)
// también da 1, duplicando la etiqueta del eje Y ("1" dos veces). Barras con
// alto en % del contenedor no tienen ninguno de los dos problemas y escalan
// igual de bien a 7 barras (semana) que a 90 (rango largo).

import { useState, useTransition } from 'react'
import { getBookingsTrendAction, type TrendRange, type TrendPoint } from '@/app/actions/dashboard'

const RANGES: TrendRange[] = ['this_week', 'last_week', 'last_30', 'last_90']

export interface TrendChartLabels {
  this_week: string
  last_week: string
  last_30: string
  last_90: string
}

export function BookingsTrendChart({
  initialData,
  rangeLabels,
}: {
  initialData: TrendPoint[]
  rangeLabels: TrendChartLabels
}) {
  const [range, setRange] = useState<TrendRange>('this_week')
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  function selectRange(next: TrendRange) {
    if (next === range) return
    setRange(next)
    startTransition(async () => {
      const result = await getBookingsTrendAction(next)
      if (result.success && result.data) setData(result.data)
    })
  }

  const max = Math.max(1, ...data.map((d) => d.count))
  // Con muchas barras (30/90 días) no cabe una etiqueta bajo cada una — se
  // muestra solo cada N-ésima (siempre la primera y la última).
  const labelEvery = data.length <= 7 ? 1 : data.length <= 30 ? 5 : 15

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => selectRange(r)}
            disabled={isPending}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors disabled:opacity-60 ${
              range === r
                ? 'bg-[#8a6520] text-white'
                : 'bg-[#f6f4ef] text-[#75716a] hover:text-[#1d1b18]'
            }`}
          >
            {rangeLabels[r]}
          </button>
        ))}
      </div>

      <div className={`flex items-end gap-[3px] h-24 transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 min-w-[2px] h-full flex items-end" title={`${d.label}: ${d.count}`}>
            <div
              className="w-full bg-[#8a6520] rounded-t-sm transition-all"
              style={{ height: d.count === 0 ? '2px' : `${Math.max(6, (d.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex mt-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 min-w-[2px] text-center text-[9px] text-[#75716a] truncate">
            {i === 0 || i === data.length - 1 || i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
