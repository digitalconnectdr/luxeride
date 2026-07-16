import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { ZoneRow } from '@/components/admin/zone-row'
import { AddZoneForm } from '@/components/admin/add-zone-form'
import { ZonesOverviewMap } from '@/components/admin/zones-overview-map'
import { getDict } from '@/lib/i18n/server'

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
          <AddZoneForm t={t} />
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
          <div className="overflow-x-auto">
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
        </div>
      )}

      {zones && zones.length > 0 && (
        <ZonesOverviewMap zones={zones} labels={{ viewMap: t.viewMap, hideMap: t.hideMap }} />
      )}
    </div>
  )
}
