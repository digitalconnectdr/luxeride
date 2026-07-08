import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export const dynamic = 'force-dynamic' // locale por cookie

export default async function PrivacyPage() {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.legal

  return (
    <LegalPageLayout
      title={t.privacy.title}
      lastUpdated={t.privacy.lastUpdated}
      intro={t.privacy.intro}
      sections={t.privacy.sections}
      backLabel={t.backToHome}
      locale={locale}
    />
  )
}
