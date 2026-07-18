'use client'

import { useFormState } from 'react-dom'
import { updatePasswordAction } from '@/app/actions/auth'

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

export function UpdatePasswordForm() {
  const [state, action, isPending] = useFormState(updatePasswordAction, null)

  return (
    <form action={action} className="space-y-3">
      {state && !state.success && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-600">Contraseña actualizada.</p>
      )}
      <div>
        <label htmlFor="password" className="block text-xs text-sl-on-surface-muted mb-1">Nueva contraseña</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={inputCls} placeholder="Mínimo 8 caracteres" />
        {state?.fieldErrors?.password && <p className="text-xs text-red-500 mt-1">{state.fieldErrors.password[0]}</p>}
      </div>
      <div>
        <label htmlFor="confirm_password" className="block text-xs text-sl-on-surface-muted mb-1">Confirmar contraseña</label>
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required className={inputCls} placeholder="Repite la contraseña" />
        {state?.fieldErrors?.confirm_password && <p className="text-xs text-red-500 mt-1">{state.fieldErrors.confirm_password[0]}</p>}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
      >
        {isPending ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </form>
  )
}
