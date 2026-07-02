import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { currentYearMonth } from '@/lib/tracking/live-tracking-quota'
import { QuotaInput } from '@/components/super-admin/tracking-quota-controls'
import type { CompanyPlan } from '@/lib/supabase/database.types'

export const metadata: Metadata = { title: 'Tracking en vivo' }
export const dynamic = 'force-dynamic'

const PLAN_ORDER: CompanyPlan[] = ['free', 'starter', 'professional', 'enterprise']
const PLAN_LABEL: Record<CompanyPlan, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
}

export default async function TrackingUsagePage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const yearMonth = currentYearMonth()

  const [{ data: quotas }, { data: usage }, { data: companies }] = await Promise.all([
    admin.from('plan_quotas').select('plan, live_tracking_monthly_quota'),
    admin.from('live_tracking_usage').select('company_id, refresh_count').eq('year_month', yearMonth),
    admin.from('companies').select('id, name, slug, plan').order('name'),
  ])

  const quotaByPlan = new Map((quotas ?? []).map((q) => [q.plan, q.live_tracking_monthly_quota]))
  const usageByCompany = new Map((usage ?? []).map((u) => [u.company_id, u.refresh_count]))
  const totalRefreshes = (usage ?? []).reduce((sum, u) => sum + u.refresh_count, 0)

  const rows = (companies ?? [])
    .map((c) => {
      const plan = c.plan as CompanyPlan
      const consumed = usageByCompany.get(c.id) ?? 0
      const quota = quotaByPlan.get(plan) ?? null
      return { ...c, plan, consumed, quota }
    })
    .filter((r) => r.consumed > 0)
    .sort((a, b) => b.consumed - a.consumed)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Tracking en vivo</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          Cuota mensual de refrescos de mapa en vivo por plan (protege el costo de Google Maps) y
          consumo real de cada empresa este mes.
        </p>
      </div>

      {/* KPI */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl px-4 py-3.5 w-fit">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
          Refrescos totales — {yearMonth}
        </p>
        <p className="text-2xl font-playfair font-semibold mt-1 text-[#1d1b18]">{totalRefreshes.toLocaleString()}</p>
      </div>

      {/* ── Cuotas por plan ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0ede5]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a]">Cuota mensual por plan</p>
        </div>
        <div className="divide-y divide-[#f0ede5]">
          {PLAN_ORDER.map((plan) => (
            <div key={plan} className="px-6 py-4 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-[#1d1b18]">{PLAN_LABEL[plan]}</span>
              <QuotaInput plan={plan} current={quotaByPlan.get(plan) ?? null} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Consumo por empresa (este mes) ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f0ede5]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a]">
            Consumo por empresa — {yearMonth}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#75716a] text-center">Sin consumo registrado todavía este mes.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f0ede5]">
                {['Empresa', 'Plan', 'Consumido', 'Cuota', 'Estado'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#75716a]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ede5]">
              {rows.map((r) => {
                const overQuota = r.quota !== null && r.consumed >= r.quota
                return (
                  <tr key={r.id} className="hover:bg-[#faf8f3] transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/super-admin/companies/${r.id}`} className="font-medium text-[#1d1b18] hover:text-bronze transition-colors">
                        {r.name}
                      </Link>
                      <p className="text-xs text-[#75716a]">/{r.slug}</p>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#75716a] capitalize">{r.plan}</td>
                    <td className="px-5 py-3.5 text-sm font-medium text-[#1d1b18]">{r.consumed.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-xs text-[#75716a]">{r.quota === null ? 'Sin límite' : r.quota.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      {overQuota ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700">
                          Cuota agotada
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700">
                          Dentro de cuota
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
