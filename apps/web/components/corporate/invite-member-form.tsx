'use client'
// ── Onboarding por link — alternativa a "agregar por email de usuario existente" ─
// Reusado tanto en el portal del cliente (manager corporativo, self-service)
// como en /admin/corporate/[id] (staff del operador) — cada llamador arma su
// propio objeto de etiquetas desde su propio diccionario i18n.

import { useState, useTransition } from 'react'
import { createCorporateMemberInviteAction } from '@/app/actions/corporate'
import { getAppUrl } from '@/lib/app-url'

export interface InviteMemberLabels {
  emailLabel: string
  emailPlaceholder?: string
  roleLabel: string
  roleUser: string
  roleManager: string
  costCenterLabel: string
  costCenterPlaceholder?: string
  spendingLimitLabel: string
  monthlyLimitLabel: string
  submit: string
  submitting: string
  linkGeneratedTitle: string
  linkHint: string
  copy: string
  copied: string
  error: string
}

const inputCls =
  'w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 ' +
  'text-sl-on-surface placeholder:text-sl-on-surface-muted/50 ' +
  'focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze'
const labelCls = 'block text-xs text-sl-on-surface-muted mb-1'

export function InviteMemberByLinkForm({ accountId, labels: t }: { accountId: string; labels: InviteMemberLabels }) {
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLink('')
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createCorporateMemberInviteAction(accountId, fd)
      if (!result.success || !result.data?.token) {
        setError(result.error ?? t.error)
        return
      }
      setLink(`${getAppUrl()}/corporate/join/${result.data.token}`)
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (link) {
    return (
      <div className="rounded-lg border border-bronze/30 bg-bronze/5 p-4 space-y-2">
        <p className="text-sm font-medium text-sl-on-surface">{t.linkGeneratedTitle}</p>
        <p className="text-xs text-sl-on-surface-muted">{t.linkHint}</p>
        <div className="flex items-center gap-2">
          <input readOnly value={link} className={`${inputCls} font-mono text-xs`} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 px-3 py-2 text-xs font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-colors"
          >
            {copied ? t.copied : t.copy}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>{t.emailLabel}</label>
          <input name="email" type="email" required placeholder={t.emailPlaceholder} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.roleLabel}</label>
          <select name="role" defaultValue="user" className={inputCls}>
            <option value="user">{t.roleUser}</option>
            <option value="manager">{t.roleManager}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{t.costCenterLabel}</label>
          <input name="cost_center" placeholder={t.costCenterPlaceholder} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.spendingLimitLabel}</label>
          <input name="spending_limit" type="number" min="0" step="10" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t.monthlyLimitLabel}</label>
          <input name="monthly_limit" type="number" min="0" step="100" className={inputCls} />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium bg-gold text-gray-900 rounded-lg hover:bg-gold/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  )
}
