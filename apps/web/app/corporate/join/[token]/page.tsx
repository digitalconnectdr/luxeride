import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getCorporateInvitePreviewAction } from '@/app/actions/corporate'
import { JoinCorporateMemberForm } from '@/components/corporate/join-corporate-member-form'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'

// ── Onboarding por link — alta de miembro corporativo ──────────────────────────
// Página PÚBLICA (sin sesión): el token de la URL es la única autorización,
// mismo patrón capability-URL que /affiliate/join/[token] y /track/[id].

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const preview = await getCorporateInvitePreviewAction(params.token)
  const t = getDict().corporate.join
  return { title: t.pageTitle.replace('{account}', preview?.accountName ?? '') }
}

export default async function CorporateJoinPage({ params }: { params: { token: string } }) {
  const locale = getLocale()
  const t = getDict(locale).corporate.join
  const preview = await getCorporateInvitePreviewAction(params.token)

  return (
    <div className="min-h-screen bg-sl-bg flex items-center justify-center p-4 py-8">
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher current={locale} variant="light" />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">
            {preview?.valid ? t.pageTitle.replace('{account}', preview.accountName) : t.invalidTitle}
          </h1>
          {preview?.valid && (
            <p className="text-sl-on-surface-muted text-sm">
              {t.invitedTo} <span className="font-medium text-bronze">{preview.accountName}</span>
              {preview.companyName !== '—' && ` (${preview.companyName})`}
            </p>
          )}
        </div>

        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
          {!preview?.valid ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-sl-on-surface-muted">{t.invalidBody}</p>
            </div>
          ) : (
            <JoinCorporateMemberForm token={params.token} preview={preview} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}
