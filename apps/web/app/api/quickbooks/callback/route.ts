import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { exchangeCodeForTokens } from '@/lib/quickbooks/server'
import { getAppUrl } from '@/lib/app-url'
import { QUICKBOOKS_CALLBACK_PATH, QUICKBOOKS_OAUTH_STATE_COOKIE } from '@/lib/quickbooks/oauth-constants'

// ── QuickBooks OAuth callback ──────────────────────────────────────────────────
// A diferencia de Stripe Connect / Whop Connect (donde el "return" solo informa
// que el usuario volvio, sin datos sensibles en la URL), aqui Intuit SI entrega
// el `code` que hay que intercambiar por tokens — este es el unico punto del
// flujo donde eso ocurre. La sesion del usuario sigue viva (mismo navegador,
// mismas cookies) asi que se resuelve la empresa via requireRole(), igual que
// en cualquier Server Action.

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const realmId = searchParams.get('realmId')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const settingsUrl = (errorCode: string) => `${origin}/admin/settings?quickbooks_error=${errorCode}`

  if (errorParam) {
    // El operador cancelo/denego el consentimiento en la pantalla de Intuit.
    return NextResponse.redirect(settingsUrl('denied'))
  }
  if (!code || !realmId) {
    return NextResponse.redirect(settingsUrl('connect_failed'))
  }

  const expectedState = cookies().get(QUICKBOOKS_OAUTH_STATE_COOKIE)?.value
  cookies().delete(QUICKBOOKS_OAUTH_STATE_COOKIE)
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(settingsUrl('invalid_state'))
  }

  const user = await requireRole('company_owner', 'company_admin')
  if (!user.company_id) return NextResponse.redirect(settingsUrl('no_company'))

  try {
    const tokens = await exchangeCodeForTokens(code, `${getAppUrl()}${QUICKBOOKS_CALLBACK_PATH}`)

    const admin = createAdminClient()
    await admin
      .from('companies')
      .update({
        quickbooks_realm_id: realmId,
        quickbooks_access_token: tokens.accessToken,
        quickbooks_refresh_token: tokens.refreshToken,
        quickbooks_token_expires_at: tokens.expiresAt,
        quickbooks_connected_at: new Date().toISOString(),
      })
      .eq('id', user.company_id)
  } catch (err) {
    console.error('[quickbooks/callback]', err)
    return NextResponse.redirect(settingsUrl('connect_failed'))
  }

  return NextResponse.redirect(`${origin}/admin/settings?quickbooks=connected`)
}
