import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { ResourceCenterLayout } from '@/components/marketing/resource-center-layout'
import { CalculatorPageBody } from '@/components/marketing/calculators/calculator-page-body'
import { AirportTransferPricingCalculator } from '@/components/marketing/calculators/airport-transfer-pricing-calculator'

const SLUG = '/resources/airport-transfer-pricing-calculator'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).resourceCenter.airportTransferPricingCalculator
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

export default function AirportTransferPricingCalculatorPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.resourceCenter.airportTransferPricingCalculator
  const baseUrl = getAppUrl()

  const structuredData = buildMoneyPageStructuredData({
    baseUrl,
    pagePath: SLUG,
    pageTitle: content.metaTitle,
    pageDescription: content.metaDescription,
    breadcrumbItems: [
      { name: brand.name, path: '/' },
      { name: dict.resourceCenter.index.breadcrumbLabel, path: '/resources' },
      { name: content.breadcrumbLabel, path: SLUG },
    ],
    faq: content.faq,
  })

  const relatedLinks = [
    { label: dict.moneyPages.airportTransferSoftware.breadcrumbLabel, href: '/airport-transfer-software' },
    { label: dict.featurePages.bookingEngine.breadcrumbLabel, href: '/features/booking-engine' },
    { label: dict.resourceCenter.limoSoftwareCostCalculator.breadcrumbLabel, href: '/resources/limo-software-cost-calculator' },
  ]

  return (
    <ResourceCenterLayout locale={locale} breadcrumbLabel={content.breadcrumbLabel} structuredData={structuredData}>
      <CalculatorPageBody
        content={content}
        calculator={<AirportTransferPricingCalculator t={content} />}
        relatedLinks={relatedLinks}
      />
    </ResourceCenterLayout>
  )
}
