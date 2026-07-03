'use client'
// ── Conductores activos ahora mismo — visibilidad del pool de auto-asignación ──
// Muestra quién está en servicio (is_available), si tiene un viaje en curso,
// cuántos ha completado hoy, y permite a Dispatch escribirle directamente
// (mismo canal que el conductor ve en su portal).

import { useEffect, useState, useCallback } from 'react'
import { getUnreadDriverMessageCountsAction } from '@/app/actions/driver-messages'
import { DriverChannelChat } from '@/components/shared/driver-channel-chat'

export interface DriverStatusRow {
  id: string
  name: string
  isAvailable: boolean
  currentBookingNumber: string | null
  tripsCompletedToday: number
}

const POLL_MS = 15_000

export function ActiveDriversPanel({ drivers }: { drivers: DriverStatusRow[] }) {
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const counts = await getUnreadDriverMessageCountsAction()
    setUnread(counts)
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  if (!drivers.length) return null

  const onDuty = drivers.filter((d) => d.isAvailable).length

  return (
    <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-sl-outline-variant flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-sl-on-surface-muted">
          Conductores activos ahora mismo
        </p>
        <span className="text-[11px] text-sl-on-surface-muted">{onDuty} en servicio</span>
      </div>
      <div className="divide-y divide-sl-outline-variant max-h-80 overflow-y-auto">
        {drivers.map((d) => (
          <div key={d.id} className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-2 w-2 rounded-full shrink-0 ${d.isAvailable ? 'bg-green-500' : 'bg-sl-outline-variant'}`} />
                <p className="text-sm text-sl-on-surface truncate">{d.name}</p>
                {d.currentBookingNumber && (
                  <span className="text-[10px] font-mono text-[#0071e3] shrink-0">{d.currentBookingNumber}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-sl-on-surface-muted">{d.tripsCompletedToday} hoy</span>
                <button
                  onClick={() => setOpenId(openId === d.id ? null : d.id)}
                  className="relative text-[11px] font-medium rounded-full border border-sl-outline-variant px-2.5 py-1 hover:bg-sl-bg transition-colors"
                >
                  💬
                  {!!unread[d.id] && (
                    <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[8px] leading-none flex items-center justify-center">
                      {unread[d.id]}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {openId === d.id && (
              <div className="mt-2.5">
                <DriverChannelChat
                  variant="dispatch"
                  driverId={d.id}
                  labels={{
                    title: `Chat con ${d.name}`,
                    placeholder: 'Escribe un mensaje…',
                    send: 'Enviar',
                    empty: 'Sin mensajes todavía.',
                    you: 'Tú',
                    them: d.name,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
