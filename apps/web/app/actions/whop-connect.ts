'use server'
// ── Whop Connect — Server Actions (Parte B) ────────────────────────────────────
// Mismo patrón que app/actions/payments.ts (Stripe Connect): onboarding vía
// account link + refresco de estado. El operador elige Stripe O Whop para
// cobrarle a sus pasajeros — conectar uno no desconecta el otro.

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getWhopClient, getWhopParentCompanyId, isWhopConnectConfigured } from '@/lib/whop/connect-server'
import { getAppUrl } from '@/lib/app-url'

const APP_URL = getAppUrl()

type ActionResult = { success: boolean; error?: string }

// ─── Onboarding: crear/reutilizar la sub-cuenta y generar el link de KYC ──────

export async function createWhopConnectOnboardingAction(): Promise<void> {
  const user = await requireRole('company_owner')
  if (!user.company_id) redirect('/admin/settings?whop_error=no_company')

  const client = getWhopClient()
  if (!client || !isWhopConnectConfigured()) redirect('/admin/settings?whop_error=not_configured')

  let onboardingUrl: string | null = null
  let errorCode = 'connect_failed'

  try {
    const admin = createAdminClient()
    const { data: company } = await admin
      .from('companies')
      .select('id, name, email, whop_connect_company_id')
      .eq('id', user.company_id)
      .single()

    if (company) {
      if (!company.email) {
        errorCode = 'email_required'
      } else {
        let connectedId = company.whop_connect_company_id

        if (!connectedId) {
          const created = await client.companies.create({
            title: company.name,
            email: company.email,
            parent_company_id: getWhopParentCompanyId(),
            metadata: { luxeride_company_id: company.id },
          })
          connectedId = created.id
          await admin
            .from('companies')
            .update({ whop_connect_company_id: connectedId })
            .eq('id', company.id)
        }

        const link = await client.accountLinks.create({
          company_id: connectedId,
          refresh_url: `${APP_URL}/admin/settings?whop_connect=refresh`,
          return_url: `${APP_URL}/admin/settings?whop_connect=return`,
          use_case: 'account_onboarding',
        })
        onboardingUrl = link.url
      }
    }
  } catch (err) {
    console.error('[createWhopConnectOnboardingAction]', err)
  }

  if (onboardingUrl) redirect(onboardingUrl)
  redirect(`/admin/settings?whop_error=${errorCode}`)
}

// ─── Refrescar estado de onboarding ────────────────────────────────────────────

export async function refreshWhopConnectStatusAction(): Promise<ActionResult> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const client = getWhopClient()
  if (!client) return { success: false, error: 'Whop no está configurado' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('whop_connect_company_id, active_payment_provider, stripe_connect_onboarded')
    .eq('id', user.company_id)
    .single()

  if (!company?.whop_connect_company_id) {
    return { success: false, error: 'No hay cuenta de Whop conectada' }
  }

  try {
    const account = await client.companies.retrieve(company.whop_connect_company_id)
    // Ver nota en lib/whop/connect-server.ts: `verified` es el mejor proxy
    // disponible por ahora — falta confirmar en vivo que equivale a "listo
    // para recibir pagos" (Whop no expone un campo tipo charges_enabled).
    const onboarded = Boolean(account.verified)

    // Si Whop termina de habilitarse y la empresa todavía no tiene un riel
    // activo explícito (o Stripe nunca se conectó), Whop pasa a ser el
    // proveedor activo automáticamente — evita que quede "conectado" en
    // este panel pero sin poder cobrar por no haber una elección explícita.
    const shouldActivateWhop =
      onboarded && !company.active_payment_provider && !company.stripe_connect_onboarded

    await admin
      .from('companies')
      .update({
        whop_connect_onboarded: onboarded,
        ...(shouldActivateWhop ? { active_payment_provider: 'whop' } : {}),
      })
      .eq('id', user.company_id)
  } catch (err) {
    console.error('[refreshWhopConnectStatusAction]', err)
    return { success: false, error: 'No se pudo consultar el estado en Whop' }
  }

  revalidatePath('/admin/settings')
  return { success: true }
}

// ─── Elegir cuál riel de pago está activo para cobrar a los pasajeros ─────────

export async function setActivePaymentProviderAction(provider: 'stripe' | 'whop'): Promise<ActionResult> {
  const user = await requireRole('company_owner')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('stripe_connect_onboarded, whop_connect_onboarded')
    .eq('id', user.company_id)
    .single()

  if (provider === 'stripe' && !company?.stripe_connect_onboarded) {
    return { success: false, error: 'Termina de conectar Stripe primero' }
  }
  if (provider === 'whop' && !company?.whop_connect_onboarded) {
    return { success: false, error: 'Termina de conectar Whop primero' }
  }

  const { error } = await admin
    .from('companies')
    .update({ active_payment_provider: provider })
    .eq('id', user.company_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/settings')
  return { success: true }
}
