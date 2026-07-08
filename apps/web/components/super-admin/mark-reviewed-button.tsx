'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { markComplianceReviewedAction } from '@/app/actions/compliance'

export function MarkReviewedButton({ entity, id }: { entity: 'company' | 'driver' | 'vehicle'; id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await markComplianceReviewedAction(entity, id)
          router.refresh()
        })
      }
      className="text-xs text-bronze hover:text-bronze/80 disabled:opacity-50 transition-colors shrink-0"
    >
      {isPending ? 'Guardando…' : 'Marcar revisada →'}
    </button>
  )
}
