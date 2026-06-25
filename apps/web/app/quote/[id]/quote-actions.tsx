'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptQuoteAction, declineQuoteAction } from '@/app/actions/quote'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type QuoteDict = Dictionary['quoteAccept']

export function QuoteActions({ bookingId, brandColor, t }: { bookingId: string; brandColor: string; t: QuoteDict }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [mode, setMode] = useState<'accept' | 'decline' | null>(null)

  function run(action: 'accept' | 'decline') {
    setError('')
    setMode(action)
    startTransition(async () => {
      const result = action === 'accept'
        ? await acceptQuoteAction(bookingId)
        : await declineQuoteAction(bookingId)
      if (!result.success) {
        setError(t.errorGeneric)
        setMode(null)
        return
      }
      router.refresh() // la página servidor re-renderiza el estado confirmado/rechazado
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <button
        type="button"
        onClick={() => run('accept')}
        disabled={isPending}
        className="w-full py-3.5 rounded-xl text-[#08080a] text-sm font-semibold tracking-wide transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
        style={{ backgroundColor: brandColor }}
      >
        {isPending && mode === 'accept' ? t.accepting : t.accept}
      </button>
      <button
        type="button"
        onClick={() => run('decline')}
        disabled={isPending}
        className="w-full py-3 rounded-xl text-sm font-medium border border-white/15 text-white/70 hover:border-white/30 hover:text-white transition-colors disabled:opacity-60"
      >
        {isPending && mode === 'decline' ? t.declining : t.decline}
      </button>
    </div>
  )
}
