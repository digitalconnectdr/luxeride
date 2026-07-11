// ── Cron diario: Compliance Center (Sección J) ─────────────────────────────────
// 1. Recalcula compliance_status/score/bloqueo para todos los conductores,
//    vehículos y empresas — captura vencimientos puros por el paso del tiempo
//    (nadie tocó el registro, pero la fecha ya pasó). Mismo cálculo que se
//    corre al editar un campo (lib/compliance/recompute.ts).
// 2. Avisa por email lo que vence dentro de 30 días: conductor (permiso
//    chauffeur), operador (permiso for-hire/seguro de vehículo, licencia
//    operativa/seguro de la empresa).
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notify, sendOperatorEmail } from '@/lib/notifications'
import {
  recomputeDriverCompliance,
  recomputeVehicleCompliance,
  recomputeCompanyCompliance,
} from '@/lib/compliance/recompute'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WINDOW_DAYS = 30
const BATCH_LIMIT = 500

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const limit = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)

  // ── 1. Recalcular compliance (conductores → vehículos → empresas) ─────────
  const { data: driverIds } = await admin.from('drivers').select('id').limit(BATCH_LIMIT)
  for (const d of driverIds ?? []) {
    await recomputeDriverCompliance(admin, d.id)
  }

  const { data: vehicleIds } = await admin.from('vehicles').select('id').limit(BATCH_LIMIT)
  for (const v of vehicleIds ?? []) {
    await recomputeVehicleCompliance(admin, v.id)
  }

  const { data: companyIds } = await admin.from('companies').select('id').limit(BATCH_LIMIT)
  for (const c of companyIds ?? []) {
    await recomputeCompanyCompliance(admin, c.id)
  }

  let emailsSent = 0

  async function driverEmail(driverId: string): Promise<string | null> {
    try {
      const { data } = await admin.auth.admin.getUserById(driverId)
      return data.user?.email ?? null
    } catch {
      return null
    }
  }

  // ── 2a. Permiso chauffeur del conductor por vencer ─────────────────────────
  const { data: expiringDrivers } = await admin
    .from('drivers')
    .select('id, company_id, chauffeur_permit_expires_at')
    .gte('chauffeur_permit_expires_at', today)
    .lte('chauffeur_permit_expires_at', limit)
    .limit(BATCH_LIMIT)

  for (const d of expiringDrivers ?? []) {
    if (!d.chauffeur_permit_expires_at) continue
    const email = await driverEmail(d.id)
    if (!email) continue
    const result = await notify({
      companyId: d.company_id,
      channel: 'email',
      type: 'driver_document_expiring',
      recipient: email,
      userId: d.id,
      vars: {
        document_type: 'permiso chauffeur/for-hire',
        expiry_date: new Date(d.chauffeur_permit_expires_at).toLocaleDateString('es-DO'),
      },
    })
    if (result.sent) emailsSent += 1
  }

  // ── 2b. Permiso for-hire / seguro del vehículo por vencer ──────────────────
  const { data: expiringVehicles } = await admin
    .from('vehicles')
    .select('id, company_id, make, model, plate_number, forhire_permit_expires_at, insurance_expires_at')
    .or(
      `and(forhire_permit_expires_at.gte.${today},forhire_permit_expires_at.lte.${limit}),and(insurance_expires_at.gte.${today},insurance_expires_at.lte.${limit})`,
    )
    .limit(BATCH_LIMIT)

  for (const v of expiringVehicles ?? []) {
    const items: string[] = []
    if (v.forhire_permit_expires_at && v.forhire_permit_expires_at >= today && v.forhire_permit_expires_at <= limit) {
      items.push(`Permiso for-hire vence el ${new Date(v.forhire_permit_expires_at).toLocaleDateString('es-DO')}`)
    }
    if (v.insurance_expires_at && v.insurance_expires_at >= today && v.insurance_expires_at <= limit) {
      items.push(`Seguro vence el ${new Date(v.insurance_expires_at).toLocaleDateString('es-DO')}`)
    }
    if (!items.length) continue
    const result = await sendOperatorEmail(
      v.company_id,
      `Vencimiento próximo | ${v.make} ${v.model} (${v.plate_number})`,
      `${v.make} ${v.model} (${v.plate_number}):\n${items.join('\n')}\n\nActualiza estos datos en el Compliance Center para evitar el bloqueo operativo del vehículo.`,
    )
    if (result.sent) emailsSent += 1
  }

  // ── 2c. Licencia operativa / seguro comercial de la empresa por vencer ─────
  const { data: expiringCompanies } = await admin
    .from('companies')
    .select('id, name, operating_license_expires_at, commercial_insurance_expires_at')
    .or(
      `and(operating_license_expires_at.gte.${today},operating_license_expires_at.lte.${limit}),and(commercial_insurance_expires_at.gte.${today},commercial_insurance_expires_at.lte.${limit})`,
    )
    .limit(BATCH_LIMIT)

  for (const c of expiringCompanies ?? []) {
    const items: string[] = []
    if (c.operating_license_expires_at && c.operating_license_expires_at >= today && c.operating_license_expires_at <= limit) {
      items.push(`Licencia operativa vence el ${new Date(c.operating_license_expires_at).toLocaleDateString('es-DO')}`)
    }
    if (c.commercial_insurance_expires_at && c.commercial_insurance_expires_at >= today && c.commercial_insurance_expires_at <= limit) {
      items.push(`Seguro comercial vence el ${new Date(c.commercial_insurance_expires_at).toLocaleDateString('es-DO')}`)
    }
    if (!items.length) continue
    const result = await sendOperatorEmail(
      c.id,
      `Vencimiento próximo | ${c.name}`,
      `${items.join('\n')}\n\nActualiza estos datos en el Compliance Center (/admin/compliance).`,
    )
    if (result.sent) emailsSent += 1
  }

  return NextResponse.json({
    ok: true,
    driversRecomputed: driverIds?.length ?? 0,
    vehiclesRecomputed: vehicleIds?.length ?? 0,
    companiesRecomputed: companyIds?.length ?? 0,
    emailsSent,
  })
}
