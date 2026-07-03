import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { createZoneAction } from '@/app/actions/services'
import { ZoneRow } from '@/components/admin/zone-row'
import { ZoneGeoFields } from '@/components/admin/zone-geo-fields'
import { ZonesOverviewMap } from '@/components/admin/zones-overview-map'
import { InfoTip } from '@/components/ui/info-tip'
import { getDict } from '@/lib/i18n/server'

const ZONE_TYPES = ['standard', 'airport', 'premium', 'restricted'] as const

export default async function ZonesPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const isAdmin = user.role === 'company_owner' || user.role === 'company_admin'

  const admin = createAdminClient()
  const { data: zones } = await admin
    .from('service_zones')
    .select('id, name, type, color, radius_miles, center_lat, center_lng, postal_codes, sort_order, is_active, created_at')
    .eq('company_id', user.company_id!)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  // void cast — TypeScript void-callback rule: (fd) => void accepts any return type
  const zoneAction: (fd: FormData) => void = createZoneAction
  const dict = getDict().admin
  const t = dict.zones
  const actions = dict.actions

  return (
    <div className="p-8 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.title}</h1>
          <p className="mt-1 text-sm text-sl-on-surface-muted">
            {t.subtitle}
          </p>
        </div>
        {isAdmin && (
          <span className="text-xs text-sl-on-surface-muted">
            {zones?.length ?? 0} {t.count}
          </span>
        )}
      </div>

      {/* Add Zone Form */}
      {isAdmin && (
        <div className="bg-sl-surface border border-sl-outline-variant rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-sl-on-surface mb-4">{t.addTitle}</h2>
          <form action={zoneAction} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-sl-on-surface-muted mb-1">
                {t.nameLabel}
                <InfoTip text={t.help.name} />
              </label>
              <input
                name="name"
                required
                placeholder={t.namePlaceholder}
                className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              />
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">
                {t.typeLabel}
                <InfoTip text={t.help.type} />
              </label>
              <select
                name="type"
                defaultValue="standard"
                className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
              >
                {ZONE_TYPES.map((zt) => (
                  <option key={zt} value={zt}>{t.types[zt]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-sl-on-surface-muted mb-1">{t.colorLabel}</label>
              <input
                name="color"
                type="color"
                defaultValue="#e9c176"
                className="h-9 w-14 rounded-lg border border-sl-outline-variant bg-sl-bg cursor-pointer"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
            >
              {t.addButton}
            </button>
            <ZoneGeoFields
              labels={{
                radiusLabel: t.radiusLabel,
                radiusPlaceholder: t.radiusPlaceholder,
                radiusHelp: t.help.radius,
                postalCodesLabel: t.postalCodesLabel,
                postalCodesPlaceholder: t.postalCodesPlaceholder,
                postalCodesHelp: t.help.postalCodes,
                mapHint: t.mapHint,
                clearCenter: t.clearCenter,
              }}
            />
          </form>
        </div>
      )}

      {/* Zones Table */}
      {!zones || zones.length === 0 ? (
        <div className="bg-sl-surface border border-sl-outline-variant rounded-xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.empty}</p>
          {isAdmin && (
            <p className="mt-1 text-xs text-sl-on-surface-muted">{t.emptyHint}</p>
          )}
        </div>
      ) : (
        <div className="bg-sl-surface border border-sl-outline-variant rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sl-outline-variant">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thZone}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thType}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thRadius}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thPostalCodes}</th>
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thStatus}</th>
                {isAdmin && (
                  <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-sl-on-surface-muted">{t.thActions}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-sl-outline-variant/40">
              {zones.map((zone) => (
                <ZoneRow key={zone.id} zone={zone} t={t} actions={actions} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {zones && zones.length > 0 && (
        <ZonesOverviewMap zones={zones} labels={{ viewMap: t.viewMap, hideMap: t.hideMap }} />
      )}
    </div>
  )
}
