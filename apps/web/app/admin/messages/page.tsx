import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.messagesList.title }
}

interface ThreadSummary {
  bookingId: string
  lastBody: string
  lastSender: 'client' | 'driver'
  lastAt: string
  count: number
}

export default async function AdminMessagesPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().admin.messagesList
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">{t.noCompany}</p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Ventana de los últimos mensajes de la empresa — suficiente para armar un
  // resumen por reserva (último mensaje + total) sin necesitar una vista SQL.
  const { data: recent } = await admin
    .from('trip_messages')
    .select('booking_id, sender, body, created_at')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })
    .limit(500)

  const threads = new Map<string, ThreadSummary>()
  for (const m of recent ?? []) {
    const existing = threads.get(m.booking_id)
    if (existing) {
      existing.count += 1
    } else {
      threads.set(m.booking_id, {
        bookingId: m.booking_id,
        lastBody: m.body,
        lastSender: m.sender as 'client' | 'driver',
        lastAt: m.created_at,
        count: 1,
      })
    }
  }

  const bookingIds = Array.from(threads.keys())
  const { data: bookings } = bookingIds.length
    ? await admin
        .from('bookings')
        .select('id, booking_number, passenger_name, status')
        .eq('company_id', user.company_id)
        .in('id', bookingIds)
    : { data: [] as { id: string; booking_number: string; passenger_name: string | null; status: string }[] }
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]))

  const rows = Array.from(threads.values())
    .filter((th) => bookingById.has(th.bookingId))
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">{t.subtitle}</p>
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-8 text-sm text-sl-on-surface-muted text-center">{t.empty}</p>
        ) : (
          <div className="divide-y divide-sl-outline-variant">
            {rows.map((th) => {
              const b = bookingById.get(th.bookingId)!
              return (
                <Link
                  key={th.bookingId}
                  href={`/admin/messages/${th.bookingId}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sl-bg/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-sl-on-surface truncate">
                        {b.passenger_name ?? t.unnamedPassenger}
                      </p>
                      <span className="text-[10px] font-mono text-sl-on-surface-muted">{b.booking_number}</span>
                    </div>
                    <p className="text-xs text-sl-on-surface-muted truncate mt-0.5">
                      <span className="font-medium">{th.lastSender === 'driver' ? t.driverLabel : t.clientLabel}:</span>{' '}
                      {th.lastBody}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-sl-on-surface-muted">
                      {new Date(th.lastAt).toLocaleString(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-sl-on-surface-muted/70 mt-0.5">{th.count} {t.messagesCount}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
