import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { MicrositePending } from '@/components/booking/microsite-pending'
import { BookingWizard } from '../../book/[slug]/booking-wizard'

// Widget embebible: el operador incrusta este route en su propio sitio vía <iframe>.
// Renderiza SOLO el wizard de reservas (sin hero/nav), sobre fondo transparente
// para que se mezcle con el sitio anfitrión. El framing se habilita en
// next.config.mjs (frame-ancestors *, sin X-Frame-Options para /embed).
export const metadata: Metadata = {
  title: { absolute: 'Reserva' }, // white-label: sin sufijo de marca
  robots: { index: false, follow: false },
}

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export default async function EmbedBookingPage({ params }: { params: { slug: string } }) {
  const locale = getLocale()
  const dict = getDict(locale)
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, currency, primary_color, phone, email, logo_url, stripe_connect_onboarded, active_payment_provider, whop_connect_company_id, whop_connect_onboarded, settings')
    .eq('slug', params.slug)
    .single()
  if (!company) return notFound()
  if (company.status !== 'active') {
    return (
      <MicrositePending
        companyName={company.name}
        logoUrl={company.logo_url}
        brandColor={company.primary_color}
        phone={company.phone}
        email={company.email}
        t={dict.microsite}
      />
    )
  }

  const { data: vehicleTypes } = await admin
    .from('vehicle_types')
    .select('id, name, class, capacity, amenities, base_image_url, luggage_carry_on_capacity, luggage_checked_capacity, luggage_extra_large_capacity')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('sort_order')

  const fleet = vehicleTypes ?? []
  const brandColor = (company.primary_color as string | null) || '#c9a24b'

  const onlinePaymentsEnabled =
    (isStripeConfigured() && Boolean(company.stripe_connect_onboarded)) ||
    Boolean(
      company.active_payment_provider === 'whop' &&
        company.whop_connect_company_id &&
        company.whop_connect_onboarded,
    )

  const gratuity = (() => {
    const g = (company.settings as { gratuity?: { enabled?: boolean; options?: number[]; default_percentage?: number }; booking?: { require_deposit?: boolean } } | null)?.gratuity
    const requiresDeposit = Boolean((company.settings as { booking?: { require_deposit?: boolean } } | null)?.booking?.require_deposit)
    return { enabled: (g?.enabled ?? true) && !requiresDeposit, options: g?.options ?? [15, 18, 20, 25], defaultPct: g?.default_percentage ?? 20 }
  })()

  const gaMeasurementId =
    (company.settings as { tracking?: { ga_measurement_id?: string | null } } | null)?.tracking?.ga_measurement_id ?? undefined

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-3 py-4 antialiased" style={{ ['--brand' as string]: brandColor }}>
      <div className="w-full max-w-[480px]">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher current={locale} variant="dark" />
        </div>
        <div className="rounded-2xl bg-[#f1ece3] p-5 sm:p-6 shadow-2xl shadow-black/20 ring-1 ring-black/5">
          <BookingWizard
            company={{ id: company.id, name: company.name, slug: company.slug, currency: (company.currency as string | null) ?? 'USD', primaryColor: brandColor, phone: (company.phone as string | null) ?? null, email: (company.email as string | null) ?? null }}
            vehicleTypes={fleet.map((vt) => ({ id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [], imageUrl: vt.base_image_url ?? null, luggageCarryOnCapacity: vt.luggage_carry_on_capacity, luggageCheckedCapacity: vt.luggage_checked_capacity, luggageExtraLargeCapacity: vt.luggage_extra_large_capacity }))}
            onlinePaymentsEnabled={onlinePaymentsEnabled}
            dict={dict.wizard}
            localeTag={LOCALE_TAGS[locale] ?? 'en-US'}
            gratuity={gratuity}
            gaMeasurementId={gaMeasurementId}
          />
        </div>
      </div>
    </div>
  )
}
