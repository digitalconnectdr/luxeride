'use client'
// ── Mapa en vivo de la flota — arriba del tablero de columnas ─────────────────
// Se refresca solo (mismo patrón que el tracking del pasajero): funciona sin
// depender de Realtime, respeta la misma cuota mensual por plan.

import { useCallback, useEffect, useState } from 'react'
import { refreshDispatchMapAction, type DispatchMapPoint } from '@/app/actions/dispatch-map'

const REFRESH_INTERVAL_MS = 20_000

export interface DispatchLiveMapLabels {
  title: string
  empty: string
  quotaExceeded: string
  legendDriver: string
  legendPending: string
}

export function DispatchLiveMap({ labels }: { labels: DispatchLiveMapLabels }) {
  const [url, setUrl] = useState<string | null>(null)
  const [points, setPoints] = useState<DispatchMapPoint[]>([])
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    const res = await refreshDispatchMapAction()
    if (!res) return
    setUrl(res.url)
    setPoints(res.points)
    setQuotaExceeded(res.quotaExceeded)
    setLoaded(true)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const driverCount = points.filter((p) => p.kind === 'driver').length
  const pendingCount = points.filter((p) => p.kind === 'pending').length

  if (!loaded) return null

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-sl-outline-variant flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">{labels.title}</p>
        {points.length > 0 && (
          <div className="flex items-center gap-3 text-[11px] text-sl-on-surface-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> {driverCount} {labels.legendDriver}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> {pendingCount} {labels.legendPending}</span>
          </div>
        )}
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={labels.title} className="w-full h-auto block" />
      ) : (
        <p className="text-sm text-sl-on-surface-muted text-center py-10">
          {quotaExceeded ? labels.quotaExceeded : labels.empty}
        </p>
      )}
    </div>
  )
}
