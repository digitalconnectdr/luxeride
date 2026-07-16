'use server'
// ── F1.11 — Corporate Accounts: Server Actions ────────────────────────────────
// SECURITY: company_id siempre del servidor. Solo owner/admin gestionan cuentas.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'

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
    return { success: false, error: 'No existe un usuario con ese email. El usuario debe registrarse primero.' }
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
