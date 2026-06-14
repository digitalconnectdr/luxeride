import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/app-url'

const BASE = getAppUrl()

// White-label: el sitemap de LuxeRide solo indexa el landing del software.
// Los portales de operadores (/book/[slug]) no son contenido SEO de LuxeRide;
// cada operador maneja su propio SEO (a futuro, con su dominio).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
