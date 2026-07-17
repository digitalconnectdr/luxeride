import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { NewBookingForm } from './new-booking-form'
import { getDict } from '@/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: getDict().admin.bookingNew.title }
}

export default async function NewBookingPage() {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  const t = getDict().admin.bookingNew

  if (!user.company_id) {
    return (
      <div className="p-8">
        <p className="text-sm text-sl-on-surface-muted">{getDict().admin.bookingsList.noCompany}</p>
      </div>
    )
  }

  const admin = createAdminClient()

  const [{ data: vehicleTypes }, { data: drivers }, { data: corporateAccounts }] = await Promise.all([
    admin
      .from('vehicle_types')
      .select('id, name, class, capacity')
      .eq('company_id', user.company_id)
      .eq('is_active', true)
      .order('sort_order'),
    admin
      .from('user_profiles')
      .select('id, first_name, last_name')
      .eq('company_id', user.company_id)
      .eq('role', 'driver')
      .eq('is_active', true)
      .order('first_name'),
    admin
      .from('corporate_accounts')
      .select('id, name')
      .eq('company_id', user.company_id)
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.title}</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">
          {t.subtitle}
        </p>
      </div>
      <div className="max-w-2xl">
        <NewBookingForm
          vehicleTypes={vehicleTypes ?? []}
          drivers={drivers ?? []}
          corporateAccounts={corporateAccounts ?? []}
          labels={t}
        />
      </div>
    </div>
  )
}
