import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { isStripeConfigured } from '@/lib/stripe/server'
import { getLocale, getDict } from '@/lib/i18n/server'
import { resolveLocalizedField, type SiteI18n } from '@/lib/i18n/site-content'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { MicrositePending } from '@/components/booking/microsite-pending'
import { BookingWizard } from '../../booking-wizard'

// Partner Portals — link privado co-brandeado para un socio referidor (hotel,
// FBO, wedding/event planner). Mismo wizard que /reservar, con el banner de
// co-marca y el partnerSlug threaded hasta las server actions publicas (ver
// lib/partners/engine.ts para el ajuste de tarifa y app/actions/bookings.ts).

export const metadata: Metadata = {
  title: { absolute: 'Reserva' },
  robots: { index: false, follow: true },
}

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }
const DEFAULT_HERO = 'https://unsplash.com/photos/9XVJ-Jq7Ke8/download?force=true&w=1400'

export default async function PartnerPortalPage({ params }: { params: { slug: string; partnerSlug: string } }) {
  const locale = getLocale()
  const dict = getDict(locale)
  const t = dict.microsite
  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, name, slug, status, currency, primary_color, phone, email, logo_url, tagline, hero_image_url, stripe_connect_onboarded, active_payment_provider, whop_connect_company_id, whop_connect_onboarded, settings')
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
        t={t}
      />
    )
  }

  const { data: partner } = await admin
    .from('partners')
    .select('name, slug, logo_url, is_active')
    .eq('company_id', company.id)
    .eq('slug', params.partnerSlug)
    .eq('is_active', true)
    .maybeSingle()
  if (!partner) return notFound()

  const { data: vehicleTypes } = await admin
    .from('vehicle_types')
    .select('id, name, class, capacity, amenities, base_image_url')
    .eq('company_id', company.id)
    .eq('is_active', true)
    .order('sort_order')

  const fleet = vehicleTypes ?? []
  const brandColor = (company.primary_color as string | null) || '#c9a24b'
  const heroImg = (company as { hero_image_url?: string | null }).hero_image_url || DEFAULT_HERO
  const site = ((company.settings as { site?: { i18n?: SiteI18n } } | null)?.site) ?? {}
  const tagline = resolveLocalizedField(site.i18n, locale, 'tagline', (company as { tagline?: string | null }).tagline ?? null)

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

  return (
    <div className="min-h-screen bg-[#08080a] text-white antialiased selection:bg-[var(--brand)]/30" style={{ ['--brand' as string]: brandColor }}>
      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${brandColor}55, transparent)` }} />

      <header className="sticky top-0 z-40 bg-[#08080a]/85 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href={`/book/${company.slug}`} className="lux-link text-sm text-white/70 hover:text-white transition-colors">← {company.name}</a>
          <LanguageSwitcher current={locale} variant="dark" />
        </div>
      </header>

      {/* Banner de co-marca — deja claro que el link viene de este partner */}
      <div className="border-b border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center gap-2.5 text-xs text-white/60">
          {partner.logo_url && (
            <Image src={partner.logo_url} alt={partner.name} width={20} height={20} className="rounded-full object-cover shrink-0" />
          )}
          <span>{t.partnerBookingVia.replace('{partner}', partner.name)}</span>
        </div>
      </div>

      <main className="grid lg:grid-cols-2">
        <aside className="lux-grain relative hidden lg:flex flex-col justify-end overflow-hidden min-h-[calc(100vh-97px)] sticky top-[97px]">
          <Image src={heroImg} alt="" fill sizes="50vw" className="object-cover -z-10" />
          <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(180deg, rgba(8,8,10,0.55) 0%, rgba(8,8,10,0.35) 40%, rgba(8,8,10,0.95) 100%)' }} />
          <div className="p-12 xl:p-16">
            <p className="text-xs uppercase tracking-[0.32em] text-white/75 mb-5">{company.name}</p>
            <span className="block h-px w-12 mb-6" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
            <h1 className="font-playfair text-4xl xl:text-[2.75rem] font-medium leading-[1.08] tracking-[-0.015em] text-balance">
              {tagline || company.name}
            </h1>
            <ul className="mt-9 space-y-3 text-sm text-white/65">
              {t.features.slice(0, 3).map((f) => (
                <li key={f.title} className="flex items-center gap-3">
                  <span className="h-px w-5 shrink-0" style={{ backgroundColor: brandColor }} />
                  {f.title}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="flex flex-col items-center px-5 sm:px-8 py-8 lg:py-10">
          <div className="w-full max-w-lg">
            <div className="lg:hidden mb-6">
              <span className="block h-px w-12 mb-5" style={{ background: `linear-gradient(90deg, ${brandColor}, transparent)` }} />
              <h1 className="font-playfair text-3xl font-medium tracking-[-0.01em]">{tagline || company.name}</h1>
            </div>
            <div className="rounded-2xl bg-[#f1ece3] p-5 sm:p-6 shadow-2xl shadow-black/50 ring-1 ring-white/5">
              <BookingWizard
                company={{ id: company.id, name: company.name, slug: company.slug, currency: (company.currency as string | null) ?? 'USD', primaryColor: brandColor, phone: (company.phone as string | null) ?? null, email: (company.email as string | null) ?? null }}
                vehicleTypes={fleet.map((vt) => ({ id: vt.id, name: vt.name, class: vt.class, capacity: vt.capacity, amenities: vt.amenities ?? [], imageUrl: vt.base_image_url ?? null }))}
                onlinePaymentsEnabled={onlinePaymentsEnabled}
                dict={dict.wizard}
                localeTag={LOCALE_TAGS[locale] ?? 'en-US'}
                gratuity={gratuity}
                partnerSlug={partner.slug}
              />
            </div>
            {company.phone && (
              <p className="text-center text-xs text-white/40 mt-6">
                {t.call}: <a href={`tel:${company.phone}`} className="lux-link" style={{ color: brandColor }}>{company.phone}</a>
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
