'use client'

import { useState } from 'react'
import { InfoTip } from '@/components/ui/info-tip'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type PricingDict = Dictionary['admin']['pricing']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface ' +
  'placeholder:text-sl-on-surface-muted/60 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

const labelCls = 'block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1'

/**
 * Recargo de feriado, tarifa dinámica y vigencia — los tres bloques que la
 * base de datos siempre soportó pero el formulario nunca expuso (surge y
 * vigencia iban como inputs ocultos, y el feriado ni siquiera se aplicaba).
 *
 * Se comparte entre el formulario de alta y la fila en edición para que ambos
 * escriban exactamente los mismos nombres de campo; tenerlo duplicado fue lo
 * que dejó que se desincronizaran en primer lugar.
 */
export function PricingAdvancedFields({
  t,
  defaults,
}: {
  t: PricingDict
  defaults?: {
    holidaySurchargePct?: number
    airportPickupFee?: number
    airportDropoffFee?: number
    surgeEnabled?: boolean
    surgeMultiplier?: number
    validFrom?: string | null
    validUntil?: string | null
    daysOfWeek?: number[] | null
  }
}) {
  const [surgeOn, setSurgeOn] = useState(defaults?.surgeEnabled ?? false)
  const selectedDays = defaults?.daysOfWeek ?? null

  return (
    <div className="space-y-4">
      {/* ── Recargos ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted font-semibold mb-2">
          {t.sectionSurcharges}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>
              {t.holidaySurcharge}
              <InfoTip text={t.help.holidaySurcharge} />
            </label>
            <input
              name="holiday_surcharge_pct"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaults?.holidaySurchargePct ?? 0}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              {t.airportPickupFee}
              <InfoTip text={t.help.airportPickupFee} />
            </label>
            <input
              name="airport_pickup_fee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaults?.airportPickupFee ?? 0}
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              {t.airportDropoffFee}
              <InfoTip text={t.help.airportDropoffFee} />
            </label>
            <input
              name="airport_dropoff_fee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaults?.airportDropoffFee ?? 0}
              className={inputCls}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>
              {t.surgeEnabled}
              <InfoTip text={t.help.surge} />
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-sl-on-surface cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="surge_enabled"
                  value="true"
                  checked={surgeOn}
                  onChange={(e) => setSurgeOn(e.target.checked)}
                  className="w-4 h-4 accent-gold cursor-pointer"
                />
                {surgeOn ? 'ON' : 'OFF'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  name="surge_multiplier"
                  type="number"
                  step="0.05"
                  min="1"
                  max="5"
                  defaultValue={defaults?.surgeMultiplier && defaults.surgeMultiplier > 1 ? defaults.surgeMultiplier : 1.5}
                  disabled={!surgeOn}
                  aria-label={t.surgeMultiplier}
                  className={`${inputCls} w-24 disabled:opacity-50`}
                />
                <span className="text-sm text-sl-on-surface-muted">×</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Vigencia ─────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-sl-on-surface-muted font-semibold mb-2">
          {t.sectionValidity}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>
              {t.validFrom}
              <InfoTip text={t.help.validFrom} />
            </label>
            <input name="valid_from" type="date" defaultValue={defaults?.validFrom ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              {t.validUntil}
              <InfoTip text={t.help.validUntil} />
            </label>
            <input name="valid_until" type="date" defaultValue={defaults?.validUntil ?? ''} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              {t.daysOfWeek}
              <InfoTip text={t.help.daysOfWeek} />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {t.dayShort.map((label, day) => (
                <label
                  key={label}
                  className="cursor-pointer select-none"
                  title={label}
                >
                  <input
                    type="checkbox"
                    name="days_of_week"
                    value={day}
                    defaultChecked={selectedDays ? selectedDays.includes(day) : false}
                    className="peer sr-only"
                  />
                  <span className="block text-xs px-2 py-1.5 rounded-lg border border-sl-outline-variant text-sl-on-surface-muted peer-checked:bg-gold peer-checked:text-gray-900 peer-checked:border-gold peer-focus-visible:ring-1 peer-focus-visible:ring-bronze transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-sl-on-surface-muted">{t.allDaysHint}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
