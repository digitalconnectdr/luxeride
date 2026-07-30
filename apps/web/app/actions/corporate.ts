'use server'
// ── F1.11 — Corporate Accounts: Server Actions ────────────────────────────────
// SECURITY: company_id siempre del servidor. Solo owner/admin gestionan cuentas.

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { getDefaultRoute } from '@/lib/auth/permissions'

type ActionResult<T = undefined> = { success: boolean; error?: string; data?: T }

// ─── Crear cuenta corporativa ─────────────────────────────────────────────────

export async function createCorporateAccountAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) return { success: false, error: 'Nombre de la cuenta requerido' }

  const contactName  = (formData.get('contact_name') as string ?? '').trim() || null
  const contactEmail = (formData.get('contact_email') as string ?? '').trim() || null
  const billingEmail = (formData.get('billing_email') as string ?? '').trim() || null
  const phone        = (formData.get('phone') as string ?? '').trim() || null
  const taxId        = (formData.get('tax_id') as string ?? '').trim() || null
  const creditLimit  = parseFloat(formData.get('credit_limit') as string ?? '0') || 0
  const paymentTerms = parseInt(formData.get('payment_terms') as string ?? '30', 10) || 30
  const billingCycle = (formData.get('billing_cycle') as string) || 'monthly'
  const requireApproval = formData.get('require_approval') === 'true'

  if (!['weekly', 'bi_weekly', 'monthly'].includes(billingCycle)) {
    return { success: false, error: 'Ciclo de facturación inválido' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('corporate_accounts')
    .insert({
      company_id: user.company_id,
      name,
      contact_name: contactName,
      contact_email: contactEmail,
      billing_email: billingEmail,
      phone,
      tax_id: taxId,
      credit_limit: creditLimit,
      payment_terms: paymentTerms,
      billing_cycle: billingCycle,
      require_approval: requireApproval,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[createCorporateAccountAction]', error)
    return { success: false, error: 'Error al crear la cuenta corporativa' }
  }

  revalidatePath('/admin/corporate')
  return { success: true, data: { id: data.id } }
}

// ─── Actualizar cuenta corporativa ────────────────────────────────────────────

export async function updateCorporateAccountAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const accountId = formData.get('account_id') as string
  if (!accountId) return { success: false, error: 'Cuenta no especificada' }

  const name = (formData.get('name') as string ?? '').trim()
  if (!name) return { success: false, error: 'Nombre requerido' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('corporate_accounts')
    .update({
      name,
      contact_name:  (formData.get('contact_name') as string ?? '').trim() || null,
      contact_email: (formData.get('contact_email') as string ?? '').trim() || null,
      billing_email: (formData.get('billing_email') as string ?? '').trim() || null,
      phone:         (formData.get('phone') as string ?? '').trim() || null,
      tax_id:        (formData.get('tax_id') as string ?? '').trim() || null,
      credit_limit:  parseFloat(formData.get('credit_limit') as string ?? '0') || 0,
      payment_terms: parseInt(formData.get('payment_terms') as string ?? '30', 10) || 30,
      require_approval: formData.get('require_approval') === 'true',
    })
    .eq('id', accountId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[updateCorporateAccountAction]', error)
    return { success: false, error: 'Error al actualizar la cuenta' }
  }

  revalidatePath('/admin/corporate')
  revalidatePath(`/admin/corporate/${accountId}`)
  return { success: true }
}

// ─── Activar / desactivar cuenta ──────────────────────────────────────────────

export async function toggleCorporateAccountAction(
  accountId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('corporate_accounts')
    .update({ is_active: isActive })
    .eq('id', accountId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[toggleCorporateAccountAction]', error)
    return { success: false, error: 'Error al cambiar el estado' }
  }

  revalidatePath('/admin/corporate')
  revalidatePath(`/admin/corporate/${accountId}`)
  return { success: true }
}

// ─── Agregar miembro (por email de usuario existente) ─────────────────────────

export async function addCorporateMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const accountId = formData.get('account_id') as string
  const email     = (formData.get('email') as string ?? '').trim().toLowerCase()
  const role      = (formData.get('role') as string) === 'manager' ? 'manager' : 'user'
  const spendingLimit = parseFloat(formData.get('spending_limit') as string ?? '') || null
  const monthlyLimit  = parseFloat(formData.get('monthly_limit') as string ?? '') || null
  const costCenter    = (formData.get('cost_center') as string ?? '').trim() || null

  if (!accountId) return { success: false, error: 'Cuenta no especificada' }
  if (!email)     return { success: false, error: 'Email requerido' }

  const admin = createAdminClient()

  // Verificar que la cuenta pertenece a la empresa
  const { data: account } = await admin
    .from('corporate_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('company_id', user.company_id)
    .single()

  if (!account) return { success: false, error: 'Cuenta corporativa no encontrada' }

  // Buscar el usuario por email en auth (vía listUsers no es eficiente — usamos user_profiles + auth admin)
  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (authErr) {
    console.error('[addCorporateMemberAction] listUsers', authErr)
    return { success: false, error: 'Error al buscar el usuario' }
  }

  const authUser = authUsers.users.find((u) => u.email?.toLowerCase() === email)
  if (!authUser) {
    return {
      success: false,
      error: 'No existe un usuario con ese email todavía. Usa "Invitar por link" para que la persona cree su propio acceso.',
    }
  }

  // El perfil debe ser de la misma empresa
  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, company_id, role')
    .eq('id', authUser.id)
    .single()

  if (!profile || profile.company_id !== user.company_id) {
    return { success: false, error: 'El usuario no pertenece a esta empresa' }
  }

  const { error } = await admin.from('corporate_members').insert({
    company_id: user.company_id,
    corporate_account_id: accountId,
    user_id: authUser.id,
    role,
    spending_limit: spendingLimit,
    monthly_limit: monthlyLimit,
    cost_center: costCenter,
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'El usuario ya es miembro de esta cuenta' }
    }
    console.error('[addCorporateMemberAction]', error)
    return { success: false, error: 'Error al agregar el miembro' }
  }

  // Promover el rol del usuario a corporate si era customer
  if (profile.role === 'customer') {
    await admin
      .from('user_profiles')
      .update({ role: role === 'manager' ? 'corporate_manager' : 'corporate_user' })
      .eq('id', authUser.id)
  }

  revalidatePath(`/admin/corporate/${accountId}`)
  return { success: true }
}

// ─── Quitar miembro ───────────────────────────────────────────────────────────

export async function removeCorporateMemberAction(
  memberId: string,
): Promise<ActionResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('corporate_members')
    .select('id, corporate_account_id')
    .eq('id', memberId)
    .eq('company_id', user.company_id)
    .single()

  if (!member) return { success: false, error: 'Miembro no encontrado' }

  const { error } = await admin
    .from('corporate_members')
    .delete()
    .eq('id', memberId)

  if (error) {
    console.error('[removeCorporateMemberAction]', error)
    return { success: false, error: 'Error al quitar el miembro' }
  }

  revalidatePath(`/admin/corporate/${member.corporate_account_id}`)
  return { success: true }
}

