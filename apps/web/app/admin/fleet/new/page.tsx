import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { NewVehicleForm } from '@/components/admin/new-vehicle-form'
import { getDict } from '@/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: getDict().admin.vehicleNew.title }
}

export default async function NewVehiclePage() {
  const user = await requireRole('company_owner', 'company_admin')
  const companyId = user.company_id!
  const t = getDict().admin.vehicleNew
  const fleetLabel = getDict().admin.fleet.title

  const admin = createAdminClient()
  const { data: types } = await admin
    .from('vehicle_types')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <nav className="text-xs text-sl-on-surface-muted mb-1">
          <Link href="/admin/fleet" className="hover:text-sl-on-surface transition-colors">
            {fleetLabel}
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-sl-on-surface">{t.title}</span>
        </nav>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">{t.heading}</h1>
      </div>

      <div className="max-w-4xl">
        <NewVehicleForm types={types ?? []} labels={t} />
      </div>
    </div>
  )
}
