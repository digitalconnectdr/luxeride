import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { BookingStatusBadge } from '@/components/bookings/booking-status-badge'
import type { BookingStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Dashboard Corporativo' }

export default async function CorporateDashboardPage() {
  const user = await requireRole('corporate_manager', 'corporate_user')

  const admin = createAdminClient()

  // Membresía corporativa del usuario
  const { data: membership } = await admin
    .from('corporate_members')
    .select('id, corporate_account_id, role, spending_limit, monthly_limit, cost_center')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-10 text-center">
        <p className="text-sm text-sl-on-surface-muted">
          Tu usuario no está asociado a ninguna cuenta corporativa.
          Contacta al administrador de tu empresa de transporte.
        </p>
      </div>
    )
  }

  const { data: account } = await admin
    .from('corporate_accounts')
    .select('id, name, credit_limit, current_balance, require_approval')
    .eq('id', membership.corporate_account_id)
    .single()

  const isManager = membership.role === 'manager'

  // Bookings: manager ve toda la cuenta; usuario solo los suyos
  let bookingsQuery = admin
    .from('bookings')
    .select('id, booking_number, status, passenger_name, scheduled_at, total_amount, customer_id')
    .eq('corporate_account_id', membership.corporate_account_id)
    .order('scheduled_at', { ascending: false })
    .limit(15)

  if (!isManager) {
    bookingsQuery = bookingsQuery.eq('customer_id', user.id)
  }

  const { data: bookings } = await bookingsQuery

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const monthSpend = (bookings ?? [])
    .filter((b) => b.status === 'completed' && new Date(b.scheduled_at) >= monthStart)
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
          {account?.name ?? 'Cuenta corporativa'}
        </h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Bienvenido, {user.profile.first_name} |{' '}
          <span className="text-bronze">{isManager ? 'Manager' : 'Usuario'}</span>
          {membership.cost_center && ` · ${membership.cost_center}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Gasto del mes (visible)
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            ${monthSpend.toFixed(2)}
          </p>
        </div>
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Límite por viaje
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            {membership.spending_limit != null ? `$${Number(membership.spending_limit).toFixed(0)}` : '—'}
          </p>
        </div>
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            Límite mensual
          </p>
          <p className="text-3xl font-playfair font-semibold text-sl-on-surface mt-2">
            {membership.monthly_limit != null ? `$${Number(membership.monthly_limit).toFixed(0)}` : '—'}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href="/corporate/book"
          className="px-5 py-2.5 text-sm font-medium bg-gold text-gray-900 rounded-xl hover:bg-gold/90 transition-colors"
        >
          + Nueva reservación
        </Link>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-sl-outline-variant">
          <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
            {isManager ? 'Viajes de la cuenta' : 'Mis viajes'}
          </p>
        </div>
        {!bookings?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted text-center">Sin viajes todavía.</p>
        ) : (
          <div className="divide-y divide-sl-outline-variant">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-[#0071e3]">{b.booking_number}</span>
                  <BookingStatusBadge status={b.status as BookingStatus} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-sl-on-surface-muted">
                    {new Date(b.scheduled_at).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                  <span className="font-semibold text-sl-on-surface">
                    {b.total_amount != null ? `$${Number(b.total_amount).toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
