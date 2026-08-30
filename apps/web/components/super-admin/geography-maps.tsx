'use client'
// ── Mapas de geografía: visitantes del landing vs. empresas registradas ────
// Pestañas (mismo patrón de píldoras que components/admin/section-tabs.tsx,
// pero con los tokens hex propios del tema del super-admin, no los sl-* de
// admin) - cada pestaña muestra su mapa a ancho completo + estadísticas +
// rankings, en vez de dos mapas angostos lado a lado.
//
// Marker con label numérico = conteo, mismo patrón que zones-overview-map.tsx.
// El de visitantes usa lat/lng ya calculados en el servidor (promedio por
// ciudad). El de empresas geocodifica `city, country` en el navegador con
// google.maps.Geocoder() - mismo patrón - porque companies no guarda
// coordenadas, solo el nombre de la ciudad.

import { useEffect, useRef, useState } from 'react'
import { Map, Marker } from '@vis.gl/react-google-maps'
import { MapsProvider } from '@/components/maps/maps-provider'
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, APPLE_WHITE_MAP_STYLES } from '@/lib/maps/config'
import { InfoTip } from '@/components/ui/info-tip'

export interface CityCount {
  city: string
  country: string | null
  count: number
  lat: number | null
  lng: number | null
}

export interface NameCount {
  name: string
  count: number
}

export interface VisitorStats {
  cities: CityCount[]
  countries: NameCount[]
  topPaths: NameCount[]
  total: number
  last24h: number
  last7d: number
  last30d: number
}

export interface CompanyStats {
  cities: CityCount[]
  countries: NameCount[]
  total: number
  totalAllCompanies: number
  active: number
  trial: number
  suspended: number
}

const card = 'bg-white border border-[#e5e1d8] rounded-xl'

// ─── Mapas ──────────────────────────────────────────────────────────────────

function FitBoundsMap({
  points,
  children,
}: {
  points: { lat: number; lng: number }[]
  children: React.ReactNode
}) {
  return (
    <Map
      defaultCenter={DEFAULT_MAP_CENTER}
      defaultZoom={DEFAULT_MAP_ZOOM}
      styles={APPLE_WHITE_MAP_STYLES}
      gestureHandling="greedy"
      disableDefaultUI={false}
      zoomControl
      streetViewControl={false}
      mapTypeControl={false}
      fullscreenControl={false}
      {...(points.length > 0
        ? {
            defaultBounds: {
              north: Math.max(...points.map((p) => p.lat)) + 0.5,
              south: Math.min(...points.map((p) => p.lat)) - 0.5,
              east: Math.max(...points.map((p) => p.lng)) + 0.5,
              west: Math.min(...points.map((p) => p.lng)) - 0.5,
            },
          }
        : {})}
    >
      {children}
    </Map>
  )
}

function VisitorsMap({ cities }: { cities: CityCount[] }) {
  const points = cities.filter((c): c is CityCount & { lat: number; lng: number } => c.lat != null && c.lng != null)
  const maxCount = Math.max(1, ...points.map((p) => p.count))

  return (
    <FitBoundsMap points={points}>
      {points.map((c) => (
        <Marker
          key={`${c.city}-${c.country}`}
          position={{ lat: c.lat, lng: c.lng }}
          title={`${c.city}${c.country ? ', ' + c.country : ''} — ${c.count} visita${c.count === 1 ? '' : 's'}`}
          label={{ text: String(c.count), fontSize: '11px', fontWeight: 'bold', color: '#1d1b18' }}
          opacity={0.55 + 0.45 * (c.count / maxCount)}
        />
      ))}
    </FitBoundsMap>
  )
}

