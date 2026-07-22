// ── Cron diario: Compliance Center (Sección J) + vencimientos generales ────────
// 1. Recalcula compliance_status/score/bloqueo para todos los conductores,
//    vehículos y empresas — captura vencimientos puros por el paso del tiempo
//    (nadie tocó el registro, pero la fecha ya pasó). Mismo cálculo que se
//    corre al editar un campo (lib/compliance/recompute.ts).
// 2. Conductor: UN solo email por conductor con TODO lo que venza dentro de
//    30 días (documentos genéricos de la tabla `documents`, licencia de
//    conducir, permiso chauffeur/for-hire) — antes esto vivía repartido en dos
//    crons separados (document-alerts a las 11am + compliance-alerts a las
//    2pm), lo que podía mandarle al mismo conductor dos avisos de "algo vence"
//    el mismo día. Se fusionó aquí; document-alerts se eliminó.
// 3. Vehículo/empresa: permiso for-hire/seguro y licencia operativa/seguro
//    comercial por vencer (sin cambios).
// Protegido con CRON_SECRET. Programado en vercel.json.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { notify, sendOperatorEmail } from '@/lib/notifications'
import { pushAdminNotification, cleanupOldAdminNotifications } from '@/lib/notifications/admin-feed'
import {
  recomputeDriverCompliance,
  recomputeVehicleCompliance,
  recomputeCompanyCompliance,
} from '@/lib/compliance/recompute'

// Mismo umbral que el badge visual de /admin/fleet (maintenanceAlert()) —
// el aviso en la campana debe reflejar exactamente lo mismo que ya se ve ahí.
const MAINTENANCE_WINDOW_DAYS = 14
const DEDUP_DAYS = 14

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
    const result = await recomputeCompanyCompliance(admin, c.id)
    if (result?.alert) {
      await pushAdminNotification({
        companyId: c.id,
        type: 'compliance_alert',
        title: 'Alerta de cumplimiento en tu empresa',
        detail: 'Revisa el Compliance Center — hay datos o vencimientos que requieren atención.',
        href: '/admin/compliance',
        sourceTable: 'companies',
        sourceId: c.id,
        dedupDays: DEDUP_DAYS,
      })
    }
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

  // ── 2. Vencimientos de conductor: un email por conductor con todo lo que
  // venza (documentos genéricos + licencia + permiso chauffeur/for-hire) ─────
  const expiringByDriver = new Map<string, { companyId: string; items: { label: string; date: string }[] }>()

  function addDriverItem(driverId: string, companyId: string, label: string, date: string) {
    const entry = expiringByDriver.get(driverId) ?? { companyId, items: [] }
    entry.items.push({ label, date })
    expiringByDriver.set(driverId, entry)
  }

  const { data: genericDocs } = await admin
    .from('documents')
    .select('driver_id, company_id, type, expires_at')
    .not('driver_id', 'is', null)
    .gte('expires_at', today)
    .lte('expires_at', limit)
    .limit(BATCH_LIMIT)

  for (const doc of genericDocs ?? []) {
    if (!doc.driver_id || !doc.expires_at) continue
    addDriverItem(doc.driver_id, doc.company_id, doc.type.replace(/_/g, ' '), doc.expires_at)
  }

  const { data: expiringDrivers } = await admin
    .from('drivers')
    .select('id, company_id, license_expiry, chauffeur_permit_expires_at')
    .or(
      `and(license_expiry.gte.${today},license_expiry.lte.${limit}),and(chauffeur_permit_expires_at.gte.${today},chauffeur_permit_expires_at.lte.${limit})`,
    )
    .limit(BATCH_LIMIT)

  for (const d of expiringDrivers ?? []) {
    if (d.license_expiry && d.license_expiry >= today && d.license_expiry <= limit) {
      addDriverItem(d.id, d.company_id, 'licencia de conducir', d.license_expiry)
    }
    if (d.chauffeur_permit_expires_at && d.chauffeur_permit_expires_at >= today && d.chauffeur_permit_expires_at <= limit) {
      addDriverItem(d.id, d.company_id, 'permiso chauffeur/for-hire', d.chauffeur_permit_expires_at)
    }
  }

  for (const [driverId, { companyId, items }] of expiringByDriver) {
    const email = await driverEmail(driverId)
    if (!email) continue
    const sorted = items.slice().sort((a, b) => a.date.localeCompare(b.date))
    const documentType = sorted
      .map((i) => `${i.label} (vence ${new Date(i.date).toLocaleDateString('es-DO')})`)
      .join('; ')
    const result = await notify({
      companyId,
      channel: 'email',
      type: 'driver_document_expiring',
      recipient: email,
      userId: driverId,
      vars: {
        document_type: documentType,
        expiry_date: new Date(sorted[0].date).toLocaleDateString('es-DO'),
      },
    })
    if (result.sent) emailsSent += 1
  }

  // ── 3. Permiso for-hire / seguro del vehículo por vencer ──────────────────
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

  // ── 3b. Mismo aviso que el badge de /admin/fleet, ahora también en la
  // campana del panel admin (14 días, next_maintenance_at o insurance_expires_at) ──
  const maintenanceLimit = new Date(Date.now() + MAINTENANCE_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const { data: maintenanceVehicles } = await admin
    .from('vehicles')
    .select('id, company_id, make, model, plate_number, next_maintenance_at, insurance_expires_at')
    .or(
      `and(next_maintenance_at.gte.${today},next_maintenance_at.lte.${maintenanceLimit}),and(insurance_expires_at.gte.${today},insurance_expires_at.lte.${maintenanceLimit})`,
    )
    .limit(BATCH_LIMIT)

  for (const v of maintenanceVehicles ?? []) {
    const isDue =
      (!!v.next_maintenance_at && v.next_maintenance_at >= today && v.next_maintenance_at <= maintenanceLimit) ||
      (!!v.insurance_expires_at && v.insurance_expires_at >= today && v.insurance_expires_at <= maintenanceLimit)
    if (!isDue) continue
    await pushAdminNotification({
      companyId: v.company_id,
      type: 'vehicle_maintenance',
      title: `Mantenimiento/seguro por vencer: ${v.make} ${v.model}`,
      detail: `Placa ${v.plate_number}`,
      href: '/admin/fleet',
      sourceTable: 'vehicles',
      sourceId: v.id,
      dedupDays: DEDUP_DAYS,
    })
  }

  // ── 4. Licencia operativa / seguro comercial de la empresa por vencer ─────
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

  // Purga avisos de la campana admin de más de 30 días (la campana solo
  // muestra 7 — evita que la tabla crezca sin límite con muchas empresas).
  await cleanupOldAdminNotifications()

  return NextResponse.json({
    ok: true,
    driversRecomputed: driverIds?.length ?? 0,
    vehiclesRecomputed: vehicleIds?.length ?? 0,
    companiesRecomputed: companyIds?.length ?? 0,
    driversNotified: expiringByDriver.size,
    emailsSent,
  })
}
