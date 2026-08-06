import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import {
  updateCompanyInfoAction,
  updateBookingSettingsAction,
  updateNotificationRemindersAction,
  updateExternalReviewsAction,
  updateTrackingSettingsAction,
} from '@/app/actions/settings'
import { HourChipsField } from '@/components/admin/hour-chips-field'
import { updateDispatchWeightsAction } from '@/app/actions/dispatch-settings'
import { parseDispatchWeights } from '@/lib/dispatch/scoring'
import {
  createConnectOnboardingAction,
  refreshConnectStatusAction,
} from '@/app/actions/payments'
import {
  createWhopConnectOnboardingAction,
  refreshWhopConnectStatusAction,
  setActivePaymentProviderAction,
} from '@/app/actions/whop-connect'
import {
  createQuickBooksOnboardingAction,
  disconnectQuickBooksAction,
  setQuickBooksSyncEnabledAction,
  syncQuickBooksNowAction,
} from '@/app/actions/quickbooks'
import { isStripeConfigured } from '@/lib/stripe/server'
import { isWhopConnectConfigured } from '@/lib/whop/connect-server'
import { isQuickBooksConfigured } from '@/lib/quickbooks/server'
import { BrandingForm } from '@/components/admin/branding-form'
import { BookingLinkCard } from '@/components/admin/booking-link-card'
import { BookingWidgetCard } from '@/components/admin/booking-widget-card'
import { CoverForm } from '@/components/admin/cover-form'
import { InfoTip } from '@/components/ui/info-tip'
import { ServicesManager, type Service } from '@/components/admin/services-manager'
import { EnterpriseLeadModal } from '@/components/admin/enterprise-lead-modal'
import { ActivePaymentProviderSelect } from '@/components/admin/active-payment-provider-select'
import { CompanyBillingSection } from '@/components/admin/company-billing-section'
import { SectionTabs } from '@/components/admin/section-tabs'
import { getDict, getLocale } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import type { CompanyPlan } from '@/lib/supabase/database.types'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

// Stripe Connect requiere que el operador tenga una entidad registrada en un
// país soportado por Stripe (RD no lo es) — inviable para la mayoría de
// nuestros operadores actuales sin una LLC en EE.UU. Se oculta la tarjeta de
// Configuración para no ofrecer un camino sin salida; el código y las server
// actions de Stripe Connect quedan intactos para reactivarse cuando aplique.
const STRIPE_CONNECT_ENABLED = false

const WHOP_CHECKOUT_URLS: Record<string, string | undefined> = {
  starter: process.env.WHOP_CHECKOUT_URL_STARTER,
  professional: process.env.WHOP_CHECKOUT_URL_PROFESSIONAL,
  elite: process.env.WHOP_CHECKOUT_URL_ELITE,
  enterprise: process.env.WHOP_CHECKOUT_URL_ENTERPRISE,
}

const PLAN_LABEL: Record<CompanyPlan, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional', elite: 'Elite', enterprise: 'Enterprise',
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

const WHOP_ERRORS: Record<string, string> = {
  connect_failed: 'No se pudo iniciar el onboarding con Whop. Revisa los logs del servidor.',
  not_configured: 'Whop Connect no está configurado (falta WHOP_API_KEY o WHOP_PARENT_COMPANY_ID).',
  email_required: 'Agrega un email a tu empresa abajo antes de conectar Whop.',
  no_company: 'Tu usuario no tiene empresa asignada.',
}

