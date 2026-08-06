'use client'

import { useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { runSystemHealthCheckAction } from '@/app/actions/system-health'

export function RunHealthCheckButton() {
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await runSystemHealthCheckAction()
      if (result.success) {
        toast.success('Chequeo completado')
      } else {
        toast.error(result.error ?? 'No se pudo verificar')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
    >
      <RefreshCw size={15} className={pending ? 'animate-spin' : ''} />
      {pending ? 'Verificando…' : 'Verificar ahora'}
    </button>
  )
}
