'use server'
// ── Auth de pasajero para la app móvil nativa ──────────────────────────────
// Primer signup real de un pasajero (hoy todo booking en la web es guest,
// sin cuenta). Mismo patrón que signupAction (apps/web/app/actions/auth.ts):
// admin.auth.admin.createUser con email_confirm:true + upsert manual de
// user_profiles (no depende únicamente del trigger handle_new_user).
//
// A diferencia de signupAction, esto no corre dentro de un formulario de
// Next con cookies — lo llama una Route Handler pública para la app nativa
// (apps/passenger-mobile). El login final se hace con un cliente Supabase
// efímero (anon key, sin persistencia) solo para obtener el `Session` que
// se devuelve en la respuesta JSON; la app guarda esa sesión en su propio
// AsyncStorage (igual que ya hace apps/driver-mobile).

import { z } from 'zod'
import { createClient as createSupabaseClient, type Session } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/security/rate-limit'

const SignupPassengerSchema = z.object({
  companySlug: z.string().min(2).max(50),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  phone: z.string().optional(),
  // Se pide en el signup de la app (uso futuro: felicitación de cumpleaños,
  // ver docs/PENDING.md) — YYYY-MM-DD, no puede ser en el futuro.
  dateOfBirth: z.string().refine((v) => {
    const d = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
  }, 'Fecha de nacimiento inválida'),
})

export interface SignupPassengerInput {
  companySlug: string
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  dateOfBirth: string
}

export interface SignupPassengerResult {
  success: boolean
  error?: string
  session?: Session
}

export async function signupPassengerCore(input: SignupPassengerInput): Promise<SignupPassengerResult> {
  const parsed = SignupPassengerSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  // Frenar creación masiva de cuentas por IP — mismo umbral que signupAction.
  if (!(await checkRateLimit('passenger_signup', 5, 5 * 60_000))) {
    return { success: false, error: RATE_LIMIT_ERROR }
  }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, status')
    .eq('slug', parsed.data.companySlug)
    .single()

  if (!company || company.status !== 'active') {
    return { success: false, error: 'Empresa no disponible' }
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    // admin.createUser NO envía correos: con false el usuario quedaba sin
    // confirmar para siempre. Confirmamos directo, igual que signupAction.
    email_confirm: true,
    user_metadata: {
      company_id: company.id,
      role: 'customer',
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone ?? null,
    },
  })

  if (authError || !authUser.user) {
    if (authError?.message?.toLowerCase().includes('already')) {
      return { success: false, error: 'Ya existe una cuenta con este correo.' }
    }
    console.error('[signupPassengerCore] auth', authError)
    return { success: false, error: 'No se pudo crear la cuenta. Intenta de nuevo.' }
  }

  // El trigger handle_new_user() debería crear el user_profile solo (ya
  // manda company_id en user_metadata), pero se refuerza con upsert manual
  // — misma red de seguridad que signupAction, por si el trigger no llegó.
  const { error: profileError } = await admin.from('user_profiles').upsert({
    id: authUser.user.id,
    company_id: company.id,
    role: 'customer',
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    phone: parsed.data.phone ?? null,
    date_of_birth: parsed.data.dateOfBirth,
  })

  if (profileError) {
    console.error('[signupPassengerCore] profile', profileError)
  }

  const anon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError || !signInData.session) {
    return { success: false, error: 'Cuenta creada. Inicia sesión manualmente.' }
  }

  return { success: true, session: signInData.session }
}
