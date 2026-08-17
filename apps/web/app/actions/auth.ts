'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { headers, cookies } from 'next/headers'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAppUrl } from '@/lib/app-url'
import { getDefaultRoute } from '@/lib/auth/permissions'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'
import { sendSuperAdminEmailInBackground } from '@/lib/notifications'
import { getTierForCount } from '@/lib/referrals/tiers'
import { REFERRAL_COOKIE } from '@/lib/referrals/constants'
import type { UserRole } from '@/lib/auth/permissions'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const SignupSchema = z.object({
  // Company
  company_name: z.string().min(2, 'Company name must be at least 2 characters'),
  company_slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  // Owner
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const ResetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

const UpdatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

// ─── Action Results ────────────────────────────────────────────────────────────

export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string[]>
}

// ─── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const parsed = LoginSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid credentials',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  // F1.17 — frenar fuerza bruta por IP
  if (!(await checkRateLimit('login', 10))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    return { success: false, error: 'Invalid email or password' }
  }

  // Get user profile to determine redirect (+ enforcement de bloqueo)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .single()

  const typedProfile = profile as { role?: string; is_active?: boolean } | null

  // Usuario bloqueado: cerrar la sesión recién creada y rechazar
  if (typedProfile && typedProfile.is_active === false) {
    await supabase.auth.signOut()
    return {
      success: false,
      error: 'Tu cuenta ha sido desactivada. Contacta al administrador de tu empresa.',
    }
  }

  const role = (typedProfile?.role ?? 'customer') as UserRole
  revalidatePath('/', 'layout')
  redirect(getDefaultRoute(role))
}

// ─── Signup (creates company + owner) ──────────────────────────────────────────

export async function signupAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    company_name: formData.get('company_name') as string,
    company_slug: formData.get('company_slug') as string,
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || undefined,
    password: formData.get('password') as string,
  }

  const parsed = SignupSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please fix the errors below',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  // F1.17 — frenar creación masiva de cuentas por IP
  if (!(await checkRateLimit('signup', 3, 5 * 60_000))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  // 1. Check slug availability
  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('slug', parsed.data.company_slug)
    .single()

  if (existing) {
    return {
      success: false,
      error: 'This company URL is already taken. Please choose a different one.',
      fieldErrors: { company_slug: ['This slug is already taken'] },
    }
  }

  // 2. Create the company
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      name: parsed.data.company_name,
      slug: parsed.data.company_slug,
      status: 'trial',
      plan: 'free',
    })
    .select('id')
    .single()

  if (companyError || !company) {
    console.error('Company creation error:', companyError)
    return { success: false, error: 'Failed to create company. Please try again.' }
  }

  // 3. Create the auth user (with metadata for the trigger)
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    // admin.createUser NO envía correos: con false el usuario quedaba sin
    // confirmar para siempre. Confirmamos directo y lo logueamos al terminar.
    email_confirm: true,
    user_metadata: {
      company_id: company.id,
      role: 'company_owner',
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      phone: parsed.data.phone ?? null,
    },
  })

  if (authError || !authUser.user) {
    // Rollback: delete the company
    await admin.from('companies').delete().eq('id', company.id)
    console.error('Auth user creation error:', authError)
    // GoTrue dice "A user with this email address has already been registered"
    if (authError?.message?.toLowerCase().includes('already')) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    return { success: false, error: 'Failed to create account. Please try again.' }
  }

  // 4. Create user_profile (trigger may handle this, but ensure it exists)
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id: authUser.user.id,
    company_id: company.id,
    role: 'company_owner',
    first_name: parsed.data.first_name,
    last_name: parsed.data.last_name,
    phone: parsed.data.phone ?? null,
  })

  if (profileError) {
    console.error('Profile creation error:', profileError)
    // Non-fatal — trigger may have already created it
  }

  // 4a. Atribución del programa de referidos (best-effort, nunca bloquea el
  // signup). Si llegó con el link de otra empresa, el % de comisión de ESE
  // referido queda congelado al nivel vigente del referrer en este momento.
  try {
    const refCode = cookies().get(REFERRAL_COOKIE)?.value
    if (refCode && refCode !== parsed.data.company_slug) {
      const { data: referrer } = await admin
        .from('companies')
        .select('id')
        .eq('slug', refCode)
        .single()

      if (referrer) {
        const { count: activeReferrals } = await admin
          .from('company_referrals')
          .select('id', { count: 'exact', head: true })
          .eq('referrer_company_id', referrer.id)
          .gt('expires_at', new Date().toISOString())

        const tier = getTierForCount((activeReferrals ?? 0) + 1)
        if (tier) {
          const referredAt = new Date()
          const expiresAt = new Date(referredAt)
          expiresAt.setFullYear(expiresAt.getFullYear() + 1)

          await admin.from('company_referrals').insert({
            referrer_company_id: referrer.id,
            referred_company_id: company.id,
            tier_key: tier.key,
            commission_pct: tier.pct,
            referred_at: referredAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
        }
      }
    }
    cookies().delete(REFERRAL_COOKIE)
  } catch (err) {
    console.error('Referral attribution error:', err)
  }

  // 4b. Avisar al super-admin de la nueva solicitud (no bloquea el flujo).
  const appUrl = getAppUrl()
  sendSuperAdminEmailInBackground(
    `Nueva solicitud: ${parsed.data.company_name}`,
    [
      'Una nueva empresa se registró desde el landing y está en prueba (trial).',
      '',
      `Empresa: ${parsed.data.company_name}`,
      `Micrositio: ${appUrl}/${parsed.data.company_slug}`,
      `Contacto: ${parsed.data.first_name} ${parsed.data.last_name} <${parsed.data.email}>`,
      parsed.data.phone ? `Teléfono: ${parsed.data.phone}` : '',
      '',
      `Revísala y apruébala en: ${appUrl}/super-admin/subscriptions`,
    ].filter(Boolean).join('\n'),
  )

  // 5. Iniciar sesión directo (la cuenta ya quedó confirmada arriba)
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    // Cuenta creada pero el auto-login falló: que entre manualmente
    redirect('/auth/login')
  }

  revalidatePath('/', 'layout')
  // ?welcome=1 dispara el evento GA4 'sign_up' en el dashboard (Fase 14,
  // Google Ads readiness) - la única señal de "visita convertida" para
  // campañas que apunten a las money pages; getDefaultRoute() siempre es
  // '/admin/dashboard' para company_owner, el rol fijo de este flujo.
  redirect(`${getDefaultRoute('company_owner')}?welcome=1`)
}

// ─── Logout ────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/auth/login')
}

// ─── Reset Password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = { email: formData.get('email') as string }
  const parsed = ResetPasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: 'Please enter a valid email address' }
  }

  const headersList = await headers()
  const origin = headersList.get('origin') ?? getAppUrl()

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  })

  if (error) {
    console.error('Reset password error:', error)
    // Don't leak whether email exists
  }

  // Always show success to prevent email enumeration
  return { success: true }
}

// ─── Update Password ───────────────────────────────────────────────────────────

export async function updatePasswordAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = {
    password: formData.get('password') as string,
    confirm_password: formData.get('confirm_password') as string,
  }

  const parsed = UpdatePasswordSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please fix the errors below',
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) {
    return { success: false, error: 'Failed to update password. Please try again.' }
  }

  revalidatePath('/', 'layout')
  redirect('/admin/dashboard')
}
