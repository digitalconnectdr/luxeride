'use client'

import { useState } from 'react'
import { NumberField, SelectField, ResultCard, formatUSD } from './calculator-ui'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type Content = Dictionary['resourceCenter']['driverCostCalculator']

export function DriverCostCalculator({ t }: { t: Content }) {
  const [payModel, setPayModel] = useState<'commission' | 'flat'>('commission')
  const [tripsPerMonth, setTripsPerMonth] = useState(60)
  const [avgFare, setAvgFare] = useState(150)
  const [commissionRate, setCommissionRate] = useState(30)
  const [flatRate, setFlatRate] = useState(40)

  const monthlyCost =
    payModel === 'commission'
      ? tripsPerMonth * avgFare * (commissionRate / 100)
      : tripsPerMonth * flatRate
  const costPerTrip = tripsPerMonth > 0 ? monthlyCost / tripsPerMonth : 0

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 sm:p-10">
      <h2 className="font-playfair text-2xl font-semibold mb-6">{t.calculatorTitle}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <SelectField
          label={t.inputPayModel}
          value={payModel}
          onChange={(v) => setPayModel(v as 'commission' | 'flat')}
          options={[
            { value: 'commission', label: t.payModelCommission },
            { value: 'flat', label: t.payModelFlat },
          ]}
        />
        <NumberField label={t.inputTripsPerMonth} value={tripsPerMonth} onChange={setTripsPerMonth} min={0} />
        {payModel === 'commission' ? (
          <>
            <NumberField label={t.inputAvgFare} value={avgFare} onChange={setAvgFare} prefix="$" min={0} />
            <NumberField label={t.inputCommissionRate} value={commissionRate} onChange={setCommissionRate} suffix="%" min={0} step={1} />
          </>
        ) : (
          <NumberField label={t.inputFlatRate} value={flatRate} onChange={setFlatRate} prefix="$" min={0} />
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ResultCard label={t.resultMonthlyCost} value={formatUSD(monthlyCost)} emphasis />
        <ResultCard label={t.resultCostPerTrip} value={formatUSD(costPerTrip)} />
      </div>
    </div>
  )
}