const QUICKBOOKS_ERRORS: Record<string, string> = {
  connect_failed: 'No se pudo conectar con QuickBooks. Revisa los logs del servidor.',
  not_configured: 'QuickBooks no está configurado (falta QUICKBOOKS_CLIENT_ID o QUICKBOOKS_CLIENT_SECRET).',
  denied: 'Cancelaste la conexión en la pantalla de QuickBooks.',
  invalid_state: 'La sesión de conexión expiró o no es válida. Intenta de nuevo.',
  no_company: 'Tu usuario no tiene empresa asignada.',
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: {
    stripe_error?: string
    connect?: string
    whop_error?: string
    whop_connect?: string
    quickbooks_error?: string
    quickbooks?: string
  }
}) {
  const user = await requireRole('company_owner')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, slug, phone, email, address, city, country, timezone, currency, settings, stripe_connect_account_id, stripe_connect_onboarded, whop_connect_company_id, whop_connect_onboarded, active_payment_provider, logo_url, primary_color, tagline, hero_image_url, about, status, plan, subscription_ends_at, whop_membership_id, whop_billing_member_id, quickbooks_realm_id, quickbooks_connected_at, quickbooks_sync_enabled, quickbooks_last_synced_at, google_place_id, tripadvisor_url')
    .eq('id', user.company_id)
    .single()

  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: extraChargesRaw } = await admin
    .from('company_extra_charges')
    .select('id, label, amount_cents, currency, frequency_months, next_charge_date, active')
    .eq('company_id', user.company_id)
    .eq('active', true)
    .order('created_at', { ascending: false })

  const { data: planQuotasRaw } = await admin.from('plan_quotas').select('plan, monthly_price')
  const priceByPlan = Object.fromEntries((planQuotasRaw ?? []).map((p) => [p.plan, p.monthly_price])) as Record<string, number | null>

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
      operating_hours_start?: string | null
      operating_hours_end?: string | null
      blackout_dates?: string[]
    }
    notificationReminders?: {
      passengerMinutes?: number[]
      driverMinutes?: number[]
    }
    tracking?: {
      ga_measurement_id?: string | null
      ads_conversion_id?: string | null
      ads_conversion_label?: string | null
    }
  }) ?? {}

  const booking  = settings.booking  ?? {}
  const reminders = settings.notificationReminders ?? {}
  const tracking = settings.tracking ?? {}

  // void casts — TypeScript void-callback rule
  const infoAction:     (fd: FormData) => void = updateCompanyInfoAction
  const bookingAction:  (fd: FormData) => void = updateBookingSettingsAction
  const remindersAction: (fd: FormData) => void = updateNotificationRemindersAction
  const externalReviewsAction: (fd: FormData) => void = updateExternalReviewsAction
  const trackingAction: (fd: FormData) => void = updateTrackingSettingsAction
  const dispatchWeightsAction: (fd: FormData) => void = updateDispatchWeightsAction
  const dispatchWeights = parseDispatchWeights((company.settings as Record<string, unknown> | null)?.dispatch_weights)
  const connectAction:  () => void = createConnectOnboardingAction
  const refreshAction:  () => void = refreshConnectStatusAction
  const whopConnectAction: () => void = createWhopConnectOnboardingAction
  const whopRefreshAction: () => void = refreshWhopConnectStatusAction
  const quickbooksConnectAction: () => void = createQuickBooksOnboardingAction
  const quickbooksDisconnectAction: () => void = disconnectQuickBooksAction
  const quickbooksSyncNowAction: () => void = syncQuickBooksNowAction
  const enableQuickBooksSyncAction: () => void = setQuickBooksSyncEnabledAction.bind(null, true)
  const disableQuickBooksSyncAction: () => void = setQuickBooksSyncEnabledAction.bind(null, false)

  const stripeReady = isStripeConfigured()
  const hasConnect  = Boolean(company.stripe_connect_account_id)
  const onboarded   = Boolean(company.stripe_connect_onboarded)

  const whopConnectReady = isWhopConnectConfigured()
  const hasWhopConnect   = Boolean(company.whop_connect_company_id)
  const whopOnboarded    = Boolean(company.whop_connect_onboarded)
  const activeProvider   = company.active_payment_provider

  const quickbooksReady        = isQuickBooksConfigured()
  const hasQuickBooks          = Boolean(company.quickbooks_realm_id)
  const quickbooksSyncEnabled  = Boolean(company.quickbooks_sync_enabled)
  const adminDict = getDict().admin
  const t = adminDict.settings
  const actions = adminDict.actions
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  const SUBSCRIPTION_STATUS_STYLE: Record<string, { dot: string; badge: string }> = {
    active:    { dot: 'bg-green-500',           badge: 'text-green-700 border-green-200 bg-green-50' },
    trial:     { dot: 'bg-blue-500',            badge: 'text-blue-700 border-blue-200 bg-blue-50' },
    suspended: { dot: 'bg-amber-500',           badge: 'text-amber-700 border-amber-200 bg-amber-50' },
    cancelled: { dot: 'bg-sl-on-surface-muted', badge: 'text-sl-on-surface-muted border-sl-outline-variant bg-sl-bg' },
  }
  const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
    active: t.subscriptionStatusActive,
    trial: t.subscriptionStatusTrial,
    suspended: t.subscriptionStatusSuspended,
    cancelled: t.subscriptionStatusCancelled,
  }
  const statusStyle = SUBSCRIPTION_STATUS_STYLE[company.status] ?? SUBSCRIPTION_STATUS_STYLE.cancelled
  const subscriptionEndsAt = company.subscription_ends_at ? new Date(company.subscription_ends_at) : null
  const isExpired = !!subscriptionEndsAt && subscriptionEndsAt < new Date()
  const needsCheckout = company.status !== 'active' || isExpired
  const checkoutPlans = (['starter', 'professional', 'elite', 'enterprise'] as const)
    .map((plan) => ({ plan, url: WHOP_CHECKOUT_URLS[plan] }))
    .filter((p): p is { plan: typeof p.plan; url: string } => !!p.url)

  // ── Paneles por pestaña ─────────────────────────────────────────────────
  // Antes eran 14 secciones seguidas en un solo scroll de mil lineas, donde
  // convivian el logo de la empresa, QuickBooks y los pesos del dispatch.

  const companyPanel = (
    <>
    {/* ── Company Information ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
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

    {/* ── Suscripción a la plataforma (Whop) ── */}
    <section id="subscription" className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-sl-on-surface">{t.subscriptionTitle}</h2>
          <p className="mt-1.5 text-xs text-sl-on-surface-muted">
            {t.subscriptionPlan} <span className="font-medium text-sl-on-surface">{PLAN_LABEL[company.plan] ?? company.plan}</span>
            {company.whop_membership_id && <span> · {t.subscriptionViaWhop}</span>}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusStyle.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
          {SUBSCRIPTION_STATUS_LABEL[company.status] ?? company.status}
        </span>
      </div>

      <p className="mt-3 text-xs text-sl-on-surface-muted">
        {subscriptionEndsAt
          ? (isExpired ? t.subscriptionExpiredOn : t.subscriptionRenewsOn).replace(
              '{date}',
              subscriptionEndsAt.toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' }),
            )
          : t.subscriptionNoDate}
      </p>

      {needsCheckout && (
        <div className="mt-5 pt-5 border-t border-sl-outline-variant">
          <p className="text-xs font-medium text-sl-on-surface mb-3">{t.subscriptionChoosePlan}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {checkoutPlans.map(({ plan, url }) => {
              const price = priceByPlan[plan]
              return (
                <a
                  key={plan}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 rounded-xl border border-sl-outline-variant bg-sl-bg px-4 py-3.5 hover:border-bronze hover:bg-gold/15 hover:shadow-sm transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-sl-on-surface">{PLAN_LABEL[plan]}</p>
                    {price != null && (
                      <p className="text-xs text-sl-on-surface-muted mt-0.5">${Number(price).toFixed(0)}/mes</p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-bronze group-hover:text-bronze/80 shrink-0">
                    {t.subscriptionSubscribe} →
                  </span>
                </a>
              )
            })}

            {/* Enterprise — venta consultiva, sin checkout: abre un modal de solicitud */}
            <div className="group flex items-center justify-between gap-3 rounded-xl border border-sl-outline-variant bg-sl-bg px-4 py-3.5 hover:border-bronze hover:bg-gold/15 hover:shadow-sm transition-colors">
              <div>
                <p className="text-sm font-semibold text-sl-on-surface">{t.enterprisePlanName}</p>
                <p className="text-xs text-sl-on-surface-muted mt-0.5">{t.enterpriseCustomPricing}</p>
              </div>
              <EnterpriseLeadModal
                defaultCompanyName={company.name}
                defaultEmail={company.email ?? undefined}
                benefits={[t.enterpriseBenefit1, t.enterpriseBenefit2, t.enterpriseBenefit3, t.enterpriseBenefit4]}
                labels={{
                  requestButton: t.enterpriseRequest,
                  modalTitle: t.enterpriseModalTitle,
                  modalDesc: t.enterpriseModalDesc,
                  companyName: t.enterpriseCompanyName,
                  contactName: t.enterpriseContactName,
                  email: t.enterpriseEmail,
                  phone: t.enterprisePhone,
                  fleetSize: t.enterpriseFleetSize,
                  message: t.enterpriseMessage,
                  submit: t.enterpriseSubmit,
                  submitting: t.enterpriseSubmitting,
                  success: t.enterpriseSuccess,
                  cancel: t.enterpriseCancel,
                  close: t.enterpriseClose,
                }}
              />
            </div>
          </div>

          {checkoutPlans.length > 0 && (
            company.email ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3.5 py-2.5">
                <span className="w-4 h-4 mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full border border-amber-400 text-amber-600 text-[9px] font-bold">i</span>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  {t.subscriptionEmailHint.replace('{email}', company.email)}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5">
                <span className="w-4 h-4 mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full border border-red-400 text-red-600 text-[9px] font-bold">i</span>
                <p className="text-[11px] leading-relaxed text-red-700">
                  {t.subscriptionEmailMissing}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </section>

    {/* ── Facturación adicional (cargos aparte del plan, ej. hosting de dominio) ── */}
    {(extraChargesRaw ?? []).length > 0 || company.whop_billing_member_id ? (
      <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
        <CompanyBillingSection
          cardSaved={Boolean(company.whop_billing_member_id)}
          charges={(extraChargesRaw ?? []).map((c) => ({
            id: c.id,
            label: c.label,
            amountCents: c.amount_cents,
            currency: c.currency,
            frequencyMonths: c.frequency_months,
            nextChargeDate: c.next_charge_date,
            active: c.active,
          }))}
          t={t}
        />
      </section>
    ) : null}
    </>
  )

  const brandPanel = (
    <>
    {/* ── Brand / White-label ── */}
    {/* El checklist de onboarding enlaza a #branding — el ancla no existía y
        el enlace no llevaba a ninguna parte. */}
    <div id="branding" className="scroll-mt-6">
      <BrandingForm
        t={t}
        currentLogo={company.logo_url ?? null}
        currentColor={company.primary_color ?? '#e9c176'}
      />
    </div>

    {/* ── Reseñas en Google / TripAdvisor ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.externalReviewsTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{t.externalReviewsIntro}</p>
      <form action={externalReviewsAction} className="space-y-4">
        <div>
          <label className={labelCls}>{t.googlePlaceIdLabel}<InfoTip text={t.googlePlaceIdInfo} /></label>
          <input
            name="google_place_id"
            defaultValue={company.google_place_id ?? ''}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.googlePlaceIdHint}</p>
        </div>
        <div>
          <label className={labelCls}>{t.tripadvisorUrlLabel}</label>
          <input
            name="tripadvisor_url"
            type="url"
            defaultValue={company.tripadvisor_url ?? ''}
            placeholder="https://www.tripadvisor.com/..."
            className={inputCls}
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.tripadvisorUrlHint}</p>
        </div>
        {/* El operador necesita saber por qué NO puede filtrar por nota, o lo
            pedirá como "mejora" y le costará el listado. */}
        <p className="text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 max-w-[75ch]">
          {t.externalReviewsPolicy}
        </p>
        <div className="flex justify-end pt-1">
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
            {t.saveExternalReviews}
          </button>
        </div>
      </form>
    </section>

    {/* ── Portada / Microsite ── */}
    <CoverForm
      t={t}
      tagline={company.tagline ?? null}
      about={company.about ?? null}
      i18nContent={((company.settings as { site?: { i18n?: Record<string, { tagline?: string | null; about?: string | null }> } } | null)?.site)?.i18n ?? null}
      heroImage={company.hero_image_url ?? null}
      whatsapp={((company.settings as { site?: { whatsapp?: string } } | null)?.site)?.whatsapp ?? null}
      template={((company.settings as { site?: { template?: string } } | null)?.site)?.template ?? 'noir'}
    />

    {/* ── Servicios del microsite ── */}
    <ServicesManager t={t} actions={actions} services={services} />

    {/* ── Link de reservas del operador ── */}
    {company.slug && (
      <BookingLinkCard t={t} url={`${getAppUrl()}/book/${company.slug}`} />
    )}

    {/* ── Widget embebible para el sitio del operador ── */}
    {company.slug && (
      <BookingWidgetCard t={t} embedUrl={`${getAppUrl()}/embed/${company.slug}`} />
    )}
    </>
  )

  const operationsPanel = (
    <>
    {/* ── Booking Settings ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
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
        </div>

        <div className="pt-2 border-t border-sl-outline-variant space-y-1">
          <p className="text-xs font-semibold text-sl-on-surface">{t.operatingHoursTitle}</p>
          <p className="text-[11px] text-sl-on-surface-muted">{t.operatingHoursDesc}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t.operatingHoursStart}</label>
            <input
              name="operating_hours_start"
              type="time"
              defaultValue={booking.operating_hours_start ?? ''}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>{t.operatingHoursEnd}</label>
            <input
              name="operating_hours_end"
              type="time"
              defaultValue={booking.operating_hours_end ?? ''}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t.blackoutDates}</label>
          <textarea
            name="blackout_dates"
            rows={3}
            placeholder={'2026-12-25\n2026-01-01'}
            defaultValue={(booking.blackout_dates ?? []).join('\n')}
            className={`${inputCls} font-mono resize-none`}
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.blackoutDatesHint}</p>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
            {t.saveBooking}
          </button>
        </div>
      </form>
    </section>

    {/* La política de cancelación, los cargos extra en viaje, el depósito y
        las propinas se mudaron a /admin/pricing: todo lo que la empresa
        cobra se configura ahora en un solo lugar. */}

    {/* ── Recordatorios de viaje ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.remindersTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5">{t.remindersIntro}</p>
      <form action={remindersAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t.remindersPassengerLabel}</label>
            <HourChipsField
              name="passenger_minutes"
              defaultValues={reminders.passengerMinutes ?? []}
              placeholder={t.remindersPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.remindersDriverLabel}</label>
            <HourChipsField
              name="driver_minutes"
              defaultValues={reminders.driverMinutes ?? []}
              placeholder={t.remindersPlaceholder}
            />
          </div>
        </div>
        <p className="text-[11px] text-sl-on-surface-muted">{t.remindersHint}</p>
        <div className="flex justify-end pt-1">
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
            {t.saveReminders}
          </button>
        </div>
      </form>
    </section>

    {/* ── Pesos de la auto-asignacion (lib/dispatch/scoring.ts) ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.dispatchWeightsTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{t.dispatchWeightsIntro}</p>
      <form action={dispatchWeightsAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          {([
            { name: 'proximity',   label: t.dispatchWeightProximity,   hint: t.dispatchWeightProximityHint,   value: dispatchWeights.proximity },
            { name: 'fairness',    label: t.dispatchWeightFairness,    hint: t.dispatchWeightFairnessHint,    value: dispatchWeights.fairness },
            { name: 'rating',      label: t.dispatchWeightRating,      hint: t.dispatchWeightRatingHint,      value: dispatchWeights.rating },
            { name: 'reliability', label: t.dispatchWeightReliability, hint: t.dispatchWeightReliabilityHint, value: dispatchWeights.reliability },
          ]).map((w) => (
            <div key={w.name}>
              <label className={labelCls} htmlFor={`weight-${w.name}`}>{w.label}</label>
              <input
                id={`weight-${w.name}`}
                name={w.name}
                type="number"
                min="0"
                max="100"
                step="5"
                defaultValue={w.value}
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-sl-on-surface-muted">{w.hint}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-sl-on-surface-muted">{t.dispatchWeightsHint}</p>
        <div className="flex justify-end pt-1">
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
            {t.saveDispatchWeights}
          </button>
        </div>
      </form>
    </section>
    </>
  )

  const integrationsPanel = (
    <>
    {/* ── Payments / Whop Connect ── */}
    {/* #payments: mismo caso que #branding, lo enlaza el onboarding. */}
    <section id="payments" className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 scroll-mt-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.whopPaymentsTitle}</h2>

      {searchParams.whop_error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700 font-medium">
            {WHOP_ERRORS[searchParams.whop_error] ?? 'Error al conectar con Whop.'}
          </p>
        </div>
      )}
      {searchParams.whop_connect === 'return' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700 font-medium">
            {t.returnedFromWhop}
          </p>
        </div>
      )}
      <p className="text-xs text-sl-on-surface-muted mb-2">{t.whopPaymentsIntro}</p>
      <ul className="text-xs text-sl-on-surface-muted mb-5 space-y-1 list-disc pl-4">
        <li>{t.whopPaymentsBullet1}</li>
        <li>{t.whopPaymentsBullet2}</li>
      </ul>

      {!whopConnectReady ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800 font-medium">{t.whopNotReady}</p>
          <p className="text-xs text-yellow-700 mt-1">{t.whopNotReadyHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                whopOnboarded
                  ? 'bg-green-100 text-green-700'
                  : hasWhopConnect
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {whopOnboarded ? t.connected : hasWhopConnect ? t.onboardingIncomplete : t.notConnected}
            </span>
            {hasWhopConnect && (
              <span className="text-xs font-mono text-sl-on-surface-muted">
                {company.whop_connect_company_id}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            {!whopOnboarded && (
              <form action={whopConnectAction}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
                >
                  {hasWhopConnect ? t.continueWhopOnboarding : t.connectWhop}
                </button>
              </form>
            )}
            {hasWhopConnect && (
              <form action={whopRefreshAction}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
                >
                  {t.refreshStatus}
                </button>
              </form>
            )}
          </div>

          {STRIPE_CONNECT_ENABLED && onboarded && whopOnboarded && (
            <div className="pt-2 border-t border-sl-outline-variant">
              <p className="text-xs text-sl-on-surface-muted mb-2">{t.activeProviderHint}</p>
              <ActivePaymentProviderSelect
                current={activeProvider as 'stripe' | 'whop' | null}
                labels={{
                  label: t.activeProviderLabel,
                  stripe: t.activeProviderStripe,
                  whop: t.activeProviderWhop,
                  saving: t.activeProviderSaving,
                  error: '',
                }}
              />
            </div>
          )}
        </div>
      )}
    </section>

    {/* ── QuickBooks Online ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.quickbooksTitle}</h2>

      {searchParams.quickbooks_error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700 font-medium">
            {QUICKBOOKS_ERRORS[searchParams.quickbooks_error] ?? 'Error al conectar con QuickBooks.'}
          </p>
        </div>
      )}
      {searchParams.quickbooks === 'connected' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700 font-medium">{t.quickbooksConnectedBanner}</p>
        </div>
      )}
      <p className="text-xs text-sl-on-surface-muted mb-2">{t.quickbooksIntro}</p>
      <ul className="text-xs text-sl-on-surface-muted mb-5 space-y-1 list-disc pl-4">
        <li>{t.quickbooksBullet1}</li>
        <li>{t.quickbooksBullet2}</li>
      </ul>

      {!quickbooksReady ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800 font-medium">{t.quickbooksNotReady}</p>
          <p className="text-xs text-yellow-700 mt-1">{t.quickbooksNotReadyHint}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                hasQuickBooks ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {hasQuickBooks ? t.connected : t.notConnected}
            </span>
            {hasQuickBooks && (
              <span className="text-xs font-mono text-sl-on-surface-muted">
                {company.quickbooks_realm_id}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!hasQuickBooks && (
              <form action={quickbooksConnectAction}>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
                >
                  {t.connectQuickBooks}
                </button>
              </form>
            )}
            {hasQuickBooks && (
              <>
                <form action={quickbooksSyncEnabled ? disableQuickBooksSyncAction : enableQuickBooksSyncAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
                  >
                    {quickbooksSyncEnabled ? t.disableQuickBooksSync : t.enableQuickBooksSync}
                  </button>
                </form>
                <form action={quickbooksSyncNowAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
                  >
                    {t.syncQuickBooksNow}
                  </button>
                </form>
                <form action={quickbooksDisconnectAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    {t.disconnectQuickBooks}
                  </button>
                </form>
              </>
            )}
          </div>

          {hasQuickBooks && company.quickbooks_last_synced_at && (
            <p className="text-xs text-sl-on-surface-muted">
              {t.quickbooksLastSynced}{' '}
              {new Date(company.quickbooks_last_synced_at).toLocaleString(localeTag)}
            </p>
          )}
        </div>
      )}
    </section>

    {/* ── Payments / Stripe Connect (oculto — ver STRIPE_CONNECT_ENABLED) ── */}
    {STRIPE_CONNECT_ENABLED && (
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
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
    )}

    {/* ── Google Ads: conversion tracking ── */}
    <section className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6">
      <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.gaTrackingTitle}</h2>
      <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{t.gaTrackingIntro}</p>
      <form action={trackingAction} className="space-y-4">
        <div>
          <label className={labelCls}>{t.gaMeasurementIdLabel}<InfoTip text={t.gaMeasurementIdInfo} /></label>
          <input
            name="ga_measurement_id"
            defaultValue={tracking.ga_measurement_id ?? ''}
            placeholder="G-XXXXXXXXXX"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[11px] text-sl-on-surface-muted mt-1">{t.gaMeasurementIdHint}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t.adsConversionIdLabel}<InfoTip text={t.adsConversionIdInfo} /></label>
            <input
              name="ads_conversion_id"
              defaultValue={tracking.ads_conversion_id ?? ''}
              placeholder="AW-XXXXXXXXX"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>{t.adsConversionLabelLabel}</label>
            <input
              name="ads_conversion_label"
              defaultValue={tracking.ads_conversion_label ?? ''}
              placeholder="AbCdEfGhIjK123"
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
        <p className="text-[11px] text-sl-on-surface-muted -mt-2">{t.adsConversionHint}</p>
        <div className="flex justify-end pt-1">
          <button type="submit" className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors">
            {t.saveTracking}
          </button>
        </div>
      </form>
    </section>
    </>
  )

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">

      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <SectionTabs
        ariaLabel={t.title}
        tabs={[
          { key: 'company',      label: t.tabCompany,      anchors: ['subscription'] },
          { key: 'brand',        label: t.tabBrand,        anchors: ['branding'] },
          { key: 'operations',   label: t.tabOperations },
          { key: 'integrations', label: t.tabIntegrations, anchors: ['payments'] },
        ]}
        panels={{
          company:      companyPanel,
          brand:        brandPanel,
          operations:   operationsPanel,
          integrations: integrationsPanel,
        }}
      />
    </div>
  )
}
