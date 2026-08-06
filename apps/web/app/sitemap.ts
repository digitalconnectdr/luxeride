import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { SEO_EXCLUDED_SLUGS } from '@/lib/seo/excluded-slugs'

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
    // Landing por idioma (/en, /es, /pt) | ver hreflang en app/page.tsx
    {
      url: `${BASE}/en`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/es`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE}/pt`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
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
      admin.from('companies').select('id, slug, updated_at, custom_domain, custom_domain_status').eq('status', 'active').limit(1000),
      admin.from('vehicle_types').select('company_id').eq('is_active', true),
    ])
    const servicedIds = new Set((servicedTypes ?? []).map((v) => v.company_id))
    // Un operador con dominio propio verificado ya no tiene canonical de
    // plataforma (ver generateMetadata en book/[slug]/page.tsx) — listarlo aquí
    // bajo BASE contradiría esa señal, así que se excluye del sitemap de la
    // plataforma igual que SEO_EXCLUDED_SLUGS.
    const companies = (companiesRaw ?? []).filter(
      (c) => servicedIds.has(c.id) && !SEO_EXCLUDED_SLUGS.has(c.slug) && !(c.custom_domain_status === 'verified' && c.custom_domain),
    )

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
