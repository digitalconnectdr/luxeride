'use server'
// ── F1.7 — Team Management: Server Actions ────────────────────────────────────
// SECURITY: Solo company_owner y company_admin pueden gestionar el equipo.
// No se expone SUPABASE_SERVICE_ROLE_KEY al cliente — solo en Server Actions.

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { checkDriverLimit, checkTeamMemberLimit } from '@/lib/plans/limits'
import type { UserRole } from '@/lib/auth/permissions'

const ASSIGNABLE_ROLES: UserRole[] = [
  'company_admin',
  'dispatcher',
  'accounting',
  'driver',
  'customer',
]

export type InviteResult = {
  success: boolean
  error?: string
  tempPassword?: string
  email?: string
}

// Genera una contraseña temporal legible (cumple el mínimo de Supabase).
function generateTempPassword(): string {
  return 'Lx' + randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '') + '9'
}

// useFormState-compatible: (prevState, formData)
export async function inviteTeamMemberAction(
  _prev: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  const email     = (formData.get('email') as string ?? '').trim().toLowerCase()
  const firstName = (formData.get('first_name') as string ?? '').trim()
  const lastName  = (formData.get('last_name') as string ?? '').trim()
  const role      = formData.get('role') as UserRole
  const phone     = (formData.get('phone') as string ?? '').trim() || null

  if (!email)     return { success: false, error: 'Email requerido' }
  if (!firstName) return { success: false, error: 'Nombre requerido' }
  if (!lastName)  return { success: false, error: 'Apellido requerido' }
  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: 'Rol inválido' }
  }

  // company_admin cannot create another company_admin
  if (user.role === 'company_admin' && role === 'company_admin') {
    return { success: false, error: 'No tienes permiso para asignar este rol' }
  }

  const admin = createAdminClient()

  if (role === 'driver') {
    const limitCheck = await checkDriverLimit(admin, user.company_id)
    if (!limitCheck.ok) return { success: false, error: limitCheck.error }
  } else if (role !== 'customer') {
    const limitCheck = await checkTeamMemberLimit(admin, user.company_id)
    if (!limitCheck.ok) return { success: false, error: limitCheck.error }
  }

  const tempPassword = generateTempPassword()

  // Alta directa: el correo de invitación de Supabase no está configurado, así
  // que creamos el usuario activo con una contraseña temporal que el admin le
  // entrega al miembro (luego puede cambiarla con "¿Olvidaste tu contraseña?").
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      company_id: user.company_id,
      role,
      first_name: firstName,
      last_name:  lastName,
      phone:      phone ?? undefined,
    },
  })

  if (authError || !authData.user) {
    console.error('[inviteTeamMemberAction] auth error', authError)
    if (authError?.message?.toLowerCase().includes('already')) {
      return { success: false, error: 'Este email ya está registrado' }
    }
    return { success: false, error: 'Error al crear el miembro del equipo' }
  }

  // Asegurar el perfil (el trigger lo crea desde metadata; reforzamos
  // phone + is_active por si acaso).
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id:         authData.user.id,
    company_id: user.company_id,
    role,
    first_name: firstName,
    last_name:  lastName,
    phone:      phone ?? undefined,
    is_active:  true,
  })

  if (profileError) {
    console.error('[inviteTeamMemberAction] profile error', profileError)
  }

  revalidatePath('/admin/team')
  return { success: true, tempPassword, email }
}

export async function updateTeamMemberRoleAction(
  memberId: string,
  role: UserRole,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    return { success: false, error: 'Rol inválido' }
  }

  // Prevent self-role change
  if (memberId === user.id) {
    return { success: false, error: 'No puedes cambiar tu propio rol' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ role })
    .eq('id', memberId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[updateTeamMemberRoleAction]', error)
    return { success: false, error: 'Error al actualizar el rol' }
  }

  revalidatePath('/admin/team')
  return { success: true }
}

export type ResetPasswordResult = {
  success: boolean
  error?: string
  tempPassword?: string
}

// Reseteo de contraseña por el owner/admin de la empresa — útil cuando un
// conductor (u otro miembro) pierde su contraseña y no puede recibir el
// correo de "¿Olvidaste tu contraseña?" o simplemente prefiere que se la
// entreguen directo. Genera una nueva temporal, igual que en la invitación.
export async function resetTeamMemberPasswordAction(memberId: string): Promise<ResetPasswordResult> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  if (memberId === user.id) {
    return { success: false, error: 'Usa "¿Olvidaste tu contraseña?" para tu propia cuenta' }
  }

  const admin = createAdminClient()

  // IDOR guard: el miembro debe pertenecer a la misma empresa
  const { data: member } = await admin
    .from('user_profiles')
    .select('company_id, role')
    .eq('id', memberId)
    .single()
  if (!member || member.company_id !== user.company_id) {
    return { success: false, error: 'Miembro no encontrado' }
  }
  if (member.role === 'company_owner') {
    return { success: false, error: 'No se puede resetear la contraseña del dueño de la empresa' }
  }

  const tempPassword = generateTempPassword()
  const { error } = await admin.auth.admin.updateUserById(memberId, { password: tempPassword })
  if (error) {
    console.error('[resetTeamMemberPasswordAction]', error)
    return { success: false, error: 'Error al resetear la contraseña' }
  }

  return { success: true, tempPassword }
}

export async function toggleTeamMemberActiveAction(
  memberId: string,
  isActive: boolean,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return { success: false, error: 'Sin empresa asignada' }

  if (memberId === user.id) {
    return { success: false, error: 'No puedes desactivarte a ti mismo' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('user_profiles')
    .update({ is_active: isActive })
    .eq('id', memberId)
    .eq('company_id', user.company_id)

  if (error) {
    console.error('[toggleTeamMemberActiveAction]', error)
    return { success: false, error: 'Error al actualizar estado del miembro' }
  }

  revalidatePath('/admin/team')
  return { success: true }
}
