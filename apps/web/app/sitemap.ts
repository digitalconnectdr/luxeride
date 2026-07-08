import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

const BASE = getAppUrl()

// El sitemap incluye el landing del software + el portal de reservas de cada
// operador ACTIVO con servicio. Esto NO es un marketplace (no hay directorio
// público en el landing); es SEO por operador: cada /book/<slug> es indexable
// bajo el dominio de LuxeRide para que la empresa aparezca en buscadores sin
// necesitar dominio propio.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  try {
    const admin = createAdminClient()
    const [{ data: companiesRaw }, { data: servicedTypes }] = await Promise.all([
      admin.from('companies').select('id, slug, updated_at').eq('status', 'active').limit(1000),
      admin.from('vehicle_types').select('company_id').eq('is_active', true),
    ])
    const servicedIds = new Set((servicedTypes ?? []).map((v) => v.company_id))
    const companies = (companiesRaw ?? []).filter((c) => servicedIds.has(c.id))

    for (const c of companies) {
      entries.push({
        url: `${BASE}/${c.slug}`, // link corto canónico del operador
        lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    }
  } catch {
    // Sin DB en build — devolvemos solo el landing
  }

  return entries
}