// ─── Autogestión: el manager corporativo ajusta el límite de SU equipo ────────
// (distinto de addCorporateMemberAction/removeCorporateMemberAction, que son
// para el staff del operador — aquí quien llama es el cliente corporativo).

export async function updateCorporateMemberLimitsAction(
  memberId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole('corporate_manager')

  const admin = createAdminClient()

  // El manager solo puede editar miembros de SU PROPIA cuenta corporativa.
  const { data: managerMembership } = await admin
    .from('corporate_members')
    .select('corporate_account_id')
    .eq('user_id', user.id)
    .eq('role', 'manager')
    .eq('is_active', true)
    .single()

  if (!managerMembership) return { success: false, error: 'No eres manager de ninguna cuenta corporativa' }

  const { data: target } = await admin
    .from('corporate_members')
    .select('id, user_id, corporate_account_id')
    .eq('id', memberId)
    .eq('corporate_account_id', managerMembership.corporate_account_id)
    .single()

  if (!target) return { success: false, error: 'Miembro no encontrado en tu cuenta' }
  if (target.user_id === user.id) {
    return { success: false, error: 'No puedes ajustar tu propio límite' }
  }

  const rawSpending = (formData.get('spending_limit') as string ?? '').trim()
  const rawMonthly  = (formData.get('monthly_limit') as string ?? '').trim()
  const spendingLimit = rawSpending ? parseFloat(rawSpending) : null
  const monthlyLimit  = rawMonthly ? parseFloat(rawMonthly) : null

  if (rawSpending && (!Number.isFinite(spendingLimit) || spendingLimit! < 0)) {
    return { success: false, error: 'Límite por viaje inválido' }
  }
  if (rawMonthly && (!Number.isFinite(monthlyLimit) || monthlyLimit! < 0)) {
    return { success: false, error: 'Límite mensual inválido' }
  }
  if (spendingLimit != null && monthlyLimit != null && spendingLimit > monthlyLimit) {
    return { success: false, error: 'El límite por viaje no puede ser mayor que el límite mensual' }
  }

  // Guardrail: lo asignado entre todo el equipo no puede exceder el crédito
  // total que el operador le otorgó a la cuenta.
  if (monthlyLimit != null) {
    const { data: account } = await admin
      .from('corporate_accounts')
      .select('credit_limit')
      .eq('id', managerMembership.corporate_account_id)
      .single()

    const creditLimit = Number(account?.credit_limit ?? 0)
    if (creditLimit > 0) {
      const { data: others } = await admin
        .from('corporate_members')
        .select('monthly_limit')
        .eq('corporate_account_id', managerMembership.corporate_account_id)
        .eq('is_active', true)
        .not('monthly_limit', 'is', null)
        .neq('id', memberId)

      const othersTotal = (others ?? []).reduce((sum, m) => sum + Number(m.monthly_limit ?? 0), 0)
      if (othersTotal + monthlyLimit > creditLimit) {
        const available = Math.max(0, creditLimit - othersTotal)
        return {
          success: false,
          error: `Excede el crédito de la cuenta. Disponible para asignar: $${available.toFixed(2)} de $${creditLimit.toFixed(2)}.`,
        }
      }
    }
  }

  const { error } = await admin
    .from('corporate_members')
    .update({ spending_limit: spendingLimit, monthly_limit: monthlyLimit })
    .eq('id', memberId)

  if (error) {
    console.error('[updateCorporateMemberLimitsAction]', error)
    return { success: false, error: 'Error al actualizar el límite' }
  }

  revalidatePath('/corporate/dashboard')
  return { success: true }
}

