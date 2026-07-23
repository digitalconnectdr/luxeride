'use client'
// ── Reporte de rutas frecuentes ────────────────────────────────────────────
// Insight geográfico (origen/destino por ciudad) + desglose por canal
// (web/app/staff) para que el operador sepa dónde y cómo pautar
// Google Ads/Meta. Solo lectura — no consume la cuota de ai_growth_generations.

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { Dictionary } from '@/lib/i18n/server'
import { getRouteInsightsAction, type RouteInsightsData } from '@/app/actions/route-insights'
import { RouteInsightsMap } from './route-insights-map'

type T = Dictionary['admin']['growthAssistant']

const RANGE_OPTIONS = [
  { days: 30, key: '30d' as const },
  { days: 90, key: '90d' as const },
  { days: 365, key: '365d' as const },
]

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function RouteInsightsReport({ t }: { t: T }) {
  const [rangeDays, setRangeDays] = useState(90)
  const [vehicleTypeId, setVehicleTypeId] = useState('')
  const [data, setData] = useState<RouteInsightsData | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const fromDate = useMemo(() => new Date(Date.now() - rangeDays * 86_400_000).toISOString(), [rangeDays])

  useEffect(() => {
    startTransition(async () => {
      const res = await getRouteInsightsAction({ fromDate, vehicleTypeId: vehicleTypeId || undefined })
      if (!res.success || !res.data) {
        setError(res.error ?? 'error')
        return
      }
      setError('')
      setData(res.data)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, vehicleTypeId])

  const totalBookings = data ? data.bySource.web + data.bySource.mobileApp + data.bySource.staff : 0
  const sourcePct = (n: number) => (totalBookings > 0 ? Math.round((n / totalBookings) * 100) : 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 bg-sl-surface-variant/50 rounded-full p-1 border border-sl-outline-variant">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setRangeDays(opt.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                rangeDays === opt.days ? 'bg-bronze text-white' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
              }`}
            >
              {t.rangeLabels[opt.key]}
            </button>
          ))}
        </div>

        {data && data.vehicleTypes.length > 0 && (
          <select
            value={vehicleTypeId}
            onChange={(e) => setVehicleTypeId(e.target.value)}
            className="text-xs bg-white border border-sl-outline-variant rounded-full px-3 py-1.5 text-sl-on-surface focus:border-bronze focus:outline-none"
          >
            <option value="">{t.allVehicleTypes}</option>
            {data.vehicleTypes.map((vt) => (
              <option key={vt.id} value={vt.id}>{vt.name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{t.routesError}</p>}

      {isPending && !data && <p className="text-sm text-sl-on-surface-muted">{t.routesLoading}</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 max-w-xl">
            <SourceStat label={t.sourceWeb} count={data.bySource.web} pct={sourcePct(data.bySource.web)} />
            <SourceStat label={t.sourceMobileApp} count={data.bySource.mobileApp} pct={sourcePct(data.bySource.mobileApp)} />
            <SourceStat label={t.sourceStaff} count={data.bySource.staff} pct={sourcePct(data.bySource.staff)} />
          </div>

          {data.corridors.length === 0 ? (
            <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-8 text-center">
              <p className="text-sm text-sl-on-surface-muted">{t.routesEmpty}</p>
            </div>
          ) : (
            <>
              <RouteInsightsMap
                corridors={data.corridors}
                pickupPoints={data.pickupHeatmapPoints}
                dropoffPoints={data.dropoffHeatmapPoints}
                t={t}
              />

              <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 overflow-x-auto">
                <h3 className="text-sm font-semibold text-sl-on-surface mb-4">{t.topCorridorsTitle}</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-sl-on-surface-muted border-b border-sl-outline-variant">
                      <th className="pb-2 pr-4 font-medium">{t.colOrigin}</th>
                      <th className="pb-2 pr-4 font-medium">{t.colDestination}</th>
                      <th className="pb-2 pr-4 font-medium text-right">{t.colTrips}</th>
                      <th className="pb-2 pr-4 font-medium text-right">{t.colRevenue}</th>
                      <th className="pb-2 font-medium text-right">{t.colAvgFare}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.corridors.map((c) => (
                      <tr key={`${c.originCity}-${c.destCity}`} className="border-b border-sl-outline-variant/50 last:border-0">
                        <td className="py-2 pr-4 text-sl-on-surface">{c.originCity}</td>
                        <td className="py-2 pr-4 text-sl-on-surface">{c.destCity}</td>
                        <td className="py-2 pr-4 text-right text-sl-on-surface tabular-nums">{c.count}</td>
                        <td className="py-2 pr-4 text-right text-sl-on-surface tabular-nums">{money(c.totalRevenue)}</td>
                        <td className="py-2 text-right text-sl-on-surface tabular-nums">{money(c.avgFare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <CityList title={t.topOriginCitiesTitle} cities={data.topOriginCities} />
                <CityList title={t.topDestinationCitiesTitle} cities={data.topDestinationCities} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function SourceStat({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div className="bg-white border border-sl-outline-variant rounded-xl px-4 py-3">
      <p className="text-xs text-sl-on-surface-muted">{label}</p>
      <p className="text-lg font-semibold text-sl-on-surface tabular-nums">{count}</p>
      <p className="text-xs text-sl-on-surface-muted">{pct}%</p>
    </div>
  )
}

function CityList({ title, cities }: { title: string; cities: RouteInsightsData['topOriginCities'] }) {
  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h3 className="text-sm font-semibold text-sl-on-surface mb-3">{title}</h3>
      {cities.length === 0 ? (
        <p className="text-xs text-sl-on-surface-muted">—</p>
      ) : (
        <ul className="space-y-2">
          {cities.slice(0, 8).map((c) => (
            <li key={c.city} className="flex items-center justify-between text-sm">
              <span className="text-sl-on-surface">{c.city}</span>
              <span className="text-sl-on-surface-muted tabular-nums">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
