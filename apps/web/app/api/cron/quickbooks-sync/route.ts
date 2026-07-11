// -- Cron diario: sincronizar viajes completados con QuickBooks Online -----
// Para cada empresa con QuickBooks conectado y la sincronizacion activada,
// crea un Sales Receipt por cada reserva completada que todavia no se envio.
// Complementa la sincronizacion inmediata (syncQuickBooksNowAction, botón
// "Sincronizar ahora" en /admin/settings) -- este cron es el respaldo para
// lo que el operador no dispare a mano, igual que el resto de los crons.
//
// Programado en vercel.json. Protegido con CRON_SECRET.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncCompletedBookingsForCompany, syncPendingInvoicesForCompany } from '@/lib/quickbooks/sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  const results: { company: string; synced: number; failed: number }[] = []

  const { data: companies } = await admin
    .from('companies')
    .select('id, name')
    .eq('quickbooks_sync_enabled', true)
    .not('quickbooks_realm_id', 'is', null)

  for (const company of companies ?? []) {
    try {
      const bookingResult = await syncCompletedBookingsForCompany(admin, company.id)
      const invoiceResult = await syncPendingInvoicesForCompany(admin, company.id)
      const combined = {
        synced: bookingResult.synced + invoiceResult.synced,
        failed: bookingResult.failed + invoiceResult.failed,
      }
      if (combined.synced > 0 || combined.failed > 0) {
        results.push({ company: company.name, ...combined })
      }
    } catch (err) {
      console.error(`[cron/quickbooks-sync] company ${company.id}`, err)
    }
  }

  return NextResponse.json({ ok: true, companies: results })
}
