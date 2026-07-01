// ── Manifest PWA dinámico por empresa (white-label) ───────────────────────────
// Cada operador instala su /<slug> como "su app": nombre, color e ícono propios.
// Enlazado desde el micrositio con <link rel="manifest" href="/manifest/<slug>">.

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function iconType(url: string): string {
  if (/\.svg(\?|$)/i.test(url)) return 'image/svg+xml'
  if (/\.png(\?|$)/i.test(url)) return 'image/png'
  if (/\.(jpe?g)(\?|$)/i.test(url)) return 'image/jpeg'
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp'
  return 'image/png'
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: company } = await admin
    .from('companies')
    .select('name, slug, primary_color, logo_url, tagline')
    .eq('slug', params.slug)
    .single()

  if (!company || !company.slug) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const name = company.name ?? 'Reservas'
  const themeColor = (company.primary_color as string | null) || '#c9a24b'
  const logo = (company.logo_url as string | null) || '/icon.svg'
  const type = iconType(logo)
  const svg = type === 'image/svg+xml'

  const manifest = {
    // id único por operador → cada empresa es una app distinta aunque compartan
    // dominio (white-label multi-tenant). Sin esto el navegador las confunde.
    id: `/book/${company.slug}`,
    name,
    short_name: name.slice(0, 12),
    description: (company.tagline as string | null) || `${name} — reservas online`,
    start_url: `/book/${company.slug}`,
    // scope amplio: la reserva vive en /book/<slug>/… y el tracking en /track/…,
    // así que el scope debe cubrir todo el origen para no salirse de la app.
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#08080a',
    theme_color: themeColor,
    icons: [
      { src: logo, sizes: svg ? 'any' : '192x192', type, purpose: 'any' },
      { src: logo, sizes: svg ? 'any' : '512x512', type, purpose: 'any' },
    ],
  }

  return new NextResponse(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
