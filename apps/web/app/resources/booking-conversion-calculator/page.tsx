import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { brand } from '@/lib/brand'
import { buildMoneyPageStructuredData } from '@/lib/seo/structured-data'
import { ResourceCenterLayout } from '@/components/marketing/resource-center-layout'
import { CalculatorPageBody } from '@/components/marketing/calculators/calculator-page-body'
import { BookingConversionCalculator } from '@/components/marketing/calculators/booking-conversion-calculator'

const SLUG = '/resources/booking-conversion-calculator'

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict(getLocale()).resourceCenter.bookingConversionCalculator
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

export default function BookingConversionCalculatorPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const content = dict.resourceCenter.bookingConversionCalculator
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
    { label: dict.featurePages.bookingEngine.breadcrumbLabel, href: '/features/booking-engine' },
    { label: dict.moneyPages.limoBookingSoftware.breadcrumbLabel, href: '/limo-booking-software' },
    { label: dict.comparePages.phoneBooking.breadcrumbLabel, href: '/compare/phone-booking' },
  ]

  return (
    <ResourceCenterLayout locale={locale} breadcrumbLabel={content.breadcrumbLabel} structuredData={structuredData}>
      <CalculatorPageBody
        content={content}
        calculator={<BookingConversionCalculator t={content} />}
        relatedLinks={relatedLinks}
      />
    </ResourceCenterLayout>
  )
}
