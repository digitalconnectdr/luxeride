import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { LeadStatusSelect, LeadDeleteButton } from '@/components/super-admin/enterprise-lead-controls'
import type { EnterpriseLeadStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Leads Enterprise' }
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<EnterpriseLeadStatus, string> = {
  new: 'Nuevo', contacted: 'Contactado', converted: 'Convertido', rejected: 'Rechazado',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface PageProps {
  searchParams: { status?: EnterpriseLeadStatus }
}

export default async function EnterpriseLeadsPage({ searchParams }: PageProps) {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: leadsData } = await admin
    .from('enterprise_leads')
    .select('id, company_id, company_name, contact_name, email, phone, fleet_size, message, status, created_at')
    .order('created_at', { ascending: false })

  const all = leadsData ?? []
  const filter = searchParams.status
  const filtered = filter ? all.filter((l) => l.status === filter) : all

  const counts: Record<string, number> = { all: all.length }
  for (const s of ['new', 'contacted', 'converted', 'rejected'] as const) {
    counts[s] = all.filter((l) => l.status === s).length
  }

  function tabHref(status?: EnterpriseLeadStatus) {
    return status ? `/super-admin/enterprise-leads?status=${status}` : '/super-admin/enterprise-leads'
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Leads Enterprise</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Solicitudes de contacto para el plan Enterprise, enviadas desde Configuración → Suscripción.
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
        {(['new', 'contacted', 'converted', 'rejected'] as const).map((s) => (
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
          <p className="text-sm text-sl-on-surface-muted">No hay leads {filter ? `con estado "${STATUS_LABEL[filter]}"` : 'todavía'}.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ede5]">
                {['Fecha', 'Empresa', 'Contacto', 'Flota', 'Mensaje', 'Estado', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede5]">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#faf8f3] transition-colors">
                  <td className="px-5 py-3.5 text-xs text-[#75716a] whitespace-nowrap">{fmtDate(lead.created_at)}</td>
                  <td className="px-5 py-3.5">
                    {lead.company_id ? (
                      <Link href={`/super-admin/companies/${lead.company_id}`} className="font-medium text-[#1d1b18] hover:text-bronze transition-colors">
                        {lead.company_name}
                      </Link>
                    ) : (
                      <p className="font-medium text-[#1d1b18]">{lead.company_name}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sl-on-surface">{lead.contact_name}</p>
                    <p className="text-[11px] text-[#75716a]">{lead.email}</p>
                    <p className="text-[11px] text-[#75716a]">{lead.phone}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[#75716a]">{lead.fleet_size ?? '—'}</td>
                  <td className="px-5 py-3.5 text-xs text-[#75716a] max-w-[240px]">{lead.message ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <LeadStatusSelect leadId={lead.id} current={lead.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <LeadDeleteButton leadId={lead.id} />
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
