import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'

const BASE = getAppUrl()

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  // Páginas de reserva de cada empresa activa
  try {
    const admin = createAdminClient()
    const [{ data: companiesRaw }, { data: servicedTypes }] = await Promise.all([
      admin.from('companies').select('id, slug, updated_at').eq('status', 'active').limit(500),
      admin.from('vehicle_types').select('company_id').eq('is_active', true),
    ])
    const servicedIds = new Set((servicedTypes ?? []).map((v) => v.company_id))
    const companies = (companiesRaw ?? []).filter((c) => servicedIds.has(c.id))

    for (const c of companies) {
      entries.push({
        url: `${BASE}/book/${c.slug}`,
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
