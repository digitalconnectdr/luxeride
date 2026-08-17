import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { MoneyPageLayout } from '@/components/marketing/money-page-layout'

const SLUG = '/compare/ride-hailing-apps'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).comparePages.rideHailingApps
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

export default function RideHailingAppsComparePage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.comparePages.rideHailingApps
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
    { label: dict.moneyPages.limoSoftware.breadcrumbLabel, href: '/limo-software' },
    { label: dict.pricingPage.breadcrumbLabel, href: '/pricing' },
    { label: dict.referralProgramPage.breadcrumbLabel, href: '/referral-program' },
    {
      label: dict.solutionPages.hotelAndEventPartnerships.breadcrumbLabel,
      href: '/solutions/hotel-and-event-partnerships',
    },
  ]

  return (
    <MoneyPageLayout locale={locale} content={content} relatedLinks={relatedLinks} structuredData={structuredData} />
  )
}
