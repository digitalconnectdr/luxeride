import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export const dynamic = 'force-dynamic' // locale por cookie

export default async function TermsPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.legal

  return (
    <LegalPageLayout
      title={t.terms.title}
      lastUpdated={t.terms.lastUpdated}
      intro={t.terms.intro}
      sections={t.terms.sections}
      backLabel={t.backToHome}
      locale={locale}
    />
  )
}
