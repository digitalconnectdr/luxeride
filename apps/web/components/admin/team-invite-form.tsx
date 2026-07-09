'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { inviteTeamMemberAction } from '@/app/actions/team'
import { ActionErrorBanner } from '@/components/admin/action-error-banner'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

type TeamDict = Dictionary['admin']['team']

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'

function SubmitButton({ t }: { t: TeamDict }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-60 transition-colors"
    >
      {pending ? t.adding : t.send}
    </button>
  )
}

export function TeamInviteForm({ t, isOwner }: { t: TeamDict; isOwner: boolean }) {
  const [state, formAction] = useFormState(inviteTeamMemberAction, null)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  function copyCreds() {
    if (!state?.email || !state?.tempPassword) return
    navigator.clipboard
      ?.writeText(`${state.email} / ${state.tempPassword}`)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <div className="bg-sl-surface border border-sl-outline-variant rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-sl-on-surface">{t.inviteTitle}</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
          >
            {t.addButton}
          </button>
        )}
      </div>

      {open && (
      <>
      {state && !state.success && state.error && (
        <div className="mb-4"><ActionErrorBanner error={state.error} /></div>
      )}

      {state?.success && state.tempPassword && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <p className="text-sm text-green-700 font-medium">{t.created}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="text-sm bg-white border border-green-200 rounded px-2 py-1 text-gray-800">
              {state.email}
            </code>
            <span className="text-green-700">·</span>
            <span className="text-xs text-green-700">{t.tempPasswordLabel}:</span>
            <code className="text-sm bg-white border border-green-200 rounded px-2 py-1 font-mono text-gray-800">
              {state.tempPassword}
            </code>
            <button
              type="button"
              onClick={copyCreds}
              className="text-xs font-medium text-bronze hover:text-bronze/80"
            >
              {copied ? t.copied : t.copy}
            </button>
          </div>
          <p className="mt-2 text-xs text-green-700/80">{t.credentialHint}</p>
        </div>
      )}

      {/* key fuerza el reset del formulario tras un alta exitosa */}
      <form key={state?.success ? state.email : 'form'} action={formAction}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.firstName} *</label>
            <input name="first_name" required placeholder="Jane" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.lastName} *</label>
            <input name="last_name" required placeholder="Smith" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.email} *</label>
            <input name="email" type="email" required placeholder="jane@example.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.phone}</label>
            <input name="phone" type="tel" placeholder="+1 (555) 000-0000" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-sl-on-surface-muted mb-1">{t.role} *</label>
            <select name="role" required className={inputCls}>
              <option value="">{t.selectRole}</option>
              {isOwner && <option value="company_admin">{t.roles.company_admin}</option>}
              <option value="dispatcher">{t.roles.dispatcher}</option>
              <option value="accounting">{t.roles.accounting}</option>
              <option value="driver">{t.roles.driver}</option>
              <option value="customer">{t.roles.customer}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end items-center gap-4">
          <button type="button" onClick={() => setOpen(false)} className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
            {t.cancel}
          </button>
          <SubmitButton t={t} />
        </div>
      </form>
      </>
      )}
    </div>
  )
}
