import type { Metadata } from 'next'
import { getLocale, getDict } from '@/lib/i18n/server'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { createAdminClient } from '@/lib/supabase/server'
import { ConversionTracker } from '@/components/booking/conversion-tracker'

export const metadata: Metadata = { title: 'Payment' }
export const dynamic = 'force-dynamic'

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { booking?: string }
}) {
  const locale = getLocale()
  const t = getDict(locale).payment
  const bookingNumber = searchParams.booking ?? ''

  // Resuelve el GA4 Measurement ID del operador (no el de LuxeRide) y el monto
  // real para disparar la conversión de Google Ads — mismo patrón de lectura
  // pública por identificador que /track/[id] (no expone nada sensible, solo
  // lo necesario para la conversión).
  let gaMeasurementId: string | undefined
  let adsConversionId: string | undefined
  let adsConversionLabel: string | undefined
  let totalAmount = 0
  let currency = 'USD'

  if (bookingNumber) {
    const admin = createAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select('total_amount, currency, company_id')
      .eq('booking_number', bookingNumber)
      .single()

    if (booking) {
      totalAmount = Number(booking.total_amount ?? 0)
      currency = booking.currency ?? 'USD'
      const { data: company } = await admin
        .from('companies')
        .select('settings')
        .eq('id', booking.company_id)
        .single()
      const tracking = (company?.settings as { tracking?: { ga_measurement_id?: string | null; ads_conversion_id?: string | null; ads_conversion_label?: string | null } } | null)?.tracking
      gaMeasurementId = tracking?.ga_measurement_id ?? undefined
      adsConversionId = tracking?.ads_conversion_id ?? undefined
      adsConversionLabel = tracking?.ads_conversion_label ?? undefined
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-6">
      {bookingNumber && (
        <ConversionTracker
          gaMeasurementId={gaMeasurementId}
          adsConversionId={adsConversionId}
          adsConversionLabel={adsConversionLabel}
          transactionId={bookingNumber}
          value={totalAmount}
          currency={currency}
        />
      )}
      <div className="fixed top-4 right-4 z-50">
        <LanguageSwitcher current={locale} variant="light" />
      </div>
      <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-10 text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <h1 className="font-semibold text-2xl text-[#1d1d1f]">{t.successTitle}</h1>
        {bookingNumber && (
          <p className="font-mono text-lg font-bold text-amber-800 bg-amber-50 rounded-2xl px-6 py-3 inline-block">
            {bookingNumber}
          </p>
        )}
        <p className="text-sm text-gray-500">{t.successBody}</p>
      </div>
    </div>
  )
}
