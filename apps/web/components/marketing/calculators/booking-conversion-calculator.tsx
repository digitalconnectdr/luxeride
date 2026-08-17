'use client'

import { useState } from 'react'
import { NumberField, ResultCard, formatUSD } from './calculator-ui'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type Content = Dictionary['resourceCenter']['bookingConversionCalculator']

export function BookingConversionCalculator({ t }: { t: Content }) {
  const [visitors, setVisitors] = useState(2000)
  const [currentRate, setCurrentRate] = useState(2)
  const [avgBookingValue, setAvgBookingValue] = useState(150)
  const [targetRate, setTargetRate] = useState(4)

  const currentBookings = visitors * (currentRate / 100)
  const currentRevenue = currentBookings * avgBookingValue
  const targetBookings = visitors * (targetRate / 100)
  const additionalRevenue = (targetBookings - currentBookings) * avgBookingValue

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10">
      <h2 className="font-playfair text-2xl font-semibold mb-6">{t.calculatorTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <NumberField label={t.inputVisitors} value={visitors} onChange={setVisitors} min={0} />
        <NumberField label={t.inputCurrentRate} value={currentRate} onChange={setCurrentRate} suffix="%" min={0} step={0.1} />
        <NumberField label={t.inputAvgBookingValue} value={avgBookingValue} onChange={setAvgBookingValue} prefix="$" min={0} />
        <NumberField
          label={t.inputTargetRate}
          value={targetRate}
          onChange={setTargetRate}
          suffix="%"
          min={0}
          step={0.1}
          helpText={t.inputTargetRateHelp}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ResultCard label={t.resultCurrentBookings} value={Math.round(currentBookings).toLocaleString('en-US')} />
        <ResultCard label={t.resultCurrentRevenue} value={formatUSD(currentRevenue)} />
        <ResultCard label={t.resultTargetBookings} value={Math.round(targetBookings).toLocaleString('en-US')} />
        <ResultCard label={t.resultAdditionalRevenue} value={formatUSD(additionalRevenue)} emphasis />
      </div>
    </div>
  )
}
