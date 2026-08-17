'use client'

import { useState } from 'react'
import { NumberField, ResultCard, formatUSD, formatPercent } from './calculator-ui'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type Content = Dictionary['resourceCenter']['fleetProfitCalculator']

export function FleetProfitCalculator({ t }: { t: Content }) {
  const [vehicles, setVehicles] = useState(6)
  const [tripsPerVehicle, setTripsPerVehicle] = useState(25)
  const [avgFare, setAvgFare] = useState(150)
  const [costPerTrip, setCostPerTrip] = useState(60)

  const revenue = vehicles * tripsPerVehicle * avgFare
  const cost = vehicles * tripsPerVehicle * costPerTrip
  const profit = revenue - cost
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10">
      <h2 className="font-playfair text-2xl font-semibold mb-6">{t.calculatorTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <NumberField label={t.inputVehicles} value={vehicles} onChange={setVehicles} min={1} />
        <NumberField label={t.inputTripsPerVehicle} value={tripsPerVehicle} onChange={setTripsPerVehicle} min={0} />
        <NumberField label={t.inputAvgFare} value={avgFare} onChange={setAvgFare} prefix="$" min={0} />
        <NumberField
          label={t.inputCostPerTrip}
          value={costPerTrip}
          onChange={setCostPerTrip}
          prefix="$"
          min={0}
          helpText={t.inputCostPerTripHelp}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResultCard label={t.resultRevenue} value={formatUSD(revenue)} />
        <ResultCard label={t.resultCost} value={formatUSD(cost)} />
        <ResultCard label={t.resultProfit} value={formatUSD(profit)} emphasis />
      </div>
      <div className="mt-4">
        <ResultCard label={t.resultMargin} value={formatPercent(margin)} />
      </div>
    </div>
  )
}
