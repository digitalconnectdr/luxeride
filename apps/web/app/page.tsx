import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'
import { HREFLANG_LANGUAGES } from '@/lib/seo/hreflang'
import { LandingPageContent } from '@/components/landing/landing-content'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).landing
  return {
    title: { absolute: `${brand.name} | ${t.metaTitle} | by ${brand.poweredBy}` },
    description: t.metaDescription,
    alternates: { canonical: '/', languages: HREFLANG_LANGUAGES },
  }
}

export const dynamic = 'force-dynamic' // locale por cookie

export default function LandingPage() {
  const locale = getLocale()
  return <LandingPageContent locale={locale} />
}
