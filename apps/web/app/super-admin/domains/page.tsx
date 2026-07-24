import type { Metadata } from 'next'
import Link from 'next/link'
import { listDomainRequestsAction } from '@/app/actions/domains'
import { DomainRequestControls } from '@/components/super-admin/domain-request-controls'
import type { DomainRequestStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Solicitudes de dominio' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<DomainRequestStatus, string> = {
  pending: 'Pendiente', purchased: 'Comprado', rejected: 'Rechazado',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface PageProps {
  searchParams: { status?: DomainRequestStatus }
}

export default async function DomainRequestsPage({ searchParams }: PageProps) {
  const all = await listDomainRequestsAction()

  const filter = searchParams.status
  const filtered = filter ? all.filter((r) => r.status === filter) : all

  const counts: Record<string, number> = { all: all.length }
  for (const s of ['pending', 'purchased', 'rejected'] as const) {
    counts[s] = all.filter((r) => r.status === s).length
  }

  function tabHref(status?: DomainRequestStatus) {
    return status ? `/super-admin/domains?status=${status}` : '/super-admin/domains'
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Solicitudes de dominio</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Operadores que activaron el add-on de Dominio personalizado y pidieron que les consigamos uno (compra manual, dinero real).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={tabHref(undefined)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !filter ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-[#e5e1d8] text-sl-on-surface-muted hover:border-bronze'
          }`}
        >
          Todos ({counts.all})
        </Link>
        {(['pending', 'purchased', 'rejected'] as const).map((s) => (
          <Link
            key={s}
            href={tabHref(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s ? 'bg-[#1d1d1f] text-white' : 'bg-white border border-[#e5e1d8] text-sl-on-surface-muted hover:border-bronze'
            }`}
          >
            {STATUS_LABEL[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#e5e1d8] rounded-xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">No hay solicitudes {filter ? `con estado "${STATUS_LABEL[filter]}"` : 'todavía'}.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ede5]">
                {['Fecha', 'Empresa', 'Nombre solicitado', 'Notas', 'Estado', 'Dominio resuelto', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede5]">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-[#faf8f3] transition-colors">
                  <td className="px-5 py-3.5 text-xs text-[#75716a] whitespace-nowrap">{fmtDate(req.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <Link href={`/super-admin/companies/${req.company_id}`} className="font-medium text-[#1d1b18] hover:text-bronze transition-colors">
                      {req.company_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-sl-on-surface">{req.requested_name}</td>
                  <td className="px-5 py-3.5 text-xs text-[#75716a] max-w-[240px]">{req.notes ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                      req.status === 'purchased' ? 'bg-green-50 text-green-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {STATUS_LABEL[req.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-sl-on-surface">{req.resolved_domain ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    {req.status === 'pending' && <DomainRequestControls requestId={req.id} />}
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
