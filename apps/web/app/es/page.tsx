import type { Metadata } from 'next'
import { getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { HREFLANG_LANGUAGES, LOCALE_PATHS } from '@/lib/seo/hreflang'
import { LandingPageContent } from '@/components/landing/landing-content'

// Página del landing con el idioma fijo en español (no depende de la cookie),
// para que Google pueda indexarla como una URL propia y citarla via hreflang.

const t = getDict('es').landing

export const metadata: Metadata = {
  title: { absolute: `${brand.name} | ${t.metaTitle} | by ${brand.poweredBy}` },
  description: t.metaDescription,
  alternates: { canonical: '/es', languages: HREFLANG_LANGUAGES },
}

export default function SpanishLandingPage() {
  return <LandingPageContent locale="es" localizedPaths={LOCALE_PATHS} />
}
