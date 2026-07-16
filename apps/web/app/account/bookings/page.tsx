import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/actions/auth'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Mis Reservaciones' }
export const dynamic = 'force-dynamic'

export default async function AccountBookingsPage() {
  const user = await requireRole('customer')

  const admin = createAdminClient()

  const [{ data: bookings }, companyRes] = await Promise.all([
    admin
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, pickup_location, dropoff_location, total_amount, currency')
      .eq('customer_id', user.id)
      .order('scheduled_at', { ascending: false })
      .limit(25),
    user.company_id
      ? admin.from('companies').select('slug, name, status').eq('id', user.company_id).single()
      : Promise.resolve({ data: null }),
  ])

  const company = companyRes.data as { slug: string; name: string; status: string } | null

  return (
    <div className="min-h-screen bg-sl-bg">
      <header className="bg-sl-surface-high border-b border-sl-outline-variant">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-gold flex items-center justify-center">
              <span className="text-gray-900 font-bold text-[10px] leading-none">L</span>
            </div>
            <span className="font-playfair text-sm font-semibold text-sl-on-surface">
              Mis reservaciones
            </span>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-sl-on-surface-muted hover:text-red-400">
              Sign out →
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-sl-on-surface-muted">
            Hola {user.profile.first_name} 👋
          </p>
          {company?.status === 'active' && (
            <Link
              href={`/book/${company.slug}`}
              className="px-4 py-2 text-xs font-semibold bg-gold text-gray-900 rounded-xl hover:bg-gold/90 transition-colors"
            >
              + Nueva reservación
            </Link>
          )}
        </div>

        {!bookings?.length ? (
          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-10 text-center">
            <p className="text-sm text-sl-on-surface-muted">No tienes reservaciones todavía.</p>
          </div>
        ) : (
          bookings.map((b) => {
            const pickup  = (b.pickup_location as { address?: string } | null)?.address ?? '—'
            const dropoff = (b.dropoff_location as { address?: string } | null)?.address ?? '—'
            return (
              <div key={b.id} className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-bronze">{b.booking_number}</span>
                  <BookingStatusBadge status={b.status as BookingStatus} />
                </div>
                <p className="text-sm font-semibold text-sl-on-surface">
                  {new Date(b.scheduled_at).toLocaleString('es-DO', {
                    weekday: 'short', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
                <div className="text-sm space-y-1">
                  <p className="text-sl-on-surface-muted">▲ {pickup}</p>
                  <p className="text-sl-on-surface-muted">▼ {dropoff}</p>
                </div>
                {b.total_amount != null && (
                  <p className="text-sm font-semibold text-sl-on-surface pt-2 border-t border-sl-outline-variant">
                    ${Number(b.total_amount).toFixed(2)} {b.currency ?? 'USD'}
                  </p>
                )}
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
