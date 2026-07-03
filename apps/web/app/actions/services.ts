'use server'
// ── F1.5 — Services, Zones & Airports: Server Actions ─────────────────────────
// SECURITY: All mutations require company_owner or company_admin role.
// OWASP compliant — inputs validated, company_id always from server session.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

// ─── Service Zones ────────────────────────────────────────────────────────────

export async function createZoneAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name = (formData.get('name') as string ?? '').trim()
  const type = (formData.get('type') as string ?? 'standard').trim()
  const color = (formData.get('color') as string ?? '#e9c176').trim()
  const radiusRaw = parseFloat(formData.get('radius_miles') as string)
  const radius = isNaN(radiusRaw) || radiusRaw <= 0 ? null : radiusRaw
  const postalCodes = [...new Set(formData.getAll('postal_codes').map((v) => String(v).trim()).filter(Boolean))]
  const centerLatRaw = parseFloat(formData.get('center_lat') as string)
  const centerLngRaw = parseFloat(formData.get('center_lng') as string)
  const centerLat = Number.isFinite(centerLatRaw) ? centerLatRaw : null
  const centerLng = Number.isFinite(centerLngRaw) ? centerLngRaw : null

  if (!name) return { success: false, error: 'Nombre requerido' }

  const admin = createAdminClient()
  const { error } = await admin.from('service_zones').insert({
    company_id: user.company_id,
    name,
    type,
    color,
    radius_miles: radius,
    postal_codes: postalCodes,
    center_lat: centerLat,
    center_lng: centerLng,
  })

  if (error) {
    console.error('[createZoneAction]', error)
    return { success: false, error: 'Error al crear la zona' }
  }

  revalidatePath('/admin/zones')
  return { success: true }
}

export async function updateZoneAction(
  zoneId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name = (formData.get('name') as string ?? '').trim()
  const type = (formData.get('type') as string ?? '').trim()
  const color = (formData.get('color') as string ?? '').trim()
  const radiusRaw = parseFloat(formData.get('radius_miles') as string)
  const radius = isNaN(radiusRaw) || radiusRaw <= 0 ? null : radiusRaw
  const postalCodes = [...new Set(formData.getAll('postal_codes').map((v) => String(v).trim()).filter(Boolean))]
  const centerLatRaw = parseFloat(formData.get('center_lat') as string)
  const centerLngRaw = parseFloat(formData.get('center_lng') as string)
  const centerLat = Number.isFinite(centerLatRaw) ? centerLatRaw : null
  const centerLng = Number.isFinite(centerLngRaw) ? centerLngRaw : null

  if (!name) return { success: false, error: 'Nombre requerido' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_zones')
    .update({ name, type: type || undefined, color: color || undefined, radius_miles: radius, postal_codes: postalCodes, center_lat: centerLat, center_lng: centerLng })
    .eq('id', zoneId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[updateZoneAction]', error)
    return { success: false, error: 'Error al actualizar la zona' }
  }

  revalidatePath('/admin/zones')
  return { success: true }
}

export async function toggleZoneActiveAction(
  zoneId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_zones')
    .update({ is_active: isActive })
    .eq('id', zoneId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[toggleZoneActiveAction]', error)
    return { success: false, error: 'Error al actualizar estado' }
  }

  revalidatePath('/admin/zones')
  return { success: true }
}

export async function deleteZoneAction(
  zoneId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_zones')
    .delete()
    .eq('id', zoneId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[deleteZoneAction]', error)
    return { success: false, error: 'Error al eliminar la zona' }
  }

  revalidatePath('/admin/zones')
  return { success: true }
}

// ─── Company Airports (link airports to company with custom fees) ─────────────

export async function addCompanyAirportAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const airportId = (formData.get('airport_id') as string ?? '').trim()
  const pickupFee  = parseFloat(formData.get('pickup_fee') as string ?? '0') || 0
  const dropoffFee = parseFloat(formData.get('dropoff_fee') as string ?? '0') || 0

  if (!airportId) return { success: false, error: 'Aeropuerto requerido' }

  const admin = createAdminClient()
  const { error } = await admin.from('company_airports').insert({
    company_id:  user.company_id,
    airport_id:  airportId,
    pickup_fee:  pickupFee,
    dropoff_fee: dropoffFee,
  })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Este aeropuerto ya está configurado' }
    console.error('[addCompanyAirportAction]', error)
    return { success: false, error: 'Error al agregar el aeropuerto' }
  }

  revalidatePath('/admin/airports')
  return { success: true }
}

