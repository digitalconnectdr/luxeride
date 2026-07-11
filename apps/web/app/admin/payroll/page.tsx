import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict } from '@/lib/i18n/server'
import { isAddonActive, ADDON_MONTHLY_PRICE, getAddonCheckoutUrl } from '@/lib/billing/addons'
import { AddonUpsellCard } from '@/components/admin/addon-upsell-card'
import { DriverPayrollSettingsForm } from '@/components/admin/payroll/driver-payroll-settings-form'
import { MarkPayrollPaidButton } from '@/components/admin/payroll/mark-payroll-paid-button'
import { computeDriverEarnings, type PayrollType } from '@/lib/payroll/engine'

function firstDayOfMonth(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function PayrollPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>

  const admin = createAdminClient()
  const { data: company } = await admin.from('companies').select('plan, email').eq('id', user.company_id).single()
  if (!company) return <p className="p-8 text-sl-on-surface-muted">Empresa no encontrada.</p>

  const { data: addon } = await admin
    .from('company_addons')
    .select('enabled')
    .eq('company_id', user.company_id)
    .eq('addon_key', 'driver_payroll')
    .maybeSingle()

  const t = getDict().admin.payroll
  const active = isAddonActive(company.plan, addon?.enabled ?? false)

  if (!active) {
    return (
      <div className="p-8 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface mb-6">{t.title}</h1>
        <AddonUpsellCard
          title={t.addonTitle}
          body={t.addonBody}
          price={ADDON_MONTHLY_PRICE.driver_payroll}
          checkoutUrl={getAddonCheckoutUrl('driver_payroll')}
          companyEmail={company.email}
        />
      </div>
    )
  }

  const periodStart = searchParams.from || firstDayOfMonth()
  const periodEnd = searchParams.to || todayStr()

  const [{ data: profiles }, { data: driverRows }, { data: alreadyPaid }] = await Promise.all([
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', user.company_id)
      .eq('role', 'driver')
      .order('first_name', { ascending: true }),
    admin.from('drivers').select('id, payroll_type, payroll_rate').eq('company_id', user.company_id),
    admin
      .from('payroll_payments')
      .select('driver_id')
      .eq('company_id', user.company_id)
      .eq('period_start', periodStart)
      .eq('period_end', periodEnd),
  ])

  const driverById = new Map((driverRows ?? []).map((d) => [d.id, d]))
  const paidDriverIds = new Set((alreadyPaid ?? []).map((p) => p.driver_id))
  const driverIds = (profiles ?? []).map((p) => p.id)

  const { data: completedTrips } = driverIds.length
    ? await admin
        .from('bookings')
        .select('driver_id, total_amount')
        .eq('company_id', user.company_id)
        .eq('status', 'completed')
        .in('driver_id', driverIds)
        .gte('completed_at', periodStart)
        .lte('completed_at', `${periodEnd}T23:59:59`)
    : { data: [] as { driver_id: string | null; total_amount: number | null }[] }

  const tripsByDriver = new Map<string, { totalAmount: number }[]>()
  for (const b of completedTrips ?? []) {
    if (!b.driver_id) continue
    const list = tripsByDriver.get(b.driver_id) ?? []
    list.push({ totalAmount: Number(b.total_amount ?? 0) })
    tripsByDriver.set(b.driver_id, list)
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.subtitle}</p>
      </div>

      <form className="flex items-end gap-3 bg-sl-surface border border-sl-outline-variant rounded-xl p-4">
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.from}</label>
          <input
            type="date"
            name="from"
            defaultValue={periodStart}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5"
          />
        </div>
        <div>
          <label className="block text-xs text-sl-on-surface-muted mb-1">{t.to}</label>
          <input
            type="date"
            name="to"
            defaultValue={periodEnd}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1.5"
          />
        </div>
        <button type="submit" className="text-sm font-medium px-4 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 transition-opacity">
          {t.period}
        </button>
      </form>

      <div className="bg-sl-surface border border-sl-outline-variant rounded-xl overflow-hidden">
        {!profiles?.length ? (
          <p className="p-6 text-sm text-sl-on-surface-muted">{t.noDrivers}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant text-left text-xs text-sl-on-surface-muted">
                <th className="px-4 py-3 font-medium">{t.driver}</th>
                <th className="px-4 py-3 font-medium">{t.payModel}</th>
                <th className="px-4 py-3 font-medium">{t.trips}</th>
                <th className="px-4 py-3 font-medium">{t.earnings}</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const driver = driverById.get(p.id)
                const trips = tripsByDriver.get(p.id) ?? []
                const earnings =
                  driver?.payroll_type && driver.payroll_rate
                    ? computeDriverEarnings(trips, driver.payroll_type as PayrollType, Number(driver.payroll_rate))
                    : 0
                const isPaid = paidDriverIds.has(p.id)

                return (
                  <tr key={p.id} className="border-b border-sl-outline-variant last:border-0 align-top">
                    <td className="px-4 py-3 text-sl-on-surface whitespace-nowrap">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <DriverPayrollSettingsForm
                        driverId={p.id}
                        initialType={(driver?.payroll_type as PayrollType) ?? null}
                        initialRate={driver?.payroll_rate ?? null}
                        t={t}
                      />
                    </td>
                    <td className="px-4 py-3 text-sl-on-surface-muted">{trips.length}</td>
                    <td className="px-4 py-3 font-semibold text-sl-on-surface">
                      {driver?.payroll_type ? `$${earnings.toFixed(2)}` : t.notConfigured}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {driver?.payroll_type && trips.length > 0 && (
                        isPaid ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                            {t.alreadyPaid}
                          </span>
                        ) : (
                          <MarkPayrollPaidButton
                            driverId={p.id}
                            periodStart={periodStart}
                            periodEnd={periodEnd}
                            label={t.markPaid}
                          />
                        )
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
