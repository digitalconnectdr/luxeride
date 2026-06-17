'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import type { VehicleStatus, VehicleClass } from '@/lib/supabase/database.types'

export type FleetActionResult = {
  success: boolean
  error?: string
  id?: string
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Sube la foto del tipo de vehículo al bucket "branding" y devuelve la URL
// pública (o un objeto de error). Devuelve undefined si no hay archivo.
async function uploadVehicleImage(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  typeId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (file.size > 5_000_000) return { error: 'La imagen no puede superar 5 MB.' }
  const ext = MIME_EXT[file.type]
  if (!ext) return { error: 'Formato no válido. Usa PNG, JPG o WebP.' }
  const path = `${companyId}/vehicle-${typeId}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from('branding')
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (upErr) {
    console.error('[uploadVehicleImage]', upErr)
    return { error: 'Error al subir la imagen.' }
  }
  const { data: pub } = admin.storage.from('branding').getPublicUrl(path)
  return { url: `${pub.publicUrl}?v=${Date.now()}` }
}

// ── Vehicle Types ─────────────────────────────────────────────────────────────

export async function createVehicleTypeAction(
  _prev: FleetActionResult | null,
  formData: FormData
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company associated' }

  const name    = (formData.get('name') as string ?? '').trim()
  const cls     = formData.get('class') as VehicleClass
  const capacity = parseInt(formData.get('capacity') as string, 10)
  const raw     = (formData.get('amenities') as string ?? '').trim()
  const amenities = raw ? raw.split(',').map((a) => a.trim()).filter(Boolean) : []

  if (!name || !cls || isNaN(capacity) || capacity < 1) {
    return { success: false, error: 'Name, class and capacity are required' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vehicle_types')
    .insert({ company_id: user.company_id, name, class: cls, capacity, amenities, is_active: true })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Imagen opcional al crear
  const image = formData.get('image') as File | null
  if (image && image.size > 0) {
    const up = await uploadVehicleImage(admin, user.company_id, data.id, image)
    if (up.url) await admin.from('vehicle_types').update({ base_image_url: up.url }).eq('id', data.id)
  }

  revalidatePath('/admin/fleet')
  revalidatePath('/book', 'layout')
  return { success: true, id: data.id }
}

export async function updateVehicleTypeAction(
  typeId: string,
  _prev: FleetActionResult | null,
  formData: FormData
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company' }

  const name     = (formData.get('name') as string ?? '').trim()
  const cls      = formData.get('class') as VehicleClass
  const capacity = parseInt(formData.get('capacity') as string, 10)
  const raw      = (formData.get('amenities') as string ?? '').trim()
  const amenities = raw ? raw.split(',').map((a) => a.trim()).filter(Boolean) : []

  if (!name || !cls || isNaN(capacity) || capacity < 1) {
    return { success: false, error: 'Name, class and capacity are required' }
  }

  const admin = createAdminClient()
  // IDOR guard
  const { data: type } = await admin
    .from('vehicle_types')
    .select('company_id')
    .eq('id', typeId)
    .single()
  if (type?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  const updates: { name: string; class: VehicleClass; capacity: number; amenities: string[]; base_image_url?: string | null } = {
    name, class: cls, capacity, amenities,
  }
  const image = formData.get('image') as File | null
  if (formData.get('remove_image') === 'true') {
    updates.base_image_url = null
  } else if (image && image.size > 0) {
    const up = await uploadVehicleImage(admin, user.company_id, typeId, image)
    if (up.error) return { success: false, error: up.error }
    updates.base_image_url = up.url
  }

  const { error } = await admin
    .from('vehicle_types')
    .update(updates)
    .eq('id', typeId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/fleet')
  revalidatePath('/book', 'layout') // refrescar el micrositio del operador
  return { success: true }
}

export async function deleteVehicleTypeAction(
  typeId: string
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()
  const { data: type } = await admin
    .from('vehicle_types')
    .select('company_id')
    .eq('id', typeId)
    .single()
  if (type?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  // No se puede eliminar si hay vehículos usando este tipo
  const { count } = await admin
    .from('vehicles')
    .select('id', { count: 'exact', head: true })
    .eq('vehicle_type_id', typeId)

  if ((count ?? 0) > 0) {
    return { success: false, error: 'IN_USE' }
  }

  const { error } = await admin.from('vehicle_types').delete().eq('id', typeId)
  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/fleet')
  return { success: true }
}

export async function toggleVehicleTypeActive(
  typeId: string,
  isActive: boolean
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()
  const { data: type } = await admin
    .from('vehicle_types')
    .select('company_id')
    .eq('id', typeId)
    .single()

  if (type?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  const { error } = await admin
    .from('vehicle_types')
    .update({ is_active: isActive })
    .eq('id', typeId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/fleet')
  return { success: true }
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

export async function createVehicleAction(
  _prev: FleetActionResult | null,
  formData: FormData
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company associated' }

  const vehicle_type_id    = (formData.get('vehicle_type_id') as string ?? '').trim() || null
  const make               = (formData.get('make') as string ?? '').trim()
  const model              = (formData.get('model') as string ?? '').trim()
  const year               = parseInt(formData.get('year') as string, 10)
  const color              = (formData.get('color') as string ?? '').trim() || null
  const plate_number       = (formData.get('plate_number') as string ?? '').trim()
  const vin                = (formData.get('vin') as string ?? '').trim() || null
  const mileageRaw         = formData.get('mileage') as string
  const mileage            = mileageRaw ? parseInt(mileageRaw, 10) : null
  const next_maintenance_at   = (formData.get('next_maintenance_at') as string ?? '') || null
  const insurance_expires_at  = (formData.get('insurance_expires_at') as string ?? '') || null
  const notes              = (formData.get('notes') as string ?? '').trim() || null

  if (!make || !model || isNaN(year) || !plate_number) {
    return { success: false, error: 'Make, model, year and plate number are required' }
  }

  const admin = createAdminClient()

  // IDOR guard: if vehicle_type_id provided, verify it belongs to this company
  if (vehicle_type_id) {
    const { data: vtype } = await admin
      .from('vehicle_types')
      .select('company_id')
      .eq('id', vehicle_type_id)
      .single()

    if (vtype?.company_id !== user.company_id) {
      return { success: false, error: 'Invalid vehicle type' }
    }
  }

  const { data, error } = await admin
    .from('vehicles')
    .insert({
      company_id: user.company_id,
      vehicle_type_id,
      make,
      model,
      year,
      color,
      plate_number,
      vin,
      status: 'available',
      mileage,
      next_maintenance_at,
      insurance_expires_at,
      notes,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/fleet')
  return { success: true, id: data.id }
}

export async function updateVehicleStatus(
  vehicleId: string,
  status: VehicleStatus
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()
  const { data: vehicle } = await admin
    .from('vehicles')
    .select('company_id')
    .eq('id', vehicleId)
    .single()

  if (vehicle?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  const { error } = await admin
    .from('vehicles')
    .update({ status })
    .eq('id', vehicleId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/fleet')
  revalidatePath(`/admin/fleet/${vehicleId}`)
  return { success: true }
}

export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string | null
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()

  const { data: vehicle } = await admin
    .from('vehicles')
    .select('company_id, current_driver_id')
    .eq('id', vehicleId)
    .single()

  if (vehicle?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  // IDOR guard: verify new driver belongs to same company
  if (driverId) {
    const { data: driver } = await admin
      .from('drivers')
      .select('company_id')
      .eq('id', driverId)
      .single()
    if (driver?.company_id !== user.company_id) return { success: false, error: 'Invalid driver' }
  }

  // Clear previous driver's vehicle assignment
  if (vehicle.current_driver_id) {
    await admin
      .from('drivers')
      .update({ current_vehicle_id: null })
      .eq('id', vehicle.current_driver_id)
  }

  // Update vehicle
  await admin
    .from('vehicles')
    .update({ current_driver_id: driverId })
    .eq('id', vehicleId)

  // Update new driver
  if (driverId) {
    await admin
      .from('drivers')
      .update({ current_vehicle_id: vehicleId })
      .eq('id', driverId)
  }

  revalidatePath('/admin/fleet')
  revalidatePath(`/admin/fleet/${vehicleId}`)
  revalidatePath('/admin/drivers')
  return { success: true }
}

// ── Drivers ───────────────────────────────────────────────────────────────────

export async function toggleDriverAvailability(
  driverId: string,
  isAvailable: boolean
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin', 'dispatcher')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers')
    .select('company_id')
    .eq('id', driverId)
    .single()

  if (driver?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  const { error } = await admin
    .from('drivers')
    .update({ is_available: isAvailable })
    .eq('id', driverId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/drivers')
  revalidatePath(`/admin/drivers/${driverId}`)
  return { success: true }
}

// useFormState-compatible with .bind(null, driverId):
// bound call becomes (_prev, formData) => Promise<FleetActionResult>
export async function updateDriverLicense(
  driverId: string,
  _prev: FleetActionResult | null,
  formData: FormData
): Promise<FleetActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'No company' }

  const admin = createAdminClient()
  const { data: driver } = await admin
    .from('drivers')
    .select('company_id')
    .eq('id', driverId)
    .single()

  if (driver?.company_id !== user.company_id) return { success: false, error: 'Not found' }

  const license_number = (formData.get('license_number') as string ?? '').trim() || null
  const license_state  = (formData.get('license_state')  as string ?? '').trim() || null
  const license_expiry = (formData.get('license_expiry') as string ?? '') || null

  const { error } = await admin
    .from('drivers')
    .update({ license_number, license_state, license_expiry })
    .eq('id', driverId)

  if (error) return { success: false, error: error.message }
  revalidatePath(`/admin/drivers/${driverId}`)
  return { success: true }
}
