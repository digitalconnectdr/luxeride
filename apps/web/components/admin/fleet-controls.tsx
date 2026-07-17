'use client'

import { useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  updateVehicleStatus,
  assignDriverToVehicle,
  toggleDriverAvailability,
  toggleVehicleTypeActive,
} from '@/app/actions/fleet'
import type { VehicleStatus } from '@/lib/supabase/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type FleetDict = Dictionary['admin']['fleet']

const EN_STATUSES = { available: 'Available', on_trip: 'On trip', maintenance: 'Maintenance', offline: 'Offline', retired: 'Retired' }

const selectCls =
  'text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2.5 text-sl-on-surface min-w-[9rem] ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition-all'

// Estilo de píldora por estado — verde suave para "Disponible" (semántico,
// no ligado al dorado de marca), tonos neutros para el resto.
const STATUS_PILL: Record<VehicleStatus, { pill: string; dot: string }> = {
  available:   { pill: 'bg-green-50 border-green-200 text-green-800', dot: 'bg-green-500' },
  on_trip:     { pill: 'bg-blue-50 border-blue-200 text-blue-800',    dot: 'bg-blue-500' },
  maintenance: { pill: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
  offline:     { pill: 'bg-gray-100 border-gray-200 text-gray-600',   dot: 'bg-gray-400' },
  retired:     { pill: 'bg-gray-100 border-gray-200 text-gray-500',   dot: 'bg-gray-400' },
}

// ── Vehicle Status Select ─────────────────────────────────────────────────────

export function VehicleStatusSelect({
  vehicleId,
  current,
  statuses = EN_STATUSES,
  saving = 'Saving…',
}: {
  vehicleId: string
  current: VehicleStatus
  statuses?: FleetDict['statuses']
  saving?: string
}) {
  const [isPending, startTransition] = useTransition()
  const style = STATUS_PILL[current]

  return (
    <div className="flex items-center gap-2">
      <div className={`relative inline-flex items-center gap-2 rounded-full border pl-3 pr-7 py-1.5 ${style.pill}`}>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
        <select
          defaultValue={current}
          disabled={isPending}
          onChange={(e) =>
            startTransition(async () => {
              await updateVehicleStatus(vehicleId, e.target.value as VehicleStatus)
            })
          }
          className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer appearance-none disabled:cursor-not-allowed"
        >
          <option value="available">{statuses.available}</option>
          <option value="on_trip">{statuses.on_trip}</option>
          <option value="maintenance">{statuses.maintenance}</option>
          <option value="offline">{statuses.offline}</option>
          <option value="retired">{statuses.retired}</option>
        </select>
        <ChevronDown size={12} className="absolute right-2.5 opacity-50 pointer-events-none" />
      </div>
      {isPending && <span className="text-xs text-sl-on-surface-muted animate-pulse">Saving…</span>}
    </div>
  )
}

// ── Driver Assign Select ──────────────────────────────────────────────────────

export function DriverAssignSelect({
  vehicleId,
  currentDriverId,
  drivers,
  unassigned = 'Unassigned',
}: {
  vehicleId: string
  currentDriverId: string | null
  drivers: Array<{ id: string; first_name: string; last_name: string }>
  unassigned?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentDriverId ?? ''}
        disabled={isPending}
        onChange={(e) => {
          const val = e.target.value || null
          startTransition(async () => {
            await assignDriverToVehicle(vehicleId, val)
          })
        }}
        className={selectCls}
      >
        <option value="">{unassigned}</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.first_name} {d.last_name}
          </option>
        ))}
      </select>
      {isPending && <span className="text-xs text-sl-on-surface-muted animate-pulse">Saving…</span>}
    </div>
  )
}

// ── Driver Availability Toggle ────────────────────────────────────────────────

export function DriverAvailabilityToggle({
  driverId,
  isAvailable,
  labels = { available: 'Available', unavailable: 'Unavailable' },
  saving = 'Saving…',
}: {
  driverId: string
  isAvailable: boolean
  labels?: FleetDict['availability']
  saving?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleDriverAvailability(driverId, !isAvailable)
        })
      }
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isAvailable
          ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
          : 'bg-sl-outline-variant/20 text-sl-on-surface-muted border-sl-outline-variant/40 hover:bg-sl-outline-variant/30',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-green-400' : 'bg-sl-on-surface-muted'}`} />
      {isPending ? saving : isAvailable ? labels.available : labels.unavailable}
    </button>
  )
}

// ── Vehicle Type Active Toggle ────────────────────────────────────────────────

export function VehicleTypeActiveToggle({
  typeId,
  isActive,
  labels = { active: 'Active', inactive: 'Inactive' },
}: {
  typeId: string
  isActive: boolean
  labels?: FleetDict['activeToggle']
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleVehicleTypeActive(typeId, !isActive)
        })
      }
      className={[
        'text-xs font-medium px-2 py-1 rounded-lg border transition-all',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isActive
          ? 'text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
          : 'text-sl-on-surface-muted border-sl-outline-variant/40 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/20',
      ].join(' ')}
    >
      {isPending ? '…' : isActive ? labels.active : labels.inactive}
    </button>
  )
}
