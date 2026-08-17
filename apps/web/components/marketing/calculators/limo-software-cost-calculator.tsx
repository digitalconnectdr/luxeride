'use client'

import { useMemo, useState } from 'react'
import { NumberField, ResultCard, formatUSD } from './calculator-ui'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type Content = Dictionary['resourceCenter']['limoSoftwareCostCalculator']

function planFor(vehicles: number) {
  if (vehicles <= 6) return { name: 'Starter', base: 99, fee: 0.03, feeLabel: '3%' }
  if (vehicles <= 15) return { name: 'Professional', base: 299, fee: 0.015, feeLabel: '1.5%' }
  return { name: 'Elite', base: 549, fee: 0.005, feeLabel: '0.5%' }
}

export function LimoSoftwareCostCalculator({ t }: { t: Content }) {
  const [vehicles, setVehicles] = useState(6)
  const [tripsPerMonth, setTripsPerMonth] = useState(150)
  const [avgFare, setAvgFare] = useState(150)
  const [currentCost, setCurrentCost] = useState(200)

  const plan = useMemo(() => planFor(vehicles), [vehicles])
  const luxerideCost = plan.base + tripsPerMonth * avgFare * plan.fee
  const difference = currentCost - luxerideCost

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10">
      <h2 className="font-playfair text-2xl font-semibold mb-6">{t.calculatorTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <NumberField label={t.inputVehicles} value={vehicles} onChange={setVehicles} min={1} />
        <NumberField label={t.inputTripsPerMonth} value={tripsPerMonth} onChange={setTripsPerMonth} min={0} />
        <NumberField label={t.inputAvgFare} value={avgFare} onChange={setAvgFare} prefix="$" min={0} />
        <NumberField
          label={t.inputCurrentCost}
          value={currentCost}
          onChange={setCurrentCost}
          prefix="$"
          min={0}
          helpText={t.inputCurrentCostHelp}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ResultCard label={t.resultPlan} value={`${plan.name} · ${plan.feeLabel} ${t.resultPlanFee}`} />
        <ResultCard label={t.resultCurrentCost} value={formatUSD(currentCost)} />
        <ResultCard label={t.resultLuxerideCost} value={formatUSD(luxerideCost)} emphasis />
        <ResultCard
          label={difference >= 0 ? t.resultDifferenceSavings : t.resultDifferenceMore}
          value={formatUSD(Math.abs(difference))}
          emphasis={difference >= 0}
        />
      </div>
    </div>
  )
}
