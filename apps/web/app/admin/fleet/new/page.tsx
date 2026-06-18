import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { NewVehicleForm } from '@/components/admin/new-vehicle-form'

export const metadata: Metadata = { title: 'Nuevo Vehículo' }

export default async function NewVehiclePage() {
  const user = await requireRole('company_owner', 'company_admin')
  const companyId = user.company_id!

  const admin = createAdminClient()
  const { data: types } = await admin
    .from('vehicle_types')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <nav className="text-xs text-sl-on-surface-muted mb-1">
          <Link href="/admin/fleet" className="hover:text-sl-on-surface transition-colors">
            Fleet
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-sl-on-surface">Nuevo Vehículo</span>
        </nav>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Agregar Vehículo</h1>
      </div>

      <NewVehicleForm types={types ?? []} />
    </div>
  )
}
