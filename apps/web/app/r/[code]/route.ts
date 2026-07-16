// Link de referido: /r/<slug-de-la-empresa-referente> → guarda una cookie
// (30 días) y manda a signup. La atribución real se registra en
// signupAction (app/actions/auth.ts) al leer esta cookie.
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS } from '@/lib/referrals/constants'

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const admin = createAdminClient()
  const { data: referrer } = await admin
    .from('companies')
    .select('id')
    .eq('slug', params.code)
    .single()

  if (referrer) {
    cookies().set(REFERRAL_COOKIE, params.code, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    })
  }

  return NextResponse.redirect(new URL('/auth/signup', request.url))
}
