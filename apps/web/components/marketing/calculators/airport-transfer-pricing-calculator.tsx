'use client'

import { useState } from 'react'
import { NumberField, ResultCard, formatUSD } from './calculator-ui'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type Content = Dictionary['resourceCenter']['airportTransferPricingCalculator']

export function AirportTransferPricingCalculator({ t }: { t: Content }) {
  const [baseFare, setBaseFare] = useState(45)
  const [distance, setDistance] = useState(18)
  const [perMileRate, setPerMileRate] = useState(3)
  const [airportFee, setAirportFee] = useState(15)
  const [waitMinutes, setWaitMinutes] = useState(0)
  const [waitRate, setWaitRate] = useState(1)

  const distanceCharge = distance * perMileRate
  const waitCharge = waitMinutes * waitRate
  const total = baseFare + distanceCharge + airportFee + waitCharge

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10">
      <h2 className="font-playfair text-2xl font-semibold mb-6">{t.calculatorTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <NumberField label={t.inputBaseFare} value={baseFare} onChange={setBaseFare} prefix="$" min={0} />
        <NumberField label={t.inputDistance} value={distance} onChange={setDistance} suffix="mi" min={0} />
        <NumberField label={t.inputPerMileRate} value={perMileRate} onChange={setPerMileRate} prefix="$" min={0} step={0.1} />
        <NumberField label={t.inputAirportFee} value={airportFee} onChange={setAirportFee} prefix="$" min={0} />
        <NumberField label={t.inputWaitMinutes} value={waitMinutes} onChange={setWaitMinutes} suffix="min" min={0} />
        <NumberField label={t.inputWaitRate} value={waitRate} onChange={setWaitRate} prefix="$" min={0} step={0.1} />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResultCard label={t.resultDistanceCharge} value={formatUSD(distanceCharge)} />
        <ResultCard label={t.resultWaitCharge} value={formatUSD(waitCharge)} />
        <ResultCard label={t.resultTotal} value={formatUSD(total)} emphasis />
      </div>
    </div>
  )
}
