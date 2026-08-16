import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import type { UserRole } from '@/lib/auth/permissions'
import { getDefaultRoute, ADMIN_ROLES } from '@/lib/auth/permissions'
import { getAppUrl } from '@/lib/app-url'

// Explicit type for setAll parameter — same reason as in lib/supabase/server.ts:
// TypeScript can't infer from the union cookie options type in createServerClient.
type CookieItem = {
  name: string
  value: string
  options?: {
    domain?: string
    expires?: Date | number
    httpOnly?: boolean
    maxAge?: number
    path?: string
    sameSite?: 'strict' | 'lax' | 'none' | boolean
    secure?: boolean
    priority?: 'low' | 'medium' | 'high'
    partitioned?: boolean
  }
}

// Primeros segmentos reservados por el sistema — NO son slugs de operador.
// Si se agrega una página top-level nueva (ej. /terms), añadirla aquí.
const RESERVED_SEGMENTS = new Set([
  'admin', 'dispatcher', 'driver', 'corporate', 'account', 'super-admin',
  'auth', 'api', 'track', 'payment', 'book', 'embed', 'review', 'quote',
  'manifest', 'icon', 'favicon', 'opengraph-image', 'demo', 'offline', 'sw.js',
  'privacy', 'terms', 'en', 'es', 'pt',
  // Money pages (Fase 3 SEO)
  'limo-software', 'black-car-software', 'chauffeur-software',
  'airport-transfer-software', 'limo-dispatch-software', 'limo-booking-software',
])

// Consulta directa a la REST API de Supabase (fetch plano, sin supabase-js) —
// mismo motivo que lib/vercel/domains.ts: middleware corre en Edge Runtime,
// se evita cargar el cliente completo solo para una consulta de una columna.
// Usa el service role porque companies NO tiene policy de SELECT para anon
// (mismo patrón que app/(booking)/book/[slug]/page.tsx, que ya lee companies
// con createAdminClient para servir el micrositio público).
async function resolveCustomDomainSlug(host: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/companies?custom_domain=eq.${encodeURIComponent(host)}&custom_domain_status=eq.verified&select=slug&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { slug: string }[]
    return rows[0]?.slug ?? null
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Dominio personalizado: "/" → /book/<slug> de la empresa verificada ─────
  // Solo la raíz — el resto de rutas (/track, /quote, /review, /payment, /api)
  // ya funcionan igual sin importar el host, son por ID no por slug. Se
  // excluye cualquier host de la plataforma (incluyendo *.vercel.app, que
  // cubre tanto el dominio de producción como cada preview deploy) para no
  // hacer una consulta extra en el camino normal.
  const host = (request.headers.get('host') ?? '').split(':')[0].toLowerCase()
  const platformHost = new URL(getAppUrl()).hostname
  if (pathname === '/' && host && host !== platformHost && host !== 'localhost' && !host.endsWith('.vercel.app')) {
    const slug = await resolveCustomDomainSlug(host)
    if (slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/book/${slug}`
      return NextResponse.rewrite(url)
    }
  }

  // ── Link corto del operador: /<slug> → reescribe a /book/<slug> ──────────────
  // Permite compartir getluxeride.vercel.app/revival en vez de /book/revival.
  // Solo aplica a rutas de UN segmento, no reservadas y sin punto (no archivos).
  const segments = pathname.split('/').filter(Boolean)
  if (
    segments.length === 1 &&
    !RESERVED_SEGMENTS.has(segments[0]) &&
    !segments[0].includes('.') &&
    /^[a-z0-9-]+$/.test(segments[0])
  ) {
    const url = request.nextUrl.clone()
    url.pathname = `/book/${segments[0]}`
    return NextResponse.rewrite(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  // No <Database> generic — middleware only checks auth and role, uses type casts.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieItem[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Always call getUser() — never getSession() — for security.
  // getUser() validates the JWT with the Supabase server.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Auth pages: redirect logged-in users to their dashboard ──────────────────
  if (pathname.startsWith('/auth') && !pathname.startsWith('/auth/callback')) {
    if (user) {
      // Get role to redirect to the correct dashboard
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role ?? 'customer') as UserRole
      return NextResponse.redirect(new URL(getDefaultRoute(role), request.url))
    }
  }

  // ── Protected routes: require authentication ──────────────────────────────────
  // /corporate/join/[token] es pública a propósito (capability-URL, mismo
  // patrón que /affiliate/join/[token] y /track/[id]) — el token de la URL es
  // la única autorización, así que se excluye del bloqueo de /corporate.
  const protectedPrefixes = ['/admin', '/dispatcher', '/driver', '/corporate', '/account', '/super-admin']
  const isProtected =
    !pathname.startsWith('/corporate/join') &&
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix))

  if (isProtected && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Role-based route protection ───────────────────────────────────────────────
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    // Usuario bloqueado (is_active = false): cerrar sesión y expulsar
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('blocked', '1')
      return NextResponse.redirect(loginUrl)
    }

    const role = (profile?.role ?? 'customer') as UserRole

    // Super admin panel
    if (pathname.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getDefaultRoute(role), request.url))
    }

    // Admin panel — only admin roles
    if (pathname.startsWith('/admin') && !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL(getDefaultRoute(role), request.url))
    }

    // Driver panel — only drivers
    if (pathname.startsWith('/driver') && role !== 'driver') {
      return NextResponse.redirect(new URL(getDefaultRoute(role), request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
