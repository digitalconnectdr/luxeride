import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { AffiliateLeadStatusSelect } from '@/components/super-admin/affiliate-lead-controls'

export const metadata: Metadata = { title: 'Leads Affiliate Network' }
export const dynamic = 'force-dynamic'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function AffiliateLeadsPage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: leads } = await admin
    .from('affiliate_network_leads')
    .select('id, company_id, company_name, contact_name, email, phone, message, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Leads Affiliate Network</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Solicitudes de activación del add-on de Red de Afiliados, enviadas desde Configuración de cada empresa.
        </p>
      </div>

      {!leads?.length ? (
        <div className="bg-white border border-[#e5e1d8] rounded-2xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">Sin leads todavía.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e1d8] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ede5]">
                {['Empresa', 'Contacto', 'Email', 'Teléfono', 'Mensaje', 'Estado', 'Fecha'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede5]">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-[#faf8f3] transition-colors">
                  <td className="px-4 py-3 font-medium text-sl-on-surface">{l.company_name}</td>
                  <td className="px-4 py-3 text-sl-on-surface">{l.contact_name}</td>
                  <td className="px-4 py-3 text-sl-on-surface-muted">{l.email}</td>
                  <td className="px-4 py-3 text-sl-on-surface-muted">{l.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-sl-on-surface-muted max-w-xs truncate" title={l.message ?? ''}>{l.message ?? '—'}</td>
                  <td className="px-4 py-3"><AffiliateLeadStatusSelect leadId={l.id} current={l.status} /></td>
                  <td className="px-4 py-3 text-xs text-sl-on-surface-muted">{fmtDate(l.created_at)}</td>
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