function CompaniesMap({ cities }: { cities: CityCount[] }) {
  const [pins, setPins] = useState<Record<string, { lat: number; lng: number }>>({})
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)

  useEffect(() => {
    if (typeof google === 'undefined' || !google.maps?.Geocoder) return
    if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder()

    const missing = cities.filter((c) => !(`${c.city}|${c.country}` in pins))
    for (const c of missing) {
      const key = `${c.city}|${c.country}`
      const address = [c.city, c.country].filter(Boolean).join(', ')
      geocoderRef.current.geocode({ address }, (results, status) => {
        if (status === 'OK' && results?.[0]?.geometry?.location) {
          const loc = results[0].geometry.location
          setPins((prev) => ({ ...prev, [key]: { lat: loc.lat(), lng: loc.lng() } }))
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  const points = cities
    .map((c) => ({ ...c, geo: pins[`${c.city}|${c.country}`] }))
    .filter((c): c is CityCount & { geo: { lat: number; lng: number } } => !!c.geo)
  const maxCount = Math.max(1, ...points.map((p) => p.count))

  return (
    <FitBoundsMap points={points.map((p) => p.geo)}>
      {points.map((c) => (
        <Marker
          key={`${c.city}-${c.country}`}
          position={c.geo}
          title={`${c.city}${c.country ? ', ' + c.country : ''} — ${c.count} empresa${c.count === 1 ? '' : 's'}`}
          label={{ text: String(c.count), fontSize: '11px', fontWeight: 'bold', color: '#ffffff' }}
          opacity={0.55 + 0.45 * (c.count / maxCount)}
        />
      ))}
    </FitBoundsMap>
  )
}

// ─── Piezas compartidas: stat cards + rankings ─────────────────────────────

function StatCard({
  label,
  value,
  sub,
  tip,
  small,
}: {
  label: string
  value: string | number
  sub?: string
  tip?: string
  small?: boolean
}) {
  return (
    <div className={`${card} px-4 py-3.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
        {label}
        {tip && <InfoTip text={tip} />}
      </p>
      <p
        className={`font-playfair font-semibold text-[#1d1b18] mt-1 truncate ${small ? 'text-base' : 'text-2xl'}`}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-[#75716a] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

function CityRankTable({ title, cities, unit }: { title: string; cities: CityCount[]; unit: string }) {
  const top = cities.slice(0, 15)
  return (
    <div className={`${card} p-5`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-3">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-[#75716a]">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((c, i) => (
            <li key={`${c.city}-${c.country}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#1d1b18] truncate" title={`${c.city}${c.country ? ', ' + c.country : ''}`}>
                <span className="text-[#75716a] font-mono text-xs mr-2">{i + 1}.</span>
                {c.city}
                {c.country && <span className="text-[#75716a]"> · {c.country}</span>}
              </span>
              <span className="font-playfair font-semibold text-[#8a6520] shrink-0">
                {c.count} <span className="text-xs font-sans font-normal text-[#75716a]">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NameRankTable({ title, items, unit }: { title: string; items: NameCount[]; unit: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-[#75716a]">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={it.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#1d1b18] truncate" title={it.name}>
                <span className="text-[#75716a] font-mono text-xs mr-2">{i + 1}.</span>
                {it.name}
              </span>
              <span className="font-playfair font-semibold text-[#8a6520] shrink-0">
                {it.count} <span className="text-xs font-sans font-normal text-[#75716a]">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Paneles por pestaña ────────────────────────────────────────────────────

function VisitorsPanel({ stats, windowDays }: { stats: VisitorStats; windowDays: number }) {
  const topCountry = stats.countries[0]
  const topPath = stats.topPaths[0]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label={`Visitas (${windowDays}d)`} value={stats.total} tip="Cada carga de una página pública de marketing - no incluye el panel admin, ni el flujo de reserva de los micrositios. Cuenta visitas, no visitantes únicos." />
        <StatCard label="Ciudades" value={stats.cities.length} />
        <StatCard label="País principal" value={topCountry?.name ?? '—'} sub={topCountry ? `${topCountry.count} visitas` : undefined} small />
        <StatCard label="Página más vista" value={topPath?.name ?? '—'} sub={topPath ? `${topPath.count} visitas` : undefined} small />
        <StatCard label="Últimas 24 h" value={stats.last24h} />
        <StatCard label="Últimos 7 días" value={stats.last7d} />
      </div>

      <div className={`${card} overflow-hidden h-[520px]`}>
        <VisitorsMap cities={stats.cities} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CityRankTable title="Top ciudades" cities={stats.cities} unit="visitas" />
        <NameRankTable title="Top países" items={stats.countries} unit="visitas" />
        <NameRankTable title="Páginas más visitadas" items={stats.topPaths} unit="visitas" />
      </div>
    </div>
  )
}

function CompaniesPanel({ stats }: { stats: CompanyStats }) {
  const topCountry = stats.countries[0]
  const coveragePct = stats.totalAllCompanies > 0 ? Math.round((stats.total / stats.totalAllCompanies) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Empresas con ciudad" value={stats.total} />
        <StatCard label="Ciudades" value={stats.cities.length} />
        <StatCard label="País principal" value={topCountry?.name ?? '—'} sub={topCountry ? `${topCountry.count} empresas` : undefined} small />
        <StatCard
          label="Cobertura de dato"
          value={`${coveragePct}%`}
          sub={`${stats.total} de ${stats.totalAllCompanies} empresas`}
          tip="Porcentaje de TODAS las empresas (cualquier estado) que tienen la ciudad llena en Configuración → Información de la empresa. El resto no aparece en el mapa."
        />
        <StatCard label="Activas" value={stats.active} tip="Entre las empresas con ciudad declarada." />
        <StatCard label="En prueba" value={stats.trial} tip="Entre las empresas con ciudad declarada." />
      </div>

      <div className={`${card} overflow-hidden h-[520px]`}>
        <CompaniesMap cities={stats.cities} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CityRankTable title="Top ciudades" cities={stats.cities} unit="empresas" />
        <NameRankTable title="Top países" items={stats.countries} unit="empresas" />
      </div>
    </div>
  )
}

// ─── Pestañas ───────────────────────────────────────────────────────────────

type TabKey = 'visitors' | 'companies'

export function GeographyTabs({
  visitorStats,
  companyStats,
  visitsWindowDays,
}: {
  visitorStats: VisitorStats
  companyStats: CompanyStats
  visitsWindowDays: number
}) {
  const [tab, setTab] = useState<TabKey>('visitors')

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'visitors', label: 'Visitantes del landing' },
    { key: 'companies', label: 'Empresas registradas' },
  ]

  return (
    <MapsProvider>
      <div className="space-y-5">
        <div
          role="tablist"
          aria-label="Vista de geografía"
          className="inline-flex items-center gap-1 bg-[#f6f4ef] rounded-full p-1 border border-[#e5e1d8]"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                tab === t.key ? 'bg-[#8a6520] text-white shadow-sm' : 'text-[#75716a] hover:text-[#1d1b18]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === 'visitors' ? (
            <VisitorsPanel stats={visitorStats} windowDays={visitsWindowDays} />
          ) : (
            <CompaniesPanel stats={companyStats} />
          )}
        </div>
      </div>
    </MapsProvider>
  )
}
