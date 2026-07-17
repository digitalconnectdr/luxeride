import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { addCompanyAirportAction, createCustomAirportAction } from '@/app/actions/services'
import { AirportRow } from '@/components/admin/airport-row'
import { getDict } from '@/lib/i18n/server'
import { InfoTip } from '@/components/ui/info-tip'

export default async function AirportsPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const isAdmin = user.role === 'company_owner' || user.role === 'company_admin'

  const admin = createAdminClient()

  // Two separate queries — avoids Supabase FK-relation type resolution
  const [{ data: companyAirports }, { data: allAirports }] = await Promise.all([
    admin
      .from('company_airports')
      .select('id, airport_id, pickup_fee, dropoff_fee, is_active')
      .eq('company_id', user.company_id!)
      .order('created_at', { ascending: true }),
    admin
      .from('airports')
      .select('id, iata_code, name, city, state, country')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('city', { ascending: true }),
  ])

  // Build a lookup map and compute which airports haven't been added yet
  const airportsMap = Object.fromEntries((allAirports ?? []).map((a) => [a.id, a]))
  const addedAirportIds = new Set((companyAirports ?? []).map((ca) => ca.airport_id))
  const notAddedAirports = (allAirports ?? []).filter((a) => !addedAirportIds.has(a.id))

  // void cast — TypeScript void-callback rule
  const airportAction: (fd: FormData) => void = addCompanyAirportAction
  const customAirportAction: (fd: FormData) => void = createCustomAirportAction
  const dict = getDict().admin
  const t = dict.airports
  const actions = dict.actions

  const fieldCls =
    'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
    'placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

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
        {isAdmin && (
          <span className="text-xs text-sl-on-surface-muted">
            {companyAirports?.length ?? 0} {t.configured}
          </span>
        )}
      </div>

      {/* Add Airport Form */}
      {isAdmin && notAddedAirports.length > 0 && (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-sl-on-surface mb-4">{t.addTitle}</h2>
          <form action={airportAction} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.airportLabel}</label>
              <select
                name="airport_id"
                required
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              >
                <option value="">{t.selectPlaceholder}</option>
                {notAddedAirports.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.iata_code} | {a.name} ({a.city}, {a.country})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.pickupFee}<InfoTip text={t.pickupFeeHelp} /></label>
              <input
                name="pickup_fee"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-24 text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.dropoffFee}<InfoTip text={t.dropoffFeeHelp} /></label>
              <input
                name="dropoff_fee"
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-24 text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
            >
              {t.addButton}
            </button>
          </form>
        </div>
      )}

      {/* Crear aeropuerto fuera del catálogo */}
      {isAdmin && (
        <details className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm group">
          <summary className="px-5 py-4 text-sm font-medium text-bronze cursor-pointer list-none hover:text-bronze/80 transition-colors">
            ✈ {t.custom.toggle}
          </summary>
          <div className="px-5 pb-5">
            <p className="text-xs text-sl-on-surface-muted mb-4">{t.custom.hint}</p>
            <form action={customAirportAction} className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.custom.iata} *</label>
                <input name="iata_code" required maxLength={3} placeholder="SDQ" className={`w-20 uppercase ${fieldCls}`} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.custom.name} *</label>
                <input name="airport_name" required placeholder="Las Américas International" className={`w-full ${fieldCls}`} />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.custom.city} *</label>
                <input name="city" required placeholder="Santo Domingo" className={`w-36 ${fieldCls}`} />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.custom.country} *</label>
                <input name="country" required maxLength={2} placeholder="DO" className={`w-16 uppercase ${fieldCls}`} />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.pickupFee}</label>
                <input name="pickup_fee" type="number" step="0.01" min="0" defaultValue="0" className={`w-24 ${fieldCls}`} />
              </div>
              <div>
                <label className="block text-xs text-sl-on-surface-muted mb-1">{t.dropoffFee}</label>
                <input name="dropoff_fee" type="number" step="0.01" min="0" defaultValue="0" className={`w-24 ${fieldCls}`} />
              </div>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
              >
                {t.custom.create}
              </button>
            </form>
          </div>
        </details>
      )}

      {/* Airports Table */}
      {!companyAirports || companyAirports.length === 0 ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.empty}</p>
          {isAdmin && (
            <p className="mt-1 text-xs text-sl-on-surface-muted">{t.emptyHint}</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold/20">
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thAirport}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thPickup}</th>
                <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thDropoff}</th>
                <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thStatus}</th>
                {isAdmin && (
                  <th className="text-right px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thActions}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/50">
              {companyAirports.map((ca) => (
                <AirportRow
                  key={ca.id}
                  ca={ca}
                  airport={airportsMap[ca.airport_id] ?? null}
                  t={t}
                  actions={actions}
                  isAdmin={isAdmin}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
