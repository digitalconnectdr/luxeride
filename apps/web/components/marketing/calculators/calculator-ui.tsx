'use client'

// ── Piezas de UI compartidas por las 5 calculadoras del Resource Center ────
// Cada calculadora es 100% aritmética sobre lo que el visitante escribe —
// ningún componente aquí trae datos, promedios o benchmarks precargados.

export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step = 1,
  helpText,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  min?: number
  step?: number
  helpText?: string
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-white/70 mb-2">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => {
            const raw = e.target.value
            const parsed = raw === '' ? 0 : parseFloat(raw)
            onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : 0)
          }}
          className={`w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 text-[15px] font-semibold text-white focus:outline-none focus:border-[#e9c176]/60 transition-colors ${
            prefix ? 'pl-8' : 'pl-4'
          } ${suffix ? 'pr-12' : 'pr-4'}`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="mt-1.5 text-[12px] text-white/35">{helpText}</p>}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-white/70 mb-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/[0.04] border border-white/10 rounded-xl py-3 px-4 text-[15px] font-semibold text-white focus:outline-none focus:border-[#e9c176]/60 transition-colors appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#141313] text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ResultCard({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-5 ${
        emphasis
          ? 'bg-gradient-to-br from-[#1a1712] to-[#12100d] border-2 border-[#e9c176]/50'
          : 'bg-white/[0.03] border border-white/10'
      }`}
    >
      <p className="text-[12px] text-white/45">{label}</p>
      <p className={`mt-1.5 font-playfair font-semibold ${emphasis ? 'text-[#e9c176] text-3xl' : 'text-white text-2xl'}`}>
        {value}
      </p>
    </div>
  )
}

export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return '0%'
  return `${n.toFixed(1)}%`
}
