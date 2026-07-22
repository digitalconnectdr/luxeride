'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import {
  toggleAirportActiveAction,
  removeCompanyAirportAction,
} from '@/app/actions/services'

export function AirportActiveToggle({
  id,
  isActive,
}: {
  id: string
  isActive: boolean
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleAirportActiveAction(id, !isActive)
        })
      }
      className={[
        'text-xs font-medium px-2.5 py-1 rounded-lg border transition-all',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isActive
          ? 'text-green-700 border-green-300 bg-green-50 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
          : 'text-gray-500 border-gray-300 bg-gray-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300',
      ].join(' ')}
    >
      {isPending ? '…' : isActive ? 'Active' : 'Inactive'}
    </button>
  )
}

export function AirportRemoveButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() => {
        if (!confirm('¿Quitar este aeropuerto? Se eliminarán las tarifas configuradas.')) return
        startTransition(async () => {
          await removeCompanyAirportAction(id)
        })
      }}
      title="Quitar"
      aria-label="Quitar"
      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isPending ? <span className="text-xs">…</span> : <Trash2 size={14} strokeWidth={2} />}
    </button>
  )
}
