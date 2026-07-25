import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { createPricingRuleAction } from '@/app/actions/pricing'
import { PricingRuleRow } from '@/components/admin/pricing-rule-row'
import { PricingModelField } from '@/components/admin/pricing-model-field'
import { PricingAdvancedFields } from '@/components/admin/pricing-advanced-fields'
import { PricingFaq } from '@/components/admin/pricing-faq'
import { CompanyHolidays } from '@/components/admin/company-holidays'
import { getLocalTimeParts } from '@/lib/pricing/engine'
import { getDict, getLocale } from '@/lib/i18n/server'
import { InfoTip } from '@/components/ui/info-tip'

export default async function PricingPage() {
  const user = await requireRole('company_owner', 'company_admin')

  const admin = createAdminClient()

  const [
    { data: rules },
    { data: vehicleTypes },
    { data: zones },
    { data: holidays },
    { data: company },
  ] = await Promise.all([
    admin
      .from('pricing_rules')
      .select('id, name, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, minimum_hours, origin_zone_id, destination_zone_id, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, holiday_surcharge_pct, surge_enabled, surge_multiplier, valid_from, valid_until, days_of_week, priority, is_active, vehicle_type_id')
      .eq('company_id', user.company_id!)
      .order('priority', { ascending: false })
      .order('name', { ascending: true }),
    admin
      .from('vehicle_types')
      .select('id, name')
      .eq('company_id', user.company_id!)
      .eq('is_active', true)
      .order('name'),
    admin
      .from('service_zones')
      .select('id, name')
      .eq('company_id', user.company_id!)
      .eq('is_active', true)
      .order('name'),
    admin
      .from('company_holidays')
      .select('id, holiday_date, name')
      .eq('company_id', user.company_id!)
      .order('holiday_date', { ascending: true }),
    admin
      .from('companies')
      .select('timezone')
      .eq('id', user.company_id!)
      .single(),
  ])

  // Map vehicle type id → name for display
  const vtMap = new Map((vehicleTypes ?? []).map((vt) => [vt.id, vt.name]))

  // void cast — TypeScript void-callback rule
  const pricingAction: (fd: FormData) => void = createPricingRuleAction
  const dict = getDict().admin
  const t = dict.pricing
  const actions = dict.actions

  // "Hoy" en la zona horaria de la empresa: sirve para marcar feriados ya
  // pasados sin depender del reloj del navegador del operador, que puede
  // estar en otro país.
  const { isoDate: todayIso } = getLocalTimeParts(new Date(), company?.timezone)
  const locale = getLocale()

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">
            {t.subtitle}
          </p>
        </div>
        <span className="text-xs text-sl-on-surface-muted">
          {rules?.length ?? 0} {t.count}
        </span>
      </div>

      {/* Ayuda: cómo se eligen las reglas y cómo se acumulan los recargos */}
      <PricingFaq t={t.faq} />

      {/* Add Rule Form */}
      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-4">{t.addTitle}</h2>
        <form action={pricingAction}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

            {/* Name */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.ruleName} *<InfoTip text={t.help.ruleName} /></label>
              <input
                name="name"
                required
                placeholder="e.g. Standard Sedan Rate"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Model (+ selects de zona condicionales si es "Por zona") */}
            <PricingModelField t={t} zones={zones ?? []} />

            {/* Vehicle Type */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.vehicleType}<InfoTip text={t.help.vehicleType} /></label>
              <select
                name="vehicle_type_id"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              >
                <option value="">{t.allVehicleTypes}</option>
                {(vehicleTypes ?? []).map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.priority}<InfoTip text={t.help.priority} /></label>
              <input
                name="priority"
                type="number"
                defaultValue="0"
                min="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Base Price */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.basePrice}<InfoTip text={t.help.basePrice} /></label>
              <input
                name="base_price"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Per Mile Rate */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.perMileRate}<InfoTip text={t.help.perMileRate} /></label>
              <input
                name="per_mile_rate"
                type="number"
                step="0.0001"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Per Km Rate */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.perKmRate}<InfoTip text={t.help.perKmRate} /></label>
              <input
                name="per_km_rate"
                type="number"
                step="0.0001"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.hourlyRate}<InfoTip text={t.help.hourlyRate} /></label>
              <input
                name="hourly_rate"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Minimum Fare */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.minimumFare}<InfoTip text={t.help.minimumFare} /></label>
              <input
                name="minimum_fare"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Night Surcharge */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.nightSurcharge}<InfoTip text={t.help.nightSurcharge} /></label>
              <input
                name="night_surcharge_pct"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

            {/* Weekend Surcharge */}
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.weekendSurcharge}<InfoTip text={t.help.weekendSurcharge} /></label>
              <input
                name="weekend_surcharge_pct"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>

          </div>

          <div className="mb-4 pt-4 border-t border-sl-outline-variant/60">
            <PricingAdvancedFields t={t} />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
            >
              {t.addButton}
            </button>
          </div>
        </form>
      </div>

      {/* Rules Table */}
      {!rules || rules.length === 0 ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.empty}</p>
          <p className="mt-1 text-xs text-sl-on-surface-muted">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thRule}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thModel}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thBase}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Min Fare</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thPriority}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thStatus}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {rules.map((rule) => (
                <PricingRuleRow
                  key={rule.id}
                  rule={rule}
                  vehicleTypes={vehicleTypes ?? []}
                  zones={zones ?? []}
                  vtName={rule.vehicle_type_id ? vtMap.get(rule.vehicle_type_id) ?? null : null}
                  t={t}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Feriados: sin esto el "Recargo de feriado" de las reglas nunca aplica */}
      <CompanyHolidays
        holidays={holidays ?? []}
        todayIso={todayIso}
        locale={locale}
        t={t.holidays}
        actions={actions}
      />
    </div>
  )
}
