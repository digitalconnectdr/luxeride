import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { createPricingRuleAction } from '@/app/actions/pricing'
import {
  updateGratuitySettingsAction,
  updateExtraFeesAction,
  updatePolicySettingsAction,
  updateDepositSettingsAction,
} from '@/app/actions/settings'
import { PricingRuleRow } from '@/components/admin/pricing-rule-row'
import { PricingModelField } from '@/components/admin/pricing-model-field'
import { PricingAdvancedFields } from '@/components/admin/pricing-advanced-fields'
import { PricingFaq } from '@/components/admin/pricing-faq'
import { SectionTabs } from '@/components/admin/section-tabs'
import { CompanyHolidays } from '@/components/admin/company-holidays'
import { getLocalTimeParts } from '@/lib/pricing/engine'
import { parsePolicy, parseExtraFees } from '@/lib/policy/engine'
import { getDict, getLocale } from '@/lib/i18n/server'
import { InfoTip } from '@/components/ui/info-tip'

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'
const cardCls = 'bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6'
const saveBtnCls =
  'px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors'

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
      .select('id, name, model, base_price, per_mile_rate, per_km_rate, hourly_rate, minimum_fare, minimum_hours, included_miles, origin_zone_id, destination_zone_id, airport_pickup_fee, airport_dropoff_fee, night_surcharge_pct, weekend_surcharge_pct, holiday_surcharge_pct, surge_enabled, surge_multiplier, valid_from, valid_until, days_of_week, priority, is_active, vehicle_type_id')
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
      .select('timezone, currency, settings')
      .eq('id', user.company_id!)
      .single(),
  ])

  // Map vehicle type id → name for display
  const vtMap = new Map((vehicleTypes ?? []).map((vt) => [vt.id, vt.name]))

  // void casts — TypeScript void-callback rule
  const pricingAction:   (fd: FormData) => void = createPricingRuleAction
  const gratuityAction:  (fd: FormData) => void = updateGratuitySettingsAction
  const extraFeesAction: (fd: FormData) => void = updateExtraFeesAction
  const policyAction:    (fd: FormData) => void = updatePolicySettingsAction
  const depositAction:   (fd: FormData) => void = updateDepositSettingsAction

  const dict = getDict().admin
  const t = dict.pricing
  const actions = dict.actions
  // Las secciones que se mudaron desde Configuración conservan su copy: mover
  // la UI no es motivo para reescribir textos que el operador ya conoce.
  const s = dict.settings

  const settings = (company?.settings as {
    booking?: { require_deposit?: boolean; deposit_percentage?: number }
    gratuity?: { enabled?: boolean; default_percentage?: number }
  }) ?? {}
  const booking = settings.booking ?? {}
  const gratuity = settings.gratuity ?? {}
  const policy = parsePolicy(company?.settings)
  const extraFees = parseExtraFees(company?.settings)
  const currency = company?.currency ?? 'USD'

  // "Hoy" en la zona horaria de la empresa: sirve para marcar feriados ya
  // pasados sin depender del reloj del navegador del operador, que puede
  // estar en otro país.
  const { isoDate: todayIso } = getLocalTimeParts(new Date(), company?.timezone)
  const locale = getLocale()

  // ── Panel: Reglas ───────────────────────────────────────────────────────────
  const rulesPanel = (
    <>
      <PricingFaq t={t.faq} />

      <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-4">{t.addTitle}</h2>
        <form action={pricingAction}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

            {/* Name */}
            <div>
              <label className={labelCls}>{t.ruleName} *<InfoTip text={t.help.ruleName} /></label>
              <input
                name="name"
                required
                placeholder="e.g. Standard Sedan Rate"
                className={inputCls}
              />
            </div>

            {/* Model (+ selects de zona condicionales si es "Por zona") */}
            <PricingModelField t={t} zones={zones ?? []} />

            {/* Vehicle Type */}
            <div>
              <label className={labelCls}>{t.vehicleType}<InfoTip text={t.help.vehicleType} /></label>
              <select name="vehicle_type_id" className={inputCls}>
                <option value="">{t.allVehicleTypes}</option>
                {(vehicleTypes ?? []).map((vt) => (
                  <option key={vt.id} value={vt.id}>{vt.name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className={labelCls}>{t.priority}<InfoTip text={t.help.priority} /></label>
              <input name="priority" type="number" defaultValue="0" min="0" className={inputCls} />
            </div>

            {/* Base Price */}
            <div>
              <label className={labelCls}>{t.basePrice}<InfoTip text={t.help.basePrice} /></label>
              <input name="base_price" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Per Mile Rate */}
            <div>
              <label className={labelCls}>{t.perMileRate}<InfoTip text={t.help.perMileRate} /></label>
              <input name="per_mile_rate" type="number" step="0.0001" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Per Km Rate */}
            <div>
              <label className={labelCls}>{t.perKmRate}<InfoTip text={t.help.perKmRate} /></label>
              <input name="per_km_rate" type="number" step="0.0001" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Hourly Rate */}
            <div>
              <label className={labelCls}>{t.hourlyRate}<InfoTip text={t.help.hourlyRate} /></label>
              <input name="hourly_rate" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Minimum Fare */}
            <div>
              <label className={labelCls}>{t.minimumFare}<InfoTip text={t.help.minimumFare} /></label>
              <input name="minimum_fare" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Night Surcharge */}
            <div>
              <label className={labelCls}>{t.nightSurcharge}<InfoTip text={t.help.nightSurcharge} /></label>
              <input name="night_surcharge_pct" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
            </div>

            {/* Weekend Surcharge */}
            <div>
              <label className={labelCls}>{t.weekendSurcharge}<InfoTip text={t.help.weekendSurcharge} /></label>
              <input name="weekend_surcharge_pct" type="number" step="0.01" min="0" defaultValue="0" className={inputCls} />
            </div>

          </div>

          <div className="mb-4 pt-4 border-t border-sl-outline-variant/60">
            <PricingAdvancedFields t={t} />
          </div>

          <div className="flex justify-end">
            <button type="submit" className={saveBtnCls}>{t.addButton}</button>
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
          <div className="flex items-center justify-between px-6 pt-5 pb-1">
            <h2 className="text-sm font-semibold text-sl-on-surface">{t.title}</h2>
            <span className="text-xs text-sl-on-surface-muted">{rules.length} {t.count}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thRule}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thModel}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thBase}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.minimumFare}</th>
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
    </>
  )

  // ── Panel: Recargos (propinas + cargos extra en viaje) ──────────────────────
  const surchargesPanel = (
    <>
      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-5">{s.gratuityTitle}</h2>
        {booking.require_deposit && (
          <p className="mb-4 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠ {s.gratuityDepositWarning}
          </p>
        )}
        <form action={gratuityAction} className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              name="enabled"
              type="checkbox"
              value="true"
              defaultChecked={gratuity.enabled ?? true}
              className="w-4 h-4 rounded accent-bronze"
            />
            <span className="text-sm text-sl-on-surface">{s.gratuityEnable}</span>
          </label>
          <div className="w-48">
            <label className={labelCls}>{s.gratuityDefault}</label>
            <input
              name="default_percentage"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={gratuity.default_percentage ?? 20}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className={saveBtnCls}>{s.saveGratuity}</button>
          </div>
        </form>
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{s.extraFeesTitle}</h2>
        <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{s.extraFeesDesc}</p>
        <form action={extraFeesAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{s.extraPassengerFee} ({currency})</label>
              <input
                name="extra_passenger_fee"
                type="number"
                min="0"
                max="9999"
                step="0.01"
                defaultValue={extraFees.extra_passenger_fee}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{s.extraLuggageFee} ({currency})</label>
              <input
                name="extra_luggage_fee"
                type="number"
                min="0"
                max="9999"
                step="0.01"
                defaultValue={extraFees.extra_luggage_fee}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-[11px] text-sl-on-surface-muted">{s.extraFeesHint}</p>
          <div className="flex justify-end pt-1">
            <button type="submit" className={saveBtnCls}>{s.saveExtraFees}</button>
          </div>
        </form>
      </section>
    </>
  )

  // ── Panel: Depósito y cancelación ───────────────────────────────────────────
  const policyPanel = (
    <>
      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{t.depositTitle}</h2>
        <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{t.depositDesc}</p>
        <form action={depositAction} className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              name="require_deposit"
              type="checkbox"
              value="true"
              defaultChecked={booking.require_deposit ?? false}
              className="w-4 h-4 rounded accent-bronze"
            />
            <span className="text-sm text-sl-on-surface">{s.requireDeposit}</span>
          </label>
          {booking.require_deposit && (
            <p className="text-[11px] text-sl-on-surface-muted pl-7 -mt-1">{s.requireDepositGratuityNote}</p>
          )}
          <div className="w-48">
            <label className={labelCls}>{s.depositPct}</label>
            <input
              name="deposit_percentage"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={booking.deposit_percentage ?? 0}
              className={inputCls}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className={saveBtnCls}>{t.saveDeposit}</button>
          </div>
        </form>
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-sl-on-surface mb-2">{s.policyTitle}</h2>
        <p className="text-xs text-sl-on-surface-muted mb-5 max-w-[75ch]">{s.policyDesc}</p>
        <form action={policyAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{s.freeCancelHours}</label>
              <input
                name="free_cancellation_hours"
                type="number"
                min="0"
                step="1"
                defaultValue={policy.free_cancellation_hours}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{s.lateCancelPct}</label>
              <input
                name="late_cancellation_fee_pct"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.late_cancellation_fee_pct}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{s.noShowPct}</label>
              <input
                name="no_show_fee_pct"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue={policy.no_show_fee_pct}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{s.noShowGraceMinutes}</label>
              <input
                name="no_show_grace_minutes"
                type="number"
                min="0"
                max="60"
                step="1"
                defaultValue={policy.no_show_grace_minutes}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{s.modificationHours}</label>
              <input
                name="modification_min_hours"
                type="number"
                min="0"
                step="1"
                defaultValue={policy.modification_min_hours}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" className={saveBtnCls}>{s.savePolicy}</button>
          </div>
        </form>
      </section>
    </>
  )

  // ── Panel: Feriados ─────────────────────────────────────────────────────────
  const holidaysPanel = (
    <CompanyHolidays
      holidays={holidays ?? []}
      todayIso={todayIso}
      locale={locale}
      t={t.holidays}
      actions={actions}
    />
  )

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.pageTitle}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted max-w-[75ch]">{t.pageSubtitle}</p>
      </div>

      <SectionTabs
        ariaLabel={t.pageTitle}
        tabs={[
          { key: 'rules',      label: t.tabRules },
          { key: 'surcharges', label: t.tabSurcharges },
          { key: 'policy',     label: t.tabPolicy },
          { key: 'holidays',   label: t.tabHolidays },
        ]}
        panels={{
          rules:      rulesPanel,
          surcharges: surchargesPanel,
          policy:     policyPanel,
          holidays:   holidaysPanel,
        }}
      />
    </div>
  )
}
