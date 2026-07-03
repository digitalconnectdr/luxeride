import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import {
  updateCompanyInfoAction,
  updateBookingSettingsAction,
  updateGratuitySettingsAction,
  updatePolicySettingsAction,
} from '@/app/actions/settings'
import { parsePolicy } from '@/lib/policy/engine'
import {
  createConnectOnboardingAction,
  refreshConnectStatusAction,
} from '@/app/actions/payments'
import { isStripeConfigured } from '@/lib/stripe/server'
import { BrandingForm } from '@/components/admin/branding-form'
import { BookingLinkCard } from '@/components/admin/booking-link-card'
import { BookingWidgetCard } from '@/components/admin/booking-widget-card'
import { CoverForm } from '@/components/admin/cover-form'
import { ServicesManager, type Service } from '@/components/admin/services-manager'
import { getDict, getLocale } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

const WHOP_CHECKOUT_URLS: Record<string, string | undefined> = {
  starter: process.env.WHOP_CHECKOUT_URL_STARTER,
  professional: process.env.WHOP_CHECKOUT_URL_PROFESSIONAL,
  enterprise: process.env.WHOP_CHECKOUT_URL_ENTERPRISE,
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Santo_Domingo', 'America/Puerto_Rico', 'Europe/London', 'Europe/Madrid',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'DOP', 'MXN', 'COP', 'ARS', 'BRL']

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'MX', name: 'Mexico' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'ES', name: 'Spain' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
]

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

