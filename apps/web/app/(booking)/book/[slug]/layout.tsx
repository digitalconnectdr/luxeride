import { MapsProvider } from '@/components/maps/maps-provider'
import { getLocale } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { createAdminClient } from '@/lib/supabase/server'
import { brand } from '@/lib/brand'

export default async function BookingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const locale = getLocale()

  // Marca de la empresa (white-label): logo, color y nombre propios.
  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, logo_url, primary_color')
    .eq('slug', params.slug)
    .maybeSingle()

  const companyName = company?.name ?? brand.name
  const brandColor = company?.primary_color ?? '#d4af37'
  const logoUrl = company?.logo_url ?? null
  const initial = companyName.trim().charAt(0).toUpperCase() || 'L'

  return (
    <div
      className="min-h-screen bg-[#f5f5f7]"
      style={{ ['--brand' as string]: brandColor }}
    >
      {/* Header con la marca de la empresa */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={companyName} className="h-7 max-w-[150px] object-contain" />
            ) : (
              <>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: brandColor }}
                >
                  <span className="text-white font-bold text-[10px] leading-none">{initial}</span>
                </div>
                <span className="font-semibold text-[#1d1d1f] text-sm tracking-tight">{companyName}</span>
              </>
            )}
          </div>
          <LanguageSwitcher current={locale} variant="light" />
        </div>
      </header>

      {/* Contenido full-width — el microsite controla el ancho de cada sección.
          MapsProvider envuelve todo para el AddressInput del wizard embebido. */}
      <MapsProvider>
        <main>{children}</main>
      </MapsProvider>

      <footer className="max-w-2xl mx-auto px-6 py-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-gray-400">
          {companyName} · Powered by {brand.name}
        </p>
      </footer>
    </div>
  )
}
