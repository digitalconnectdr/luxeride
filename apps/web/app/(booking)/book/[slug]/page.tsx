import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { getAppUrl } from '@/lib/app-url'
import { BookingWizard } from './booking-wizard'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

interface Props {
  params: { slug: string }
}

// SEO por operador: cada portal /book/<slug> es indexable bajo el dominio de
// LuxeRide, con título, descripción y Open Graph propios de la empresa — así
// el operador aparece en buscadores sin necesitar dominio propio.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, city, logo_url')
    .eq('slug', params.slug)
    .single()

  if (!company) return { title: 'Reservación | LuxeRide' }

  const cityPart = company.city ? ` · ${company.city}` : ''
  const inCity = company.city ? ` en ${company.city}` : ''
  const title = `${company.name} — Reserva tu traslado de lujo${cityPart}`
  const description = `Reserva en línea con ${company.name}: traslados al aeropuerto, chofer ejecutivo y transporte premium${inCity}. Cotización al instante, pago seguro y seguimiento en vivo.`
  const url = `${getAppUrl()}/book/${params.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: company.name,
      images: company.logo_url ? [{ url: company.logo_url }] : undefined,
    },
  }
}

export default async function PublicBookingPage({ params }: Props) {
  const locale = getLocale()
  const dict = getDict(locale)
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, currency, primary_color, phone, email, stripe_connect_onboarded, settings')
    .eq('slug', params.slug)
    .single()

  if (!company || company.status !== 'active') return notFound()

  const { data: vehicleTypes } = await admin
    .from('vehicle_types')
    .select('id, name, class, capacity, amenities, base_image_url')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('sort_order')

  return (
    <BookingWizard
      company={{
        id:           company.id,
        name:         company.name,
        slug:         company.slug,
        currency:     (company.currency as string | null) ?? 'USD',
        primaryColor: (company.primary_color as string | null) ?? '#0071e3',
        phone:        (company.phone as string | null) ?? null,
        email:        (company.email as string | null) ?? null,
      }}
      vehicleTypes={(vehicleTypes ?? []).map((vt) => ({
        id:         vt.id,
        name:       vt.name,
        class:      vt.class,
        capacity:   vt.capacity,
        amenities:  vt.amenities ?? [],
        imageUrl:   vt.base_image_url ?? null,
      }))}
      onlinePaymentsEnabled={isStripeConfigured() && Boolean(company.stripe_connect_onboarded)}
      dict={dict.wizard}
      localeTag={LOCALE_TAGS[locale] ?? 'en-US'}
      gratuity={(() => {
        const g = (company.settings as {
          gratuity?: { enabled?: boolean; options?: number[]; default_percentage?: number }
          booking?: { require_deposit?: boolean }
        } | null)?.gratuity
        const requiresDeposit = Boolean(
          (company.settings as { booking?: { require_deposit?: boolean } } | null)?.booking?.require_deposit,
        )
        return {
          enabled: (g?.enabled ?? true) && !requiresDeposit,
          options: g?.options ?? [15, 18, 20, 25],
          defaultPct: g?.default_percentage ?? 20,
        }
      })()}
    />
  )
}
