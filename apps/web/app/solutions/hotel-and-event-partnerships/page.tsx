import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { MoneyPageLayout } from '@/components/marketing/money-page-layout'

const SLUG = '/solutions/hotel-and-event-partnerships'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).solutionPages.hotelAndEventPartnerships
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

export default function HotelAndEventPartnershipsSolutionPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.solutionPages.hotelAndEventPartnerships
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
    { label: dict.moneyPages.blackCarSoftware.breadcrumbLabel, href: '/black-car-software' },
    { label: dict.featurePages.corporateAccounts.breadcrumbLabel, href: '/features/corporate-accounts' },
    {
      label: dict.solutionPages.affiliateOverflowNetwork.breadcrumbLabel,
      href: '/solutions/affiliate-overflow-network',
    },
    { label: dict.pricingPage.breadcrumbLabel, href: '/pricing' },
  ]

  return (
    <MoneyPageLayout locale={locale} content={content} relatedLinks={relatedLinks} structuredData={structuredData} />
  )
}
