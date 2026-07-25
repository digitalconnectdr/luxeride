'use client'
// ── Tendencia de reservas — barras (no línea SVG estirada) ─────────────────
// La versión anterior era un <path> de SVG con preserveAspectRatio="none"
// sobre un viewBox fijo — con series de enteros pequeños (0/1/2) eso dibuja
// picos triangulares muy agresivos y, cuando max=1, Math.round(max/2)
// también da 1, duplicando la etiqueta del eje Y ("1" dos veces). Barras con
// alto en % del contenedor no tienen ninguno de los dos problemas y escalan
// igual de bien a 7 barras (semana) que a 90 (rango largo).
//
// El selector de rango vive en la MISMA fila que el título (no en una fila
// aparte que empuja el gráfico hacia abajo) — 4 iconos compactos con un
// tooltip propio (no el title nativo del navegador, para que combine con el
// resto del sistema de diseño) que revela el texto al pasar el mouse/foco.

import { useState, useTransition } from 'react'
import { CalendarDays, History, CalendarRange, CalendarClock, type LucideIcon } from 'lucide-react'
import { getBookingsTrendAction, type TrendRange, type TrendPoint } from '@/app/actions/dashboard'

const RANGES: TrendRange[] = ['this_week', 'last_week', 'last_30', 'last_90']

const RANGE_ICON: Record<TrendRange, LucideIcon> = {
  this_week: CalendarDays,
  last_week: History,
  last_30: CalendarRange,
  last_90: CalendarClock,
}

export interface TrendChartLabels {
  this_week: string
  last_week: string
  last_30: string
  last_90: string
}

export function BookingsTrendChart({
  title,
  initialData,
  rangeLabels,
}: {
  title: string
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
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">{title}</p>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => {
            const Icon = RANGE_ICON[r]
            const active = range === r
            return (
              <div key={r} className="relative group">
                <button
                  type="button"
                  onClick={() => selectRange(r)}
                  disabled={isPending}
                  aria-label={rangeLabels[r]}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-60 ${
                    active
                      ? 'bg-bronze text-white shadow-sm'
                      : 'bg-[#f6f4ef] text-[#8a6520] hover:bg-[#efe9db]'
                  }`}
                >
                  <Icon size={13} strokeWidth={2} />
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-md bg-[#1d1b18] px-2 py-1 text-[10px] font-medium text-white opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all z-10"
                >
                  {rangeLabels[r]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Los iconos por sí solos no bastan para saber qué se está viendo —
      esta etiqueta queda siempre visible (no depende de pasar el mouse) con
      el rango actualmente seleccionado. */}
      <p className="text-xs font-medium text-bronze mb-3">{rangeLabels[range]}</p>

      <div className={`flex items-end gap-[3px] h-24 transition-opacity ${isPending ? 'opacity-50' : ''}`}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 min-w-[2px] h-full flex items-end" title={`${d.label}: ${d.count}`}>
            <div
              className="w-full bg-gradient-to-t from-bronze to-gold rounded-t-sm transition-all"
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
