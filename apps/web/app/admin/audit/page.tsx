import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.audit.title }
}
export const dynamic = 'force-dynamic'

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-600',
}

const PAGE_SIZE = 50

const TABLES = ['bookings', 'payments', 'refunds', 'user_profiles', 'companies']
const EVENT_TYPES = [
  'created', 'driver_assigned', 'driver_reassigned', 'payment_recorded',
  'driver_rejected', 'customer_rejected', 'driver_incident',
]

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
        active ? 'bg-gold text-gray-900 border-bronze' : 'border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
      }`}
    >
      {children}
    </Link>
  )
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
        active ? 'bg-gold text-gray-900 border-bronze' : 'border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
      }`}
    >
      {children}
    </Link>
  )
}

function Pagination({
  page, totalPages, total, fromRow, toRow, pageUrl, t,
}: {
  page: number
  totalPages: number
  total: number
  fromRow: number
  toRow: number
  pageUrl: (p: number) => string
  t: { pagination: string; prev: string; next: string }
}) {
  if (total <= PAGE_SIZE) return null
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-sl-outline-variant">
      <p className="text-xs text-sl-on-surface-muted">
        {t.pagination.replace('{from}', String(fromRow + 1)).replace('{to}', String(Math.min(toRow + 1, total))).replace('{total}', String(total))}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={pageUrl(page - 1)} className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg text-sl-on-surface hover:border-bronze transition-colors">
            {t.prev}
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs border border-sl-outline-variant rounded-lg text-sl-on-surface-muted/40">{t.prev}</span>
        )}
        <span className="text-xs text-sl-on-surface-muted px-1">{page} / {totalPages}</span>
        {page < totalPages ? (
          <Link href={pageUrl(page + 1)} className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg text-sl-on-surface hover:border-bronze transition-colors">
            {t.next}
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs border border-sl-outline-variant rounded-lg text-sl-on-surface-muted/40">{t.next}</span>
        )}
      </div>
    </div>
  )
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { view?: string; table?: string; type?: string; page?: string }
}) {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  const t = getDict().admin.audit
  const eventTypeLabels = getDict().admin.bookingDetail.eventTypes
  const eventActorLabels = getDict().admin.bookingDetail.eventActors
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'
  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">{getDict().admin.bookingsList.noCompany}</p>
  }
  const companyId = user.company_id

  const view = searchParams.view === 'trail' ? 'trail' : 'logs'
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const fromRow = (page - 1) * PAGE_SIZE
  const toRow = fromRow + PAGE_SIZE - 1

  const admin = createAdminClient()

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
        </div>
        <Link
          href="/admin/reports"
          className="px-3 py-2 text-xs font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
        >
          {t.backToReports}
        </Link>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-2">
        <TabLink href="/admin/audit" active={view === 'logs'}>{t.tabLogs}</TabLink>
        <TabLink href="/admin/audit?view=trail" active={view === 'trail'}>{t.tabTrail}</TabLink>
      </div>

      {view === 'logs' ? (
        <AuditLogsView admin={admin} companyId={companyId} t={t} localeTag={localeTag} searchParams={searchParams} page={page} fromRow={fromRow} toRow={toRow} />
      ) : (
        <BookingTrailView admin={admin} companyId={companyId} t={t} eventTypeLabels={eventTypeLabels} eventActorLabels={eventActorLabels} localeTag={localeTag} searchParams={searchParams} page={page} fromRow={fromRow} toRow={toRow} />
      )}
    </div>
  )
}

// ─── Vista 1: Registro de auditoría genérico (audit_logs) ─────────────────────

async function AuditLogsView({
  admin, companyId, t, localeTag, searchParams, page, fromRow, toRow,
}: {
  admin: ReturnType<typeof createAdminClient>
  companyId: string
  t: ReturnType<typeof getDict>['admin']['audit']
  localeTag: string
  searchParams: { table?: string; page?: string }
  page: number
  fromRow: number
  toRow: number
}) {
  let query = admin
    .from('audit_logs')
    .select('id, user_id, action, table_name, record_id, created_at, metadata', { count: 'exact' })
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .range(fromRow, toRow)

  if (searchParams.table) query = query.eq('table_name', searchParams.table)

  const { data: logs, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageUrl = (p: number) => `/admin/audit?${searchParams.table ? `table=${searchParams.table}&` : ''}page=${p}`

  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))] as string[]
  const namesById = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('user_profiles').select('id, first_name, last_name').in('id', userIds)
    for (const p of profiles ?? []) namesById.set(p.id, `${p.first_name} ${p.last_name}`)
  }

  return (
    <>
      <p className="text-sm text-sl-on-surface-muted -mt-2">{t.subtitle.replace('{total}', String(total))}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterLink href="/admin/audit" active={!searchParams.table}>{t.all}</FilterLink>
        {TABLES.map((tbl) => (
          <FilterLink key={tbl} href={`/admin/audit?table=${tbl}`} active={searchParams.table === tbl}>{tbl}</FilterLink>
        ))}
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {!logs?.length ? (
          <p className="p-8 text-sm text-sl-on-surface-muted text-center">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDate}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colUser}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colAction}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colTable}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colRecord}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-sl-bg/50">
                    <td className="px-5 py-3 text-xs text-sl-on-surface-muted whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-3 text-xs text-sl-on-surface">
                      {log.user_id ? namesById.get(log.user_id) ?? log.user_id.slice(0, 8) : t.system}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-sl-on-surface">{log.table_name ?? '—'}</td>
                    <td className="px-5 py-3 text-xs font-mono text-sl-on-surface-muted">
                      {(log.metadata as { booking_number?: string } | null)?.booking_number ?? (log.record_id ? `${log.record_id.slice(0, 8)}…` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} fromRow={fromRow} toRow={toRow} pageUrl={pageUrl} t={t} />
      </div>
    </>
  )
}

