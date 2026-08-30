import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { GeographyMaps, type CityCount } from '@/components/super-admin/geography-maps'
import { InfoTip } from '@/components/ui/info-tip'

export const metadata: Metadata = { title: 'Geografía | Super Admin' }
export const dynamic = 'force-dynamic'

const VISITS_WINDOW_DAYS = 90
const VISITS_ROW_CAP = 20_000

function aggregateByCity<T extends { city: string | null; country: string | null }>(
  rows: T[],
  reduceExtra: (acc: { latSum: number; lngSum: number; latN: number }, row: T) => void,
): CityCount[] {
  const byCity = new Map<
    string,
    { city: string; country: string | null; count: number; latSum: number; lngSum: number; latN: number }
  >()

  for (const row of rows) {
    if (!row.city) continue
    const key = `${row.city}|${row.country ?? ''}`
    const entry = byCity.get(key) ?? { city: row.city, country: row.country, count: 0, latSum: 0, lngSum: 0, latN: 0 }
    entry.count += 1
    reduceExtra(entry, row)
    byCity.set(key, entry)
  }

  return [...byCity.values()]
    .map((e) => ({
      city: e.city,
      country: e.country,
      count: e.count,
      lat: e.latN > 0 ? e.latSum / e.latN : null,
      lng: e.latN > 0 ? e.lngSum / e.latN : null,
    }))
    .sort((a, b) => b.count - a.count)
}

export default async function GeographyPage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - VISITS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: visits }, { data: companies }] = await Promise.all([
    admin
      .from('landing_page_visits')
      .select('city, country, lat, lng')
      .gte('visited_at', sinceIso)
      .order('visited_at', { ascending: false })
      .limit(VISITS_ROW_CAP),
    admin
      .from('companies')
      .select('city, country')
      .not('city', 'is', null),
  ])

  const visitorCities = aggregateByCity(visits ?? [], (acc, row) => {
    if (row.lat != null && row.lng != null) {
      acc.latSum += row.lat
      acc.lngSum += row.lng
      acc.latN += 1
    }
  })

  const companyCities = aggregateByCity(companies ?? [], () => {})

  const totalVisits = visitorCities.reduce((s, c) => s + c.count, 0)
  const totalCompanies = companyCities.reduce((s, c) => s + c.count, 0)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-[#1d1b18]">Geografía</h1>
        <p className="text-sm text-[#75716a] mt-1">
          De dónde vienen los visitantes del landing y dónde están las empresas ya registradas — para decidir dónde enfocar publicidad.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520] flex items-center">
            Visitantes del landing (últimos {VISITS_WINDOW_DAYS} días)
            <InfoTip text="Cada carga de una página pública de marketing (home, money/solution/compare/info/resource pages, pricing, referral) - no incluye el panel admin, ni el flujo de reserva de los micrositios de operadores. Cuenta visitas, no visitantes únicos: alguien que ve 3 páginas suma 3." />
          </p>
          <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">
            {totalVisits} <span className="text-sm font-sans font-normal text-[#75716a]">visitas · {visitorCities.length} ciudades</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a6520] flex items-center">
            Empresas registradas (con ciudad declarada)
            <InfoTip text="Empresas cuya ciudad está llena en Configuración → Información de la empresa. No es el total de empresas - las que no llenaron ese campo no aparecen aquí." />
          </p>
          <p className="text-2xl font-playfair font-semibold text-[#1d1b18] mt-1">
            {totalCompanies} <span className="text-sm font-sans font-normal text-[#75716a]">empresas · {companyCities.length} ciudades</span>
          </p>
        </div>
      </div>

      <GeographyMaps visitorCities={visitorCities} companyCities={companyCities} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CityRankTable title="Top ciudades por visitas" cities={visitorCities} unit="visitas" />
        <CityRankTable title="Top ciudades por empresas" cities={companyCities} unit="empresas" />
      </div>
    </div>
  )
}

function CityRankTable({ title, cities, unit }: { title: string; cities: CityCount[]; unit: string }) {
  const top = cities.slice(0, 15)
  return (
    <div className="bg-white border border-[#e5e1d8] rounded-xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a] mb-3">{title}</p>
      {top.length === 0 ? (
        <p className="text-sm text-[#75716a]">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {top.map((c, i) => (
            <li key={`${c.city}-${c.country}`} className="flex items-center justify-between text-sm">
              <span className="text-[#1d1b18]">
                <span className="text-[#75716a] font-mono text-xs mr-2">{i + 1}.</span>
                {c.city}
                {c.country && <span className="text-[#75716a]"> · {c.country}</span>}
              </span>
              <span className="font-playfair font-semibold text-[#8a6520]">
                {c.count} <span className="text-xs font-sans font-normal text-[#75716a]">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
