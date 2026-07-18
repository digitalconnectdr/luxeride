import type { Metadata } from 'next'
import Link from 'next/link'
import { Lightbulb, Bug } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { FeatureRequestStatusSelect } from '@/components/super-admin/feature-request-controls'
import type { FeatureRequestStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Solicitudes' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<FeatureRequestStatus, string> = {
  submitted: 'Enviada',
  pending: 'Pendiente',
  in_progress: 'En trabajo',
  resolved: 'Solucionada',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface PageProps {
  searchParams: { status?: FeatureRequestStatus }
}

export default async function FeatureRequestsPage({ searchParams }: PageProps) {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: requestsData } = await admin
    .from('feature_requests')
    .select('id, company_id, type, title, description, status, created_at, companies(name), user_profiles(first_name, last_name)')
    .order('created_at', { ascending: false })

  type Row = {
    id: string
    company_id: string | null
    type: 'feature' | 'bug'
    title: string
    description: string
    status: FeatureRequestStatus
    created_at: string
    companies: { name: string } | null
    user_profiles: { first_name: string; last_name: string } | null
  }

  const all = (requestsData ?? []) as unknown as Row[]
  const filter = searchParams.status
  const filtered = filter ? all.filter((r) => r.status === filter) : all

  const counts: Record<string, number> = { all: all.length }
  for (const s of ['submitted', 'pending', 'in_progress', 'resolved'] as const) {
    counts[s] = all.filter((r) => r.status === s).length
  }

  function tabHref(status?: FeatureRequestStatus) {
    return status ? `/super-admin/feature-requests?status=${status}` : '/super-admin/feature-requests'
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Solicitudes</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Funciones recomendadas y problemas reportados por los operadores desde la barra superior del admin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={tabHref(undefined)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !filter ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          Todos ({counts.all})
        </Link>
        {(['submitted', 'pending', 'in_progress', 'resolved'] as const).map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-sl-outline-variant text-sl-on-surface-muted hover:border-bronze'
            }`}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-sl-outline-variant rounded-xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">No hay solicitudes {filter ? `con estado "${STATUS_LABEL[filter]}"` : 'todavía'}.</p>
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-outline-variant/60">
                  {['Fecha', 'Tipo', 'Empresa', 'Enviado por', 'Solicitud', 'Estado'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant/60">
                {filtered.map((req) => (
                  <tr key={req.id} className="hover:bg-sl-bg transition-colors">
                    <td className="px-5 py-3.5 text-xs text-sl-on-surface-muted whitespace-nowrap">{fmtDate(req.created_at)}</td>
                    <td className="px-5 py-3.5">
                      {req.type === 'feature' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                          <Lightbulb size={11} /> Función
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          <Bug size={11} /> Problema
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {req.company_id ? (
                        <Link href={`/super-admin/companies/${req.company_id}`} className="font-medium text-sl-on-surface hover:text-bronze transition-colors">
                          {req.companies?.name ?? '—'}
                        </Link>
                      ) : (
                        <p className="font-medium text-sl-on-surface">{req.companies?.name ?? '—'}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-sl-on-surface-muted whitespace-nowrap">
                      {req.user_profiles ? `${req.user_profiles.first_name} ${req.user_profiles.last_name}` : '—'}
                    </td>
                    <td className="px-5 py-3.5 max-w-[360px]">
                      <p className="text-sl-on-surface font-medium">{req.title}</p>
                      <p className="text-[11px] text-sl-on-surface-muted mt-0.5">{req.description}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <FeatureRequestStatusSelect requestId={req.id} current={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
