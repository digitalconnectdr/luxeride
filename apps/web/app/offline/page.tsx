import type { Metadata } from 'next'
import { getDict, getLocale } from '@/lib/i18n/server'

export const metadata: Metadata = {
  title: { absolute: 'Offline' },
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  const t = getDict(getLocale()).offline
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#08080a] text-white antialiased">
      <div className="w-full max-w-sm rounded-2xl bg-white/[0.03] border border-white/10 p-8 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full border border-white/15 flex items-center justify-center text-white/50 text-xl">⚡</div>
        <h1 className="font-playfair text-2xl font-medium">{t.title}</h1>
        <p className="text-sm text-white/55 leading-relaxed">{t.body}</p>
      </div>
    </div>
  )
}