export async function updateAirportFeeAction(
  id: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const pickupFee  = parseFloat(formData.get('pickup_fee') as string ?? '0') || 0
  const dropoffFee = parseFloat(formData.get('dropoff_fee') as string ?? '0') || 0

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_airports')
    .update({ pickup_fee: pickupFee, dropoff_fee: dropoffFee })
    .eq('id', id)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[updateAirportFeeAction]', error)
    return { success: false, error: 'Error al actualizar las tarifas' }
  }

  revalidatePath('/admin/airports')
  return { success: true }
}

export async function toggleAirportActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_airports')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[toggleAirportActiveAction]', error)
    return { success: false, error: 'Error al actualizar estado' }
  }

  revalidatePath('/admin/airports')
  return { success: true }
}

export async function removeCompanyAirportAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_airports')
    .delete()
    .eq('id', id)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[removeCompanyAirportAction]', error)
    return { success: false, error: 'Error al eliminar el aeropuerto' }
  }

  revalidatePath('/admin/airports')
  return { success: true }
}

// ─── Crear aeropuerto personalizado (catálogo + vínculo a la empresa) ─────────
// El catálogo de airports es global; permitimos a los admins agregar los que
// falten (validando IATA único) y queda vinculado de una vez con sus cargos.

export async function createCustomAirportAction(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const iata = ((formData.get('iata_code') as string) ?? '').trim().toUpperCase()
  const name = ((formData.get('airport_name') as string) ?? '').trim().slice(0, 120)
  const city = ((formData.get('city') as string) ?? '').trim().slice(0, 80)
  const country = ((formData.get('country') as string) ?? '').trim().toUpperCase().slice(0, 2)
  const pickupFee = parseFloat(formData.get('pickup_fee') as string ?? '0') || 0
  const dropoffFee = parseFloat(formData.get('dropoff_fee') as string ?? '0') || 0

  if (!/^[A-Z]{3}$/.test(iata)) {
    return { success: false, error: 'El código IATA debe tener exactamente 3 letras (ej. SDQ)' }
  }
  if (!name) return { success: false, error: 'Nombre del aeropuerto requerido' }
  if (!city) return { success: false, error: 'Ciudad requerida' }
  if (!/^[A-Z]{2}$/.test(country)) {
    return { success: false, error: 'País debe ser el código de 2 letras (ej. US, DO, BR)' }
  }

  const admin = createAdminClient()

  // ¿Ya existe en el catálogo global? Reusarlo en vez de duplicar
  const { data: existing } = await admin
    .from('airports')
    .select('id')
    .eq('iata_code', iata)
    .maybeSingle()

  let airportId = existing?.id

  if (!airportId) {
    const { data: created, error: createErr } = await admin
      .from('airports')
      .insert({ iata_code: iata, name, city, country })
      .select('id')
      .single()

    if (createErr || !created) {
      console.error('[createCustomAirportAction]', createErr)
      return { success: false, error: 'Error al crear el aeropuerto' }
    }
    airportId = created.id
  }

  const { error: linkErr } = await admin.from('company_airports').insert({
    company_id: user.company_id,
    airport_id: airportId,
    pickup_fee: pickupFee,
    dropoff_fee: dropoffFee,
  })

  if (linkErr) {
    if (linkErr.code === '23505') {
      return { success: false, error: 'Ese aeropuerto ya está agregado a tu empresa' }
    }
    console.error('[createCustomAirportAction] link', linkErr)
    return { success: false, error: 'Error al vincular el aeropuerto' }
  }

  revalidatePath('/admin/airports')
  return { success: true }
}
