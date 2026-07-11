'use server'
// ── QuickBooks Online — Server Actions ─────────────────────────────────────────
// Mismo espiritu que app/actions/payments.ts / whop-connect.ts (el operador
// conecta SU PROPIA cuenta), pero el mecanismo es OAuth2 real (ver
// lib/quickbooks/server.ts) en vez de account links — por eso el paso de
// intercambio de codigo vive en app/api/quickbooks/callback/route.ts, no aqui.

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { buildAuthorizeUrl, isQuickBooksConfigured } from '@/lib/quickbooks/server'
import { syncCompletedBookingsForCompany } from '@/lib/quickbooks/sync'
import { QUICKBOOKS_CALLBACK_PATH, QUICKBOOKS_OAUTH_STATE_COOKIE } from '@/lib/quickbooks/oauth-constants'
import { getAppUrl } from '@/lib/app-url'

const APP_URL = getAppUrl()

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

// ─── Iniciar conexion (redirige a la pantalla de autorizacion de Intuit) ──────

export async function createQuickBooksOnboardingAction(): Promise<void> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) redirect('/admin/settings?quickbooks_error=no_company')
  if (!isQuickBooksConfigured()) redirect('/admin/settings?quickbooks_error=not_configured')

  // CSRF: state aleatorio guardado en cookie httpOnly de corta duracion,
  // verificado en el callback antes de intercambiar el codigo.
  const state = randomUUID()
  cookies().set(QUICKBOOKS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const url = buildAuthorizeUrl({
    redirectUri: `${APP_URL}${QUICKBOOKS_CALLBACK_PATH}`,
    state,
  })
  redirect(url)
}

// ─── Desconectar ───────────────────────────────────────────────────────────────

export async function disconnectQuickBooksAction(): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('companies')
    .update({
      quickbooks_realm_id: null,
      quickbooks_access_token: null,
      quickbooks_refresh_token: null,
      quickbooks_token_expires_at: null,
      quickbooks_connected_at: null,
      quickbooks_sync_enabled: false,
      quickbooks_item_id: null,
    })
    .eq('id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/settings')
  return { success: true }
}

// ─── Activar/desactivar la sincronizacion automatica (cron diario) ────────────

export async function setQuickBooksSyncEnabledAction(enabled: boolean): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('quickbooks_realm_id')
    .eq('id', user.company_id)
    .single()
  if (enabled && !company?.quickbooks_realm_id) {
    return { success: false, error: 'Conecta QuickBooks primero' }
  }

  const { error } = await admin
    .from('companies')
    .update({ quickbooks_sync_enabled: enabled })
    .eq('id', user.company_id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/admin/settings')
  return { success: true }
}

// ─── Sincronizar ahora (manual) ────────────────────────────────────────────────
// El cron diario (limite del plan Hobby de Vercel) cubre el caso de "olvidarse
// de sincronizar", pero un operador que acaba de conectar QuickBooks no
// debería esperar hasta 24h para ver su primer viaje reflejado — mismo criterio
// que el auto-farm de la Red de Afiliados (siempre un camino inmediato + cron
// de respaldo).

export async function syncQuickBooksNowAction(): Promise<ActionResult<{ synced: number; failed: number }>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  try {
    const result = await syncCompletedBookingsForCompany(admin, user.company_id)
    revalidatePath('/admin/settings')
    return { success: true, data: result }
  } catch (err) {
    console.error('[syncQuickBooksNowAction]', err)
    return { success: false, error: 'No se pudo sincronizar con QuickBooks' }
  }
}
