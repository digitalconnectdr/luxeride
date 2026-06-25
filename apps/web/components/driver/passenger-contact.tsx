'use client'
// ── Contacto con el pasajero (vista del conductor) ────────────────────────────
// Canal principal: chat in-app. El número se oculta por defecto; "Mostrar número"
// lo revela bajo demanda y registra la revelación en auditoría (audit_logs).

import { useState, useTransition } from 'react'
import { revealPassengerPhoneAction } from '@/app/actions/driver'

interface Labels { call: string; message: string; showNumber: string }

export function PassengerContact({
  bookingId,
  phone,
  chatId,
  brandColor,
  labels,
}: {
  bookingId: string
  phone: string | null
  chatId: string
  brandColor: string
  labels: Labels
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState(false)

  const masked = phone ? `•••• ${phone.replace(/\D/g, '').slice(-4)}` : null
  const waNumber = revealed ? revealed.replace(/\D/g, '') : ''

  function reveal() {
    setError(false)
    startTransition(async () => {
      const r = await revealPassengerPhoneAction(bookingId)
      if (r.success && r.phone) setRevealed(r.phone)
      else setError(true)
    })
  }

  const btnBase = 'text-center text-xs font-medium rounded-lg border border-[#e5e1d8] py-2 hover:bg-[#faf8f3] transition-colors'

  return (
    <div className="mt-3 space-y-2.5">
      {phone && <p className="text-sm text-[#75716a]">{revealed ?? masked}</p>}

      {/* Canal principal: chat */}
      <a
        href={`#${chatId}`}
        className="flex items-center justify-center gap-2 text-sm font-semibold rounded-lg py-2.5 text-white transition-transform hover:scale-[1.01]"
        style={{ backgroundColor: brandColor }}
      >
        💬 {labels.message}
      </a>

      {/* Teléfono: oculto hasta revelar (auditado) */}
      {phone && !revealed && (
        <button type="button" onClick={reveal} disabled={isPending} className={`${btnBase} w-full disabled:opacity-50`}>
          {isPending ? '…' : `📞 ${labels.showNumber}`}
        </button>
      )}
      {phone && revealed && (
        <div className="grid grid-cols-2 gap-2">
          <a href={`tel:${revealed}`} className={btnBase}>📞 {labels.call}</a>
          {waNumber && (
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className={`${btnBase} text-green-600`}>WhatsApp</a>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 text-center">—</p>}
    </div>
  )
}