// ── Onboarding por link (alternativa a addCorporateMemberAction) ──────────────
// addCorporateMemberAction exige que el invitado YA tenga cuenta LuxeRide. Esta
// alternativa clona el patrón capability-URL ya establecido para afiliados
// externos (affiliate_invite_tokens, app/actions/affiliates.ts): un token de
// un solo uso, sin políticas RLS propias (solo se toca vía service-role).
// Puede generarla tanto el operador como el propio manager corporativo — el
// verdadero salto de "onboarding más fácil" es que el cliente arme su equipo
// sin esperar a soporte.

const CORPORATE_INVITE_EXPIRY_DAYS = 7

export async function createCorporateMemberInviteAction(
  accountId: string,
  formData: FormData,
): Promise<ActionResult<{ token: string }>> {
  const user = await requireRole('company_owner', 'company_admin', 'corporate_manager')

  const admin = createAdminClient()

  if (user.role === 'corporate_manager') {
    // El manager solo puede invitar a SU PROPIA cuenta — mismo guardrail de
    // auto-scoping que updateCorporateMemberLimitsAction.
    const { data: membership } = await admin
      .from('corporate_members')
      .select('corporate_account_id')
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .eq('is_active', true)
      .single()
    if (!membership || membership.corporate_account_id !== accountId) {
      return { success: false, error: 'No eres manager de esta cuenta corporativa' }
    }
  } else {
    if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }
    const { data: account } = await admin
      .from('corporate_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('company_id', user.company_id)
      .single()
    if (!account) return { success: false, error: 'Cuenta corporativa no encontrada' }
  }

  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email) return { success: false, error: 'Email requerido' }

  const role = (formData.get('role') as string) === 'manager' ? 'manager' : 'user'
  const spendingLimit = parseFloat(formData.get('spending_limit') as string ?? '') || null
  const monthlyLimit  = parseFloat(formData.get('monthly_limit') as string ?? '') || null
  const costCenter    = (formData.get('cost_center') as string ?? '').trim() || null

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + CORPORATE_INVITE_EXPIRY_DAYS * 86_400_000)

  const { error } = await admin.from('corporate_invite_tokens').insert({
    corporate_account_id: accountId,
    token,
    email,
    role,
    spending_limit: spendingLimit,
    monthly_limit: monthlyLimit,
    cost_center: costCenter,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
  })
  if (error) {
    console.error('[createCorporateMemberInviteAction]', error)
    return { success: false, error: 'Error al crear la invitación' }
  }

  revalidatePath(`/admin/corporate/${accountId}`)
  revalidatePath('/corporate/dashboard')
  return { success: true, data: { token } }
}

export interface CorporateInvitePreview {
  accountName: string
  companyName: string
  role: 'manager' | 'user'
  email: string
  valid: boolean
  /** true si ese email ya tiene cuenta LuxeRide — la página de alta salta el formulario de contraseña. */
  accountExists: boolean
}

