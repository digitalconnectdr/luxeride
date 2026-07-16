import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import {
  RenewButtons,
  PlanSelect,
  ApproveRejectButtons,
} from '@/components/super-admin/subscription-controls'
import type { CompanyPlan, CompanyStatus } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Suscripciones' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<CompanyStatus, string> = {
  active:    'bg-green-100 text-green-700',
  trial:     'bg-yellow-100 text-yellow-700',
  suspended: 'bg-orange-100 text-orange-700',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABEL: Record<CompanyStatus, string> = {
  active: 'Activa', trial: 'Solicitud / Trial', suspended: 'Suspendida', cancelled: 'Cancelada',
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function SubscriptionsPage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, slug, email, phone, status, plan, created_at, trial_ends_at, subscription_ends_at, whop_membership_id')
    .order('created_at', { ascending: false })

  const all = companies ?? []
  const pending = all.filter((c) => c.status === 'trial')
  const clients = all.filter((c) => c.status !== 'trial')

  // Métricas rápidas
  const active = clients.filter((c) => c.status === 'active')
  const expiringSoon = active.filter((c) => {
    const d = daysLeft(c.subscription_ends_at)
    return d !== null && d <= 7
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Suscripciones</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Solicitudes de servicio, estado de cada cliente y renovaciones.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Solicitudes pendientes', value: pending.length, accent: pending.length > 0 },
          { label: 'Clientes activos', value: active.length, accent: false },
          { label: 'Vencen en 7 días', value: expiringSoon.length, accent: expiringSoon.length > 0 },
          { label: 'Total empresas', value: all.length, accent: false },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[#e5e1d8] rounded-xl px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
              {c.label}
            </p>
            <p className={`text-2xl font-playfair font-semibold mt-1 ${c.accent ? 'text-bronze' : 'text-[#1d1b18]'}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Solicitudes pendientes (empresas en trial desde el landing) ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0ede5] flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a]">
            Solicitudes pendientes
          </p>
          {pending.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-bronze text-white text-[10px] font-bold">
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="p-6 text-sm text-[#75716a] text-center">
            No hay solicitudes nuevas. Cuando alguien cree una cuenta desde el landing, aparecerá aquí.
          </p>
        ) : (
          <div className="divide-y divide-[#f0ede5]">
            {pending.map((c) => (
              <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <Link
                    href={`/super-admin/companies/${c.id}`}
                    className="text-sm font-semibold text-[#1d1b18] hover:text-bronze transition-colors"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-[#75716a] mt-0.5">
                    /{c.slug}
                    {c.email && ` · ${c.email}`}
                    {c.phone && ` · ${c.phone}`}
                    {' · solicitada '}
                    {fmtDate(c.created_at)}
                  </p>
                </div>
                <ApproveRejectButtons companyId={c.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Clientes y renovaciones ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0ede5]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a]">
            Clientes ({clients.length})
          </p>
        </div>
        {clients.length === 0 ? (
          <p className="p-6 text-sm text-[#75716a] text-center">Sin clientes todavía.</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ede5]">
                {['Empresa', 'Estado', 'Plan', 'Cliente desde', 'Vence', 'Renovar'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede5]">
              {clients.map((c) => {
                const d = daysLeft(c.subscription_ends_at)
                const expired = d !== null && d < 0
                const expiring = d !== null && d >= 0 && d <= 7
                return (
                  <tr key={c.id} className="hover:bg-[#faf8f3] transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/super-admin/companies/${c.id}`}
                        className="font-medium text-[#1d1b18] hover:text-bronze transition-colors"
                      >
                        {c.name}
                      </Link>
                      {c.whop_membership_id && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-[#f0ede5] px-1.5 py-0.5 text-[9px] font-semibold text-[#75716a] align-middle">
                          Whop
                        </span>
                      )}
                      <p className="text-xs text-[#75716a]">/{c.slug}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[c.status as CompanyStatus]}`}>
                        {STATUS_LABEL[c.status as CompanyStatus] ?? c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <PlanSelect companyId={c.id} current={c.plan as CompanyPlan} />
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#75716a]">{fmtDate(c.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <p className={`text-xs font-medium ${expired ? 'text-red-600' : expiring ? 'text-orange-600' : 'text-[#1d1b18]'}`}>
                        {fmtDate(c.subscription_ends_at)}
                      </p>
                      {d !== null && (
                        <p className={`text-[10px] ${expired ? 'text-red-500' : expiring ? 'text-orange-500' : 'text-[#75716a]'}`}>
                          {expired ? `vencida hace ${Math.abs(d)} días` : `${d} días restantes`}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <RenewButtons companyId={c.id} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
