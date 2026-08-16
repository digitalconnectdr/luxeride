import type { Metadata } from 'next'
import Link from 'next/link'
import { getDict, getLocale } from '@/lib/i18n/server'
import { brand } from '@/lib/brand'

// Antes no existía este archivo, así que Next usaba su 404 por defecto sin
// override de metadata, y heredaba robots:{index:true,follow:true} del
// layout raíz. Efecto real observado: /track/[id] con un ID inexistente
// devolvía DOS <meta name="robots"> contradictorios (el noindex de la
// página + el index:true del 404 por defecto). Este archivo cierra el
// hueco para cualquier 404 del sitio, no solo ese caso puntual.
export const metadata: Metadata = {
  title: { absolute: `404 | ${brand.name}` },
  robots: { index: false, follow: false },
}

export default function NotFound() {
  const t = getDict(getLocale()).notFound

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#08080a] text-white antialiased">
      <div className="w-full max-w-sm rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full border border-white/15 flex items-center justify-center text-white/50 text-xl">
          404
        </div>
        <h1 className="font-playfair text-2xl font-medium">{t.title}</h1>
        <p className="text-sm text-white/55 leading-relaxed">{t.body}</p>
        <Link
          href="/"
          className="inline-block mt-2 text-sm text-gold hover:text-gold/80 underline underline-offset-4"
        >
          {t.backHome}
        </Link>
      </div>
    </div>
  )
}
