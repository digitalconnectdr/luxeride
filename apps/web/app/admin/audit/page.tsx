import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Audit Log' }
export const dynamic = 'force-dynamic'

const ACTION_STYLES: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-[#0071e3]',
  DELETE: 'bg-red-100 text-red-600',
}

const PAGE_SIZE = 50

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { table?: string; page?: string }
}) {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>
  }

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const fromRow = (page - 1) * PAGE_SIZE
  const toRow = fromRow + PAGE_SIZE - 1

  const admin = createAdminClient()

  let query = admin
    .from('audit_logs')
    .select('id, user_id, action, table_name, record_id, created_at', { count: 'exact' })
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })
    .range(fromRow, toRow)

  if (searchParams.table) {
    query = query.eq('table_name', searchParams.table)
  }

  const { data: logs, count } = await query

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageUrl = (p: number) =>
    `/admin/audit?${searchParams.table ? `table=${searchParams.table}&` : ''}page=${p}`

  // Nombres de los usuarios involucrados
  const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))] as string[]
  const namesById = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .in('id', userIds)
    for (const p of profiles ?? []) namesById.set(p.id, `${p.first_name} ${p.last_name}`)
  }

  const TABLES = ['bookings', 'payments', 'refunds', 'user_profiles', 'companies']

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Audit Log</h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            Registro inmutable de operaciones críticas — {total} en total.
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="px-3 py-2 text-xs font-medium border border-sl-outline-variant text-sl-on-surface rounded-lg hover:border-bronze transition-colors"
        >
          ← Reportes
        </Link>
      </div>

      {/* Filtro por tabla */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/admin/audit"
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !searchParams.table
              ? 'bg-gold text-gray-900 border-bronze'
              : 'border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          Todas
        </Link>
        {TABLES.map((t) => (
          <Link
            key={t}
            href={`/admin/audit?table=${t}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              searchParams.table === t
                ? 'bg-gold text-gray-900 border-bronze'
                : 'border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
        {!logs?.length ? (
          <p className="p-8 text-sm text-sl-on-surface-muted text-center">
            Sin registros de auditoría.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Fecha</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Usuario</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Acción</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Tabla</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-sl-bg/50">
                  <td className="px-5 py-3 text-xs text-sl-on-surface-muted whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('es-DO', {
                      dateStyle: 'short', timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-5 py-3 text-xs text-sl-on-surface">
                    {log.user_id ? namesById.get(log.user_id) ?? log.user_id.slice(0, 8) : 'Sistema'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ACTION_STYLES[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-mono text-sl-on-surface">{log.table_name ?? '—'}</td>
                  <td className="px-5 py-3 text-xs font-mono text-sl-on-surface-muted">
                    {log.record_id ? `${log.record_id.slice(0, 8)}…` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginación — 50 por página */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-sl-outline-variant">
            <p className="text-xs text-sl-on-surface-muted">
              {fromRow + 1}–{Math.min(toRow + 1, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={pageUrl(page - 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg text-sl-on-surface hover:border-bronze transition-colors"
                >
                  ← Anterior
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-xs border border-sl-outline-variant rounded-lg text-sl-on-surface-muted/40">
                  ← Anterior
                </span>
              )}
              <span className="text-xs text-sl-on-surface-muted px-1">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageUrl(page + 1)}
                  className="px-3 py-1.5 text-xs font-medium border border-sl-outline-variant rounded-lg text-sl-on-surface hover:border-bronze transition-colors"
                >
                  Siguiente →
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-xs border border-sl-outline-variant rounded-lg text-sl-on-surface-muted/40">
                  Siguiente →
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
