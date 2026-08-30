import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { GeographyTabs, type CityCount, type NameCount, type VisitorStats, type CompanyStats } from '@/components/super-admin/geography-maps'

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

function aggregateByField<T>(rows: T[], field: (row: T) => string | null): NameCount[] {
  const byName = new Map<string, number>()
  for (const row of rows) {
    const name = field(row)
    if (!name) continue
    byName.set(name, (byName.get(name) ?? 0) + 1)
  }
  return [...byName.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export default async function GeographyPage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - VISITS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const since24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const since7dIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30dIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data: visits }, { data: companiesWithCity }, { count: totalCompaniesCount }] = await Promise.all([
    admin
      .from('landing_page_visits')
      .select('city, country, path, lat, lng, visited_at')
      .gte('visited_at', sinceIso)
      .order('visited_at', { ascending: false })
      .limit(VISITS_ROW_CAP),
    admin
      .from('companies')
      .select('city, country, status')
      .not('city', 'is', null),
    admin.from('companies').select('id', { count: 'exact', head: true }),
  ])

  const visitRows = visits ?? []
  const companyRows = companiesWithCity ?? []

  const visitorStats: VisitorStats = {
    cities: aggregateByCity(visitRows, (acc, row) => {
      if (row.lat != null && row.lng != null) {
        acc.latSum += row.lat
        acc.lngSum += row.lng
        acc.latN += 1
      }
    }),
    countries: aggregateByField(visitRows, (r) => r.country).slice(0, 8),
    topPaths: aggregateByField(visitRows, (r) => r.path).slice(0, 8),
    total: visitRows.length,
    last24h: visitRows.filter((r) => r.visited_at >= since24hIso).length,
    last7d: visitRows.filter((r) => r.visited_at >= since7dIso).length,
    last30d: visitRows.filter((r) => r.visited_at >= since30dIso).length,
  }

  const companyStats: CompanyStats = {
    cities: aggregateByCity(companyRows, () => {}),
    countries: aggregateByField(companyRows, (r) => r.country).slice(0, 8),
    total: companyRows.length,
    totalAllCompanies: totalCompaniesCount ?? 0,
    active: companyRows.filter((r) => r.status === 'active').length,
    trial: companyRows.filter((r) => r.status === 'trial').length,
    suspended: companyRows.filter((r) => r.status === 'suspended').length,
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-[#1d1b18]">Geografía</h1>
        <p className="text-sm text-[#75716a] mt-1">
          De dónde vienen los visitantes del landing y dónde están las empresas ya registradas — para decidir dónde enfocar publicidad.
        </p>
      </div>

      <GeographyTabs visitorStats={visitorStats} companyStats={companyStats} visitsWindowDays={VISITS_WINDOW_DAYS} />
    </div>
  )
}
