import type { Metadata } from 'next'
import { getDict } from '@/lib/i18n/server'

export const metadata: Metadata = { title: 'Payment' }
export const dynamic = 'force-dynamic'

export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: { booking?: string }
}) {
  const t = getDict().payment
  const bookingNumber = searchParams.booking ?? ''

  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-6">
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
