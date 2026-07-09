import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { getDict, getLocale } from '@/lib/i18n/server'
import { IncomingRequestCard, type IncomingRequest, type DriverOption, type VehicleOption } from '@/components/admin/affiliates/incoming-request-card'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-DO', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().affiliates.requests.title }
}

export default async function AffiliateRequestsPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().affiliates
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'
  if (!user.company_id) return null
  const companyId = user.company_id

  const admin = createAdminClient()
  const [{ data: trips }, { data: drivers }, { data: vehicles }] = await Promise.all([
    admin
      .from('affiliate_trips')
      .select('id, company_affiliate_id, owner_company_id, status, reason, branding_mode, preview_zone, preview_scheduled_at, preview_vehicle_type, preview_passenger_count, preview_distance_miles, offered_price, expires_at, driver_id, vehicle_id, settlement_status, settlement_method, settlement_notes')
      .eq('affiliate_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100),
    admin.from('user_profiles').select('id, first_name, last_name').eq('company_id', companyId).eq('role', 'driver').eq('is_active', true).order('first_name'),
    admin.from('vehicles').select('id, make, model, plate_number').eq('company_id', companyId).order('make'),
  ])

  const ownerIds = Array.from(new Set((trips ?? []).map((tr) => tr.owner_company_id)))
  const { data: owners } = ownerIds.length
    ? await admin.from('companies').select('id, name').in('id', ownerIds)
    : { data: [] as { id: string; name: string }[] }
  const ownerNameById = new Map((owners ?? []).map((c) => [c.id, c.name]))

  const driverOptions: DriverOption[] = (drivers ?? []).map((d) => ({ id: d.id, name: `${d.first_name} ${d.last_name}` }))
  const vehicleOptions: VehicleOption[] = (vehicles ?? []).map((v) => ({ id: v.id, label: `${v.make} ${v.model} — ${v.plate_number}` }))

  const requests: IncomingRequest[] = (trips ?? []).map((tr) => ({
    id: tr.id,
    companyAffiliateId: tr.company_affiliate_id,
    ownerName: ownerNameById.get(tr.owner_company_id) ?? '—',
    status: tr.status,
    reason: tr.reason,
    zone: tr.preview_zone,
    scheduledAt: tr.preview_scheduled_at,
    vehicleType: tr.preview_vehicle_type,
    passengerCount: tr.preview_passenger_count,
    distanceMiles: tr.preview_distance_miles != null ? Number(tr.preview_distance_miles) : null,
    offeredPrice: Number(tr.offered_price),
    expiresAt: tr.expires_at,
    driverId: tr.driver_id,
    vehicleId: tr.vehicle_id,
    settlementStatus: tr.settlement_status,
    settlementMethod: tr.settlement_method,
    settlementNotes: tr.settlement_notes,
  }))

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-playfair font-semibold text-sl-on-surface">{t.requests.title}</h1>
        <p className="mt-1 text-sm text-sl-on-surface-muted">{t.requests.subtitle}</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.requests.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <IncomingRequestCard key={r.id} request={r} drivers={driverOptions} vehicles={vehicleOptions} localeTag={localeTag} myCompanyId={companyId} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}
