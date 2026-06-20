import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { DriverAvailabilityToggle } from '@/components/admin/fleet-controls'
import { UpdateDriverLicenseForm } from '@/components/admin/update-driver-license-form'
import { getDict, getLocale } from '@/lib/i18n/server'

const LOCALE_TAGS: Record<string, string> = { en: 'en-US', es: 'es-MX', pt: 'pt-BR' }

export function generateMetadata(): Metadata {
  return { title: getDict().admin.driverDetail.title }
}

interface PageProps {
  params: { id: string }
}

export default async function DriverDetailPage({ params }: PageProps) {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher', 'accounting')
  const companyId = user.company_id!
  const admin = createAdminClient()
  const t = getDict().admin.driverDetail
  const localeTag = LOCALE_TAGS[getLocale()] ?? 'en-US'

  // ── Queries separadas con manejo individual de errores ─────────────────────
  const profileQuery = admin
    .from('user_profiles')
    .select('id, first_name, last_name, phone, is_active, created_at')
    .eq('id', params.id)
    .eq('company_id', companyId)          // IDOR guard
    .eq('role', 'driver')
    .single()

  const driverQuery = admin
    .from('drivers')
    .select('id, license_number, license_expiry, license_state, current_vehicle_id, is_available, rating, total_trips, total_earnings')
    .eq('id', params.id)
    .eq('company_id', companyId)          // IDOR guard
    .single()

  type ProfileData = Awaited<typeof profileQuery>['data']
  type DriverData  = Awaited<typeof driverQuery>['data']

  let profile: ProfileData = null
  let dr: DriverData = null

  try {
    const { data, error } = await profileQuery
    if (error) {
      console.error('[drivers/[id]/page] user_profiles query error:', JSON.stringify(error))
    }
    profile = data
  } catch (err) {
    console.error('[drivers/[id]/page] user_profiles query THREW:', err)
  }

  try {
    const { data, error } = await driverQuery
    if (error) {
      // PGRST116 = no rows found — expected when driver record doesn't exist yet
      if ((error as { code?: string }).code !== 'PGRST116') {
        console.error('[drivers/[id]/page] drivers query error:', JSON.stringify(error))
      }
    }
    dr = data
  } catch (err) {
    console.error('[drivers/[id]/page] drivers query THREW:', err)
  }

  if (!profile) notFound()

  // Current vehicle (if any)
  let currentVehicle: { id: string; make: string; model: string; year: number; plate_number: string } | null = null
  if (dr?.current_vehicle_id) {
    try {
      const { data: v, error } = await admin
        .from('vehicles')
        .select('id, make, model, year, plate_number')
        .eq('id', dr.current_vehicle_id)
        .eq('company_id', companyId)
        .single()
      if (error && (error as { code?: string }).code !== 'PGRST116') {
        console.error('[drivers/[id]/page] vehicles query error:', JSON.stringify(error))
      }
      currentVehicle = v ?? null
    } catch (err) {
      console.error('[drivers/[id]/page] vehicles query THREW:', err)
    }
  }

  const isAccounting = user.role === 'accounting'
  const today        = new Date()

  function formatDate(iso: string | null | undefined) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString(localeTag, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const licenseExpiry  = dr?.license_expiry ? new Date(dr.license_expiry) : null
  const licenseExpired = licenseExpiry ? licenseExpiry < today : false
  const licenseExpiring = licenseExpiry
    ? !licenseExpired && licenseExpiry < new Date(today.getTime() + 30 * 86_400_000)
    : false

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-6">

      {/* Header */}
      <div>
        <nav className="text-xs text-sl-on-surface-muted mb-2">
          <Link href="/admin/drivers" className="hover:text-sl-on-surface transition-colors">{t.breadcrumb}</Link>
          <span className="mx-1.5">›</span>
          <span className="text-sl-on-surface">{profile.first_name} {profile.last_name}</span>
        </nav>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-semibold text-bronze">
              {profile.first_name?.[0]}{profile.last_name?.[0]}
            </span>
          </div>
          <div>
            <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
              {profile.first_name} {profile.last_name}
            </h1>
            {profile.phone && (
              <p className="text-sm text-sl-on-surface-muted mt-0.5">{profile.phone}</p>
            )}
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            profile.is_active
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40'
          }`}>
            {profile.is_active ? t.active : t.inactive}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Availability + Stats ── */}
        <div className="space-y-4">

          {/* Availability */}
          {dr && !isAccounting && (
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                {t.availability}
              </p>
              <DriverAvailabilityToggle driverId={dr.id} isAvailable={dr.is_available} labels={getDict().admin.fleet.availability} saving={getDict().admin.fleet.saving} />
            </div>
          )}

          {/* Stats */}
          {dr && (
            <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                {t.stats}
              </p>
              <dl className="space-y-2.5">
                {[
                  { label: t.totalTrips, value: dr.total_trips?.toLocaleString(localeTag) ?? '0' },
                  { label: t.rating,
                    value: dr.rating != null ? `★ ${Number(dr.rating).toFixed(2)}` : '—' },
                  { label: t.earnings,
                    value: dr.total_earnings != null
                      ? `$${Number(dr.total_earnings).toLocaleString(localeTag, { minimumFractionDigits: 2 })}`
                      : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-baseline gap-2">
                    <dt className="text-xs text-sl-on-surface-muted">{label}</dt>
                    <dd className="text-xs font-medium text-sl-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* ── License + Vehicle ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Current Vehicle */}
          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
              {t.currentVehicle}
            </p>
            {currentVehicle ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-sl-on-surface">
                    {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                  </p>
                  <p className="text-xs text-sl-on-surface-muted">{currentVehicle.plate_number}</p>
                </div>
                <Link
                  href={`/admin/fleet/${currentVehicle.id}`}
                  className="text-xs text-bronze hover:text-bronze/80 transition-colors"
                >
                  {t.viewVehicle}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-sl-on-surface-muted">{t.noVehicle}</p>
            )}
          </div>

          {/* License info */}
          <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
                {t.licenseTitle}
              </p>
              {(licenseExpired || licenseExpiring) && (
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  licenseExpired
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}>
                  {licenseExpired ? t.licenseExpired : t.licenseExpiring}
                </span>
              )}
            </div>

            {dr ? (
              <dl className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: t.licenseNumber, value: dr.license_number ?? '—', expiry: false },
                  { label: t.licenseState,  value: dr.license_state ?? '—',  expiry: false },
                  { label: t.expires,       value: formatDate(dr.license_expiry), expiry: true },
                ].map(({ label, value, expiry }) => (
                  <div key={label} className="space-y-0.5">
                    <dt className="text-[10px] text-sl-on-surface-muted uppercase tracking-wider">{label}</dt>
                    <dd className={`text-sm ${expiry && licenseExpired ? 'text-red-400 font-medium' : 'text-sl-on-surface'}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-sl-on-surface-muted mb-4">{t.noLicenseRecord}</p>
            )}

            {/* Edit form — shown to owner/admin only */}
            {!isAccounting && user.role !== 'dispatcher' && (
              <UpdateDriverLicenseForm
                driverId={profile.id}
                current={{
                  license_number: dr?.license_number ?? '',
                  license_expiry: dr?.license_expiry ?? '',
                  license_state:  dr?.license_state ?? '',
                }}
                labels={t}
              />
            )}
          </div>

        </div>
      </div>

      {/* Footer meta */}
      <p className="text-xs text-sl-on-surface-muted">
        {t.registeredOn.replace('{date}', formatDate(profile.created_at))}
      </p>
    </div>
  )
}
