import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAffiliateInvitePreviewAction } from '@/app/actions/affiliates'
import { JoinExternalAffiliateForm } from '@/components/affiliate/join-external-affiliate-form'

// ── Sección G, Fase 2 — Alta de afiliado externo ───────────────────────────────
// Página PÚBLICA (sin sesión): el token de la URL es la única autorización,
// mismo patrón capability-URL que /track/[id] — no adivinable (UUID).

export function generateMetadata(): Metadata {
  return { title: getDict().affiliates.join.pageTitle }
}

export default async function AffiliateJoinPage({ params }: { params: { token: string } }) {
  const locale = getLocale()
  const t = getDict(locale).affiliates.join
  const preview = await getAffiliateInvitePreviewAction(params.token)

  return (
    <div className="min-h-screen bg-sl-bg flex items-center justify-center p-4 py-10">
      <div className={`w-full ${preview?.valid ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-8 text-center">
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface mb-2">{t.pageTitle}</h1>
          {preview?.valid && (
            <p className="text-sl-on-surface-muted text-sm">
              <span className="font-medium text-sl-on-surface">{preview.invitingCompanyName}</span> {t.invitedBy}
            </p>
          )}
        </div>

        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-8 shadow-luxury">
          {!preview?.valid ? (
            <div className="text-center space-y-2">
              <p className="font-medium text-sl-on-surface">{t.invalidTitle}</p>
              <p className="text-sm text-sl-on-surface-muted">{t.invalidBody}</p>
            </div>
          ) : (
            <JoinExternalAffiliateForm token={params.token} t={t} />
          )}
        </div>
      </div>
    </div>
  )
}