// ─── Vista 2: Rastreo ampliado de reservas (booking_events) ───────────────────
// Quién creó, despachó, (re)asignó, canceló o cobró cada reserva — con
// atribución real (actor_id se pasa explícito desde cada server action, no
// depende de auth.uid() que queda NULL bajo el cliente service-role).

async function BookingTrailView({
  admin, companyId, t, eventTypeLabels, eventActorLabels, localeTag, searchParams, page, fromRow, toRow,
}: {
  admin: ReturnType<typeof createAdminClient>
  companyId: string
  t: ReturnType<typeof getDict>['admin']['audit']
  eventTypeLabels: Record<string, string>
  eventActorLabels: Record<string, string>
  localeTag: string
  searchParams: { type?: string; page?: string }
  page: number
  fromRow: number
  toRow: number
}) {
  let query = admin
    .from('booking_events')
    .select('id, booking_id, type, actor, actor_id, reason, metadata, created_at, bookings!inner(booking_number, company_id)', { count: 'exact' })
    .eq('bookings.company_id', companyId)
    .order('created_at', { ascending: false })
    .range(fromRow, toRow)

  if (searchParams.type) query = query.eq('type', searchParams.type)

  const { data: rawEvents, count } = await query
  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageUrl = (p: number) => `/admin/audit?view=trail${searchParams.type ? `&type=${searchParams.type}` : ''}&page=${p}`

  type EventRow = {
    id: string
    booking_id: string
    type: string
    actor: string
    actor_id: string | null
    reason: string | null
    metadata: unknown
    created_at: string
    bookings: { booking_number: string; company_id: string } | { booking_number: string; company_id: string }[]
  }
  const events = (rawEvents ?? []) as unknown as EventRow[]

  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))] as string[]
  const namesById = new Map<string, string>()
  if (actorIds.length > 0) {
    const { data: profiles } = await admin.from('user_profiles').select('id, first_name, last_name').in('id', actorIds)
    for (const p of profiles ?? []) namesById.set(p.id, `${p.first_name} ${p.last_name}`)
  }

  const bookingNumber = (e: EventRow) => (Array.isArray(e.bookings) ? e.bookings[0]?.booking_number : e.bookings?.booking_number) ?? '—'

  const detailFor = (e: EventRow): string => {
    const meta = (e.metadata ?? {}) as Record<string, unknown>
    if (e.type === 'payment_recorded') {
      const amount = meta.amount != null ? `$${Number(meta.amount).toFixed(2)}` : ''
      const method = typeof meta.method === 'string' ? meta.method : ''
      return [amount, method].filter(Boolean).join(' · ')
    }
    if (e.type === 'driver_incident' && typeof meta.category === 'string') {
      return meta.category
    }
    return e.reason ?? '—'
  }

  return (
    <>
      <p className="text-sm text-sl-on-surface-muted -mt-2">{t.trailSubtitle.replace('{total}', String(total))}</p>

      <div className="flex items-center gap-2 flex-wrap">
        <FilterLink href="/admin/audit?view=trail" active={!searchParams.type}>{t.all}</FilterLink>
        {EVENT_TYPES.map((type) => (
          <FilterLink key={type} href={`/admin/audit?view=trail&type=${type}`} active={searchParams.type === type}>
            {eventTypeLabels[type] ?? type}
          </FilterLink>
        ))}
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {!events.length ? (
          <p className="p-8 text-sm text-sl-on-surface-muted text-center">{t.trailEmpty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDate}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colBooking}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colEvent}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colActor}</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.colDetail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-sl-bg/50">
                    <td className="px-5 py-3 text-xs text-sl-on-surface-muted whitespace-nowrap">
                      {new Date(ev.created_at).toLocaleString(localeTag, { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/bookings/${ev.booking_id}`} className="font-mono text-xs text-bronze hover:underline">
                        {bookingNumber(ev)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-xs text-sl-on-surface">{eventTypeLabels[ev.type] ?? ev.type}</td>
                    <td className="px-5 py-3 text-xs text-sl-on-surface">
                      {ev.actor_id ? namesById.get(ev.actor_id) ?? ev.actor_id.slice(0, 8) : (eventActorLabels[ev.actor] ?? ev.actor)}
                    </td>
                    <td className="px-5 py-3 text-xs text-sl-on-surface-muted">{detailFor(ev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} fromRow={fromRow} toRow={toRow} pageUrl={pageUrl} t={t} />
      </div>
    </>
  )
}
