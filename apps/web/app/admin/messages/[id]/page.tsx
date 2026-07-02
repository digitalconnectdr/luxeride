import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'
import { AutoRefresh } from '@/app/track/[id]/auto-refresh'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.messagesList.title }
}

export default async function AdminMessageThreadPage({ params }: { params: { id: string } }) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().admin.messagesList
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) notFound()

  const admin = createAdminClient()
  const { data: booking } = await admin
    .from('bookings')
    .select('id, booking_number, passenger_name, status, driver_id')
    .eq('id', params.id)
    .eq('company_id', user.company_id) // IDOR guard
    .single()

  if (!booking) notFound()

  let driverName: string | null = null
  if (booking.driver_id) {
    const { data: drv } = await admin
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('id', booking.driver_id)
      .single()
    if (drv) driverName = `${drv.first_name} ${drv.last_name}`.trim()
  }

  const { data: messages } = await admin
    .from('trip_messages')
    .select('id, sender, body, created_at, read_at')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: true })
    .limit(500)

  return (
    <div className="p-8 max-w-[800px] mx-auto space-y-6">
      <AutoRefresh seconds={15} />
      <div>
        <Link href="/admin/messages" className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface transition-colors">
          ← {t.title}
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="font-playfair text-2xl font-semibold text-sl-on-surface">
            {booking.passenger_name ?? t.unnamedPassenger}
          </h1>
          <span className="text-xs font-mono text-sl-on-surface-muted">{booking.booking_number}</span>
        </div>
        <p className="text-xs text-sl-on-surface-muted mt-1">
          {t.driverLabel}: {driverName ?? t.unassignedDriver}
        </p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4 max-h-[65vh] overflow-y-auto">
        {!messages?.length ? (
          <p className="text-sm text-sl-on-surface-muted text-center py-8">{t.emptyThread}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'driver' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] mb-1 px-1 text-sl-on-surface-muted">
                {m.sender === 'driver' ? t.driverLabel : t.clientLabel}
              </span>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender === 'driver' ? 'bg-gold/15 text-sl-on-surface rounded-br-sm' : 'bg-sl-bg text-sl-on-surface rounded-bl-sm'
                }`}
              >
                {m.body}
              </div>
              <span className="text-[9px] mt-1 px-1 text-sl-on-surface-muted/70">
                {new Date(m.created_at).toLocaleString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {m.read_at ? ` · ✓ ${t.seenLabel}` : ''}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-sl-on-surface-muted">{t.readOnlyNotice}</p>
    </div>
  )
}