/** Lectura pública (sin sesión) para que la página de alta muestre el contexto de la invitación. */
export async function getCorporateInvitePreviewAction(token: string): Promise<CorporateInvitePreview | null> {
  if (!token) return null
  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('corporate_invite_tokens')
    .select('corporate_account_id, email, role, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return null

  const { data: account } = await admin
    .from('corporate_accounts')
    .select('name, company_id')
    .eq('id', invite.corporate_account_id)
    .maybeSingle()
  const { data: company } = account?.company_id
    ? await admin.from('companies').select('name').eq('id', account.company_id).maybeSingle()
    : { data: null }

  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const accountExists = !!authUsers?.users.some((u) => u.email?.toLowerCase() === invite.email.toLowerCase())

  return {
    accountName: account?.name ?? '—',
    companyName: company?.name ?? '—',
    role: invite.role,
    email: invite.email,
    valid: !invite.used_at && new Date(invite.expires_at).getTime() > Date.now(),
    accountExists,
  }
}

/**
 * Acepta la invitación — el token es la única autorización, mismo patrón que
 * joinAsExternalAffiliateAction. Si el email ya tiene cuenta LuxeRide, NO se
 * crea una cuenta duplicada ni se pide password nueva (riesgo de seguridad):
 * se agrega la membresía directo y se redirige a login. Si no existe, se crea
 * de una vez y se inicia sesión automáticamente.
 */
export async function acceptCorporateInviteAction(
  token: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  if (!token) return { success: false, error: 'Enlace inválido' }

  const admin = createAdminClient()
  const { data: invite } = await admin
    .from('corporate_invite_tokens')
    .select('id, corporate_account_id, email, role, spending_limit, monthly_limit, cost_center, used_at, expires_at')
    .eq('token', token)
    .maybeSingle()
  if (!invite) return { success: false, error: 'Enlace inválido' }
  if (invite.used_at) return { success: false, error: 'Este enlace de invitación ya fue usado' }
  if (new Date(invite.expires_at).getTime() < Date.now()) return { success: false, error: 'Este enlace de invitación expiró' }

  const { data: account } = await admin
    .from('corporate_accounts')
    .select('company_id')
    .eq('id', invite.corporate_account_id)
    .single()
  if (!account) return { success: false, error: 'Cuenta corporativa no encontrada' }

  const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) {
    console.error('[acceptCorporateInviteAction] listUsers', listErr)
    return { success: false, error: 'Error al procesar la invitación' }
  }
  const existingUser = authUsers.users.find((u) => u.email?.toLowerCase() === invite.email.toLowerCase())

  let userId: string

  if (existingUser) {
    // Cuenta ya existente — el token autoriza el acceso, no se pide password.
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id, company_id, role')
      .eq('id', existingUser.id)
      .single()
    if (!profile || profile.company_id !== account.company_id) {
      return { success: false, error: 'Esta invitación no aplica a tu cuenta' }
    }
    userId = existingUser.id
    if (profile.role === 'customer') {
      await admin
        .from('user_profiles')
        .update({ role: invite.role === 'manager' ? 'corporate_manager' : 'corporate_user' })
        .eq('id', userId)
    }
  } else {
    // Cuenta nueva — mismo patrón que joinAsExternalAffiliateAction.
    const firstName = (formData.get('first_name') as string ?? '').trim()
    const lastName  = (formData.get('last_name') as string ?? '').trim()
    const phone     = (formData.get('phone') as string ?? '').trim() || null
    const password  = (formData.get('password') as string ?? '')

    if (!firstName || !lastName) return { success: false, error: 'Nombre y apellido requeridos' }
    if (!password || password.length < 8) return { success: false, error: 'La contraseña debe tener al menos 8 caracteres' }

    const { data: newUser, error: authError } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        company_id: account.company_id,
        role: invite.role === 'manager' ? 'corporate_manager' : 'corporate_user',
        first_name: firstName,
        last_name: lastName,
        phone,
      },
    })
    if (authError || !newUser.user) {
      if (authError?.message?.toLowerCase().includes('already')) return { success: false, error: 'Ya existe una cuenta con este email' }
      return { success: false, error: 'No se pudo crear la cuenta' }
    }
    userId = newUser.user.id

    await admin.from('user_profiles').upsert({
      id: userId,
      company_id: account.company_id,
      role: invite.role === 'manager' ? 'corporate_manager' : 'corporate_user',
      first_name: firstName,
      last_name: lastName,
      phone,
    })
  }

  const { error: memberError } = await admin.from('corporate_members').insert({
    company_id: account.company_id,
    corporate_account_id: invite.corporate_account_id,
    user_id: userId,
    role: invite.role,
    spending_limit: invite.spending_limit,
    monthly_limit: invite.monthly_limit,
    cost_center: invite.cost_center,
  })
  if (memberError && memberError.code !== '23505') {
    console.error('[acceptCorporateInviteAction] corporate_members insert', memberError)
    return { success: false, error: 'Error al unirte a la cuenta corporativa' }
  }

  await admin
    .from('corporate_invite_tokens')
    .update({ used_at: new Date().toISOString(), used_by_user_id: userId })
    .eq('id', invite.id)

  revalidatePath('/', 'layout')

  if (existingUser) {
    redirect('/auth/login')
  }

  // Cuenta nueva: iniciar sesión directo (mismo patrón que joinAsExternalAffiliateAction).
  const password = (formData.get('password') as string ?? '')
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: invite.email, password })
  if (signInError) redirect('/auth/login')

  redirect(getDefaultRoute(invite.role === 'manager' ? 'corporate_manager' : 'corporate_user'))
}
