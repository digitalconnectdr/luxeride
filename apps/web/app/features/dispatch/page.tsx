import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { MoneyPageLayout } from '@/components/marketing/money-page-layout'

const SLUG = '/features/dispatch'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).featurePages.dispatch
  const baseUrl = getAppUrl()
  return {
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: { canonical: SLUG },
    openGraph: {
      title: t.metaTitle,
      description: t.metaDescription,
      url: `${baseUrl}${SLUG}`,
      type: 'website',
      siteName: brand.name,
    },
    twitter: { card: 'summary_large_image', title: t.metaTitle, description: t.metaDescription },
  }
}

export const dynamic = 'force-dynamic'

export default function DispatchFeaturePage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.featurePages.dispatch
  const baseUrl = getAppUrl()

  const structuredData = buildMoneyPageStructuredData({
    baseUrl,
    pagePath: SLUG,
    pageTitle: content.metaTitle,
    pageDescription: content.metaDescription,
    breadcrumbItems: [
      { name: brand.name, path: '/' },
      { name: content.breadcrumbLabel, path: SLUG },
    ],
    faq: content.faq,
  })

  const relatedLinks = [
    { label: dict.moneyPages.limoDispatchSoftware.breadcrumbLabel, href: '/limo-dispatch-software' },
    { label: dict.featurePages.bookingEngine.breadcrumbLabel, href: '/features/booking-engine' },
    { label: dict.featurePages.fleetManagement.breadcrumbLabel, href: '/features/fleet-management' },
  ]

  return (
    <MoneyPageLayout locale={locale} content={content} relatedLinks={relatedLinks} structuredData={structuredData} />
  )
}
