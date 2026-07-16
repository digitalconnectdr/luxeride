'use client'
// ── Mockup animado del producto para el hero del landing ──────────────────────
// Tarjetas flotantes que simulan el dispatch + SMS de tracking. CSS + framer.

import { motion } from 'framer-motion'

interface Props {
  labels: {
    dispatchTitle: string
    newBooking: string
    assigned: string
    enRoute: string
    paid: string
    smsPreview: string
  }
}

export function HeroMockup({ labels }: Props) {
  return (
    <div className="relative w-full max-w-md mx-auto h-[420px] select-none" aria-hidden>
      {/* Glow base */}
      <div
        className="absolute inset-0 rounded-3xl"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(233,193,118,0.12), transparent 70%)',
        }}
      />

      {/* Card principal: dispatch board */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        className="absolute top-6 left-0 right-10 bg-[#171513]/95 backdrop-blur border border-white/10 rounded-2xl p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {labels.dispatchTitle}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-green-400">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-green-400"
            />
            LIVE
          </span>
        </div>

        {[
          { label: labels.newBooking, code: 'LXR-2026-00214', color: '#eab308', w: '62%' },
          { label: labels.assigned, code: 'LXR-2026-00213', color: '#60a5fa', w: '78%' },
          { label: labels.enRoute, code: 'LXR-2026-00212', color: '#fb923c', w: '54%' },
        ].map((row, i) => (
          <motion.div
            key={row.code}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.18, duration: 0.5 }}
            className="flex items-center gap-3 py-2.5 border-t border-white/[0.06] first:border-t-0"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/85 truncate">{row.label}</p>
              <div className="mt-1.5 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: row.w }}
                  transition={{ delay: 0.9 + i * 0.18, duration: 0.9, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: row.color, opacity: 0.7 }}
                />
              </div>
            </div>
            <span className="font-mono text-[9px] text-[#e9c176]/80 shrink-0">{row.code}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Card flotante: pago recibido */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: [0, -8, 0], scale: 1 }}
        transition={{
          opacity: { delay: 1.4, duration: 0.6 },
          scale: { delay: 1.4, duration: 0.6 },
          y: { delay: 2, duration: 5, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute top-0 right-0 bg-[#171513]/95 backdrop-blur border border-[#e9c176]/30 rounded-2xl px-4 py-3 shadow-2xl"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center text-green-400 text-xs">
            ✓
          </div>
          <div>
            <p className="text-[10px] font-semibold text-white/90">{labels.paid}</p>
            <p className="text-[11px] font-bold text-[#e9c176]">$186.50 USD</p>
          </div>
        </div>
      </motion.div>

      {/* Card flotante: SMS de tracking */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 1.8, duration: 0.6 },
          y: { delay: 2.4, duration: 6, repeat: Infinity, ease: 'easeInOut' },
        }}
        className="absolute bottom-6 left-4 right-16 bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-2xl"
      >
        <div className="flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#f3d9a4] to-[#c89b4f] flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[#141313] font-bold text-[9px]">L</span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-gray-700 leading-snug">{labels.smsPreview}</p>
            <p className="text-[10px] text-bronze font-medium mt-1 truncate">
              luxeride.app/track/8f2a…
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
