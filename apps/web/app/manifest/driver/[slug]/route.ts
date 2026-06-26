// ── Manifest PWA del portal del conductor (branded por empresa) ───────────────
// El conductor instala "su app" con la marca de su empresa, pero arranca en
// /driver/trips (no en el micrositio del cliente). Keyed por slug para que el
// fetch del manifest no dependa de cookies de sesión.

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
    .select('name, slug, primary_color, logo_url')
    .eq('slug', params.slug)
    .single()

  if (!company || !company.slug) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const baseName = company.name ?? 'LuxeRide'
  const name = `${baseName} · Conductor`
  const themeColor = (company.primary_color as string | null) || '#8a6520'
  const logo = (company.logo_url as string | null) || '/icon.svg'
  const type = iconType(logo)
  const svg = type === 'image/svg+xml'

  const manifest = {
    id: `/driver?c=${company.slug}`, // distinto del PWA del cliente (mismo dominio)
    name,
    short_name: 'Conductor',
    description: `${baseName} — portal del conductor`,
    start_url: '/driver/trips',
    scope: '/driver',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f4ef', // tema Ivory del portal del conductor
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