const STRIPE_ERRORS: Record<string, string> = {
  connect_failed: 'No se pudo iniciar el onboarding con Stripe. Revisa los logs del servidor.',
  connect_not_enabled:
    'Tu cuenta de Stripe no tiene Connect habilitado. Actívalo en dashboard.stripe.com → Connect.',
  invalid_key: 'La API key de Stripe es inválida. Verifica STRIPE_SECRET_KEY en Vercel.',
  not_configured: 'Stripe no está configurado (la key actual es un placeholder).',
  no_company: 'Tu usuario no tiene empresa asignada.',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { stripe_error?: string; connect?: string }
}) {
  const user = await requireRole('company_owner')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, slug, phone, email, address, city, country, timezone, currency, settings, stripe_connect_account_id, stripe_connect_onboarded, logo_url, primary_color, tagline, hero_image_url, about, status, plan, subscription_ends_at, whop_membership_id')
    .eq('id', user.company_id)
    .single()

  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: servicesRaw } = await admin
    .from('company_services')
    .select('id, title, description, icon, is_active, i18n')
    .eq('company_id', user.company_id)
    .order('sort_order')
  const services = (servicesRaw ?? []) as Service[]

  const settings = (company.settings as {
    booking?: {
      advance_booking_hours?: number
      max_advance_days?: number
      allow_instant_booking?: boolean
      require_deposit?: boolean
      deposit_percentage?: number
    }
    gratuity?: {
      enabled?: boolean
      default_percentage?: number
    }
  }) ?? {}

  const booking  = settings.booking  ?? {}
  const gratuity = settings.gratuity ?? {}

  // void casts — TypeScript void-callback rule
  const infoAction:     (fd: FormData) => void = updateCompanyInfoAction
  const bookingAction:  (fd: FormData) => void = updateBookingSettingsAction
  const gratuityAction: (fd: FormData) => void = updateGratuitySettingsAction
  const connectAction:  () => void = createConnectOnboardingAction
  const refreshAction:  () => void = refreshConnectStatusAction
  const policyAction:   (fd: FormData) => void = updatePolicySettingsAction

  const policy = parsePolicy(company.settings)

  const stripeReady = isStripeConfigured()
  const hasConnect  = Boolean(company.stripe_connect_account_id)
  const onboarded   = Boolean(company.stripe_connect_onboarded)
  const adminDict = getDict().admin
  const t = adminDict.settings
  const actions = adminDict.actions
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  const SUBSCRIPTION_STATUS_BADGE: Record<string, string> = {
    active:    'bg-green-100 text-green-700',
    trial:     'bg-blue-100 text-blue-700',
    suspended: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-gray-100 text-gray-600',
  }
  const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
    active: t.subscriptionStatusActive,
    trial: t.subscriptionStatusTrial,
    suspended: t.subscriptionStatusSuspended,
    cancelled: t.subscriptionStatusCancelled,
  }
  const subscriptionEndsAt = company.subscription_ends_at ? new Date(company.subscription_ends_at) : null
  const isExpired = !!subscriptionEndsAt && subscriptionEndsAt < new Date()
  const needsCheckout = company.status !== 'active' || isExpired
  const checkoutPlans = (['starter', 'professional', 'enterprise'] as const)
    .map((plan) => ({ plan, url: WHOP_CHECKOUT_URLS[plan] }))
    .filter((p): p is { plan: typeof p.plan; url: string } => !!p.url)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">

      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      {/* ── Suscripción a la plataforma (Whop) ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-3">{t.subscriptionTitle}</h2>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUBSCRIPTION_STATUS_BADGE[company.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {SUBSCRIPTION_STATUS_LABEL[company.status] ?? company.status}
          </span>
          <span className="text-xs text-sl-on-surface-muted">
            {t.subscriptionPlan}: <span className="font-medium text-sl-on-surface capitalize">{company.plan}</span>
          </span>
          {company.whop_membership_id && (
            <span className="text-[11px] text-sl-on-surface-muted">({t.subscriptionViaWhop})</span>
          )}
        </div>
        <p className="text-xs text-sl-on-surface-muted mb-4">
          {subscriptionEndsAt
            ? (isExpired ? t.subscriptionExpiredOn : t.subscriptionRenewsOn).replace(
                '{date}',
                subscriptionEndsAt.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' }),
              )
            : t.subscriptionNoDate}
        </p>
        {needsCheckout && checkoutPlans.length > 0 && (
          <div>
            <p className="text-xs text-sl-on-surface-muted mb-2">{t.subscriptionChoosePlan}</p>
            <div className="flex flex-wrap gap-3">
              {checkoutPlans.map(({ plan, url }) => (
                <a
                  key={plan}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors capitalize"
                >
                  {t.subscriptionSubscribe} — {plan}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Link de reservas del operador ── */}
      {company.slug && (
        <BookingLinkCard t={t} url={`${getAppUrl()}/book/${company.slug}`} />
      )}

      {/* ── Widget embebible para el sitio del operador ── */}
      {company.slug && (
        <BookingWidgetCard t={t} embedUrl={`${getAppUrl()}/embed/${company.slug}`} />
      )}

      {/* ── Company Information ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-5">{t.companyInfo}</h2>
        <form action={infoAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>{t.companyName} *</label>
              <input name="name" required defaultValue={company.name} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.phone}</label>
              <input name="phone" type="tel" defaultValue={company.phone ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.email}</label>
              <input name="email" type="email" defaultValue={company.email ?? ''} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{t.address}</label>
              <input name="address" defaultValue={company.address ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.city}</label>
              <input name="city" defaultValue={company.city ?? ''} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t.country}</label>
              <select name="country" defaultValue={company.country ?? 'US'} className={inputCls}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.timezone}</label>
              <select name="timezone" defaultValue={company.timezone ?? 'America/New_York'} className={inputCls}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.currency}</label>
              <select name="currency" defaultValue={company.currency ?? 'USD'} className={inputCls}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
              {t.saveChanges}
            </button>
          </div>
        </form>
      </section>

      {/* ── Brand / White-label ── */}
      <BrandingForm
        t={t}
        currentLogo={company.logo_url ?? null}
        currentColor={company.primary_color ?? '#e9c176'}
      />

      {/* ── Portada / Microsite ── */}
      <CoverForm
        t={t}
        tagline={company.tagline ?? null}
        about={company.about ?? null}
        i18nContent={((company.settings as { site?: { i18n?: Record<string, { tagline?: string | null; about?: string | null }> } } | null)?.site)?.i18n ?? null}
        heroImage={company.hero_image_url ?? null}
        whatsapp={((company.settings as { site?: { whatsapp?: string } } | null)?.site)?.whatsapp ?? null}
        placeId={((company.settings as { site?: { googlePlaceId?: string } } | null)?.site)?.googlePlaceId ?? null}
        template={((company.settings as { site?: { template?: string } } | null)?.site)?.template ?? 'noir'}
      />

      {/* ── Servicios del microsite ── */}
      <ServicesManager t={t} actions={actions} services={services} />

      {/* ── Booking Settings ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-5">{t.bookingSettings}</h2>
        <form action={bookingAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.minAdvance}</label>
              <input
                name="advance_booking_hours"
                type="number"
                min="0"
                defaultValue={booking.advance_booking_hours ?? 2}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.maxAdvance}</label>
              <input
                name="max_advance_days"
                type="number"
                min="1"
                defaultValue={booking.max_advance_days ?? 90}
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                name="allow_instant_booking"
                type="checkbox"
                value="true"
                defaultChecked={booking.allow_instant_booking ?? true}
                className="w-4 h-4 rounded accent-bronze"
              />
              <span className="text-sm text-sl-on-surface">{t.allowInstant}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                name="require_deposit"
                type="checkbox"
                value="true"
                defaultChecked={booking.require_deposit ?? false}
                className="w-4 h-4 rounded accent-bronze"
              />
              <span className="text-sm text-sl-on-surface">{t.requireDeposit}</span>
            </label>
          </div>

          {booking.require_deposit && (
            <div className="w-48">
              <label className={labelCls}>{t.depositPct}</label>
              <input
                name="deposit_percentage"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={booking.deposit_percentage ?? 0}
                className={inputCls}
              />
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
              {t.saveBooking}
            </button>
          </div>
        </form>
      </section>

      {/* ── Cancellation Policy (F1.10) ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.policyTitle}</h2>
        <p className="text-xs text-sl-on-surface-muted mb-5">
          {t.policyDesc}
        </p>
        <form action={policyAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t.freeCancelHours}</label>
              <input
                name="free_cancellation_hours"
                type="number"
                min="0"
                step="1"
                defaultValue={policy.free_cancellation_hours}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.lateCancelPct}</label>
              <input
                name="late_cancellation_fee_pct"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.late_cancellation_fee_pct}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.noShowPct}</label>
              <input
                name="no_show_fee_pct"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.no_show_fee_pct}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{t.modificationHours}</label>
              <input
                name="modification_min_hours"
                type="number"
                min="0"
                step="1"
                defaultValue={policy.modification_min_hours}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
              {t.savePolicy}
            </button>
          </div>
        </form>
      </section>

      {/* ── Payments / Stripe Connect ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.paymentsTitle}</h2>

        {searchParams.stripe_error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-medium">
              {STRIPE_ERRORS[searchParams.stripe_error] ?? 'Error al conectar con Stripe.'}
            </p>
          </div>
        )}
        {searchParams.connect === 'return' && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <p className="text-sm text-green-700 font-medium">
              {t.returnedFromStripe}
            </p>
          </div>
        )}
        <p className="text-xs text-sl-on-surface-muted mb-2">{t.paymentsIntro}</p>
        <ul className="text-xs text-sl-on-surface-muted mb-5 space-y-1 list-disc pl-4">
          <li>{t.paymentsBullet1}</li>
          <li>{t.paymentsBullet2}</li>
          <li>{t.paymentsBullet3}</li>
        </ul>

        {!stripeReady ? (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
            <p className="text-sm text-yellow-800 font-medium">{t.stripeNotReady}</p>
            <p className="text-xs text-yellow-700 mt-1">{t.stripeNotReadyHint}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  onboarded
                    ? 'bg-green-100 text-green-700'
                    : hasConnect
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {onboarded ? t.connected : hasConnect ? t.onboardingIncomplete : t.notConnected}
              </span>
              {hasConnect && (
                <span className="text-xs font-mono text-sl-on-surface-muted">
                  {company.stripe_connect_account_id}
                </span>
              )}
            </div>

            <div className="flex gap-3">
              {!onboarded && (
                <form action={connectAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
                  >
                    {hasConnect ? t.continueOnboarding : t.connectStripe}
                  </button>
                </form>
              )}
              {hasConnect && (
                <form action={refreshAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
                  >
                    {t.refreshStatus}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Gratuity Settings ── */}
      <section className="bg-sl-surface border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-5">{t.gratuityTitle}</h2>
        <form action={gratuityAction} className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              name="enabled"
              type="checkbox"
              value="true"
              defaultChecked={gratuity.enabled ?? true}
              className="w-4 h-4 rounded accent-bronze"
            />
            <span className="text-sm text-sl-on-surface">{t.gratuityEnable}</span>
          </label>
          <div className="w-48">
            <label className={labelCls}>{t.gratuityDefault}</label>
            <input
              name="default_percentage"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={gratuity.default_percentage ?? 20}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
              {t.saveGratuity}
            </button>
          </div>
        </form>
      </section>

    </div>
  )
}
