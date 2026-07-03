'use client'

import { useState, useTransition } from 'react'
import { toggleTeamMemberActiveAction, updateTeamMemberRoleAction, resetTeamMemberPasswordAction } from '@/app/actions/team'
import type { UserRole } from '@/lib/auth/permissions'

const DEFAULT_ROLES: Record<string, string> = {
  company_admin: 'Admin',
  dispatcher: 'Dispatcher',
  accounting: 'Accounting',
  driver: 'Driver',
  customer: 'Customer',
}

const ASSIGNABLE: UserRole[] = ['company_admin', 'dispatcher', 'accounting', 'driver', 'customer']

export function TeamMemberActiveToggle({
  memberId,
  isActive,
  labels = { active: 'Active', inactive: 'Inactive' },
}: {
  memberId: string
  isActive: boolean
  labels?: { active: string; inactive: string }
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await toggleTeamMemberActiveAction(memberId, !isActive)
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
      {isPending ? '…' : isActive ? labels.active : labels.inactive}
    </button>
  )
}

export function TeamMemberRoleSelect({
  memberId,
  currentRole,
  roleLabels = DEFAULT_ROLES,
  saving = 'Saving…',
}: {
  memberId: string
  currentRole: UserRole
  roleLabels?: Record<string, string>
  saving?: string
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentRole}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            await updateTeamMemberRoleAction(memberId, e.target.value as UserRole)
          })
        }
        className="text-xs bg-sl-bg border border-sl-outline-variant rounded-lg px-2 py-1 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {ASSIGNABLE.map((r) => (
          <option key={r} value={r}>{roleLabels[r] ?? r}</option>
        ))}
      </select>
      {isPending && <span className="text-xs text-sl-on-surface-muted animate-pulse">{saving}</span>}
    </div>
  )
}

export function TeamMemberResetPasswordButton({
  memberId,
  memberName,
  labels,
}: {
  memberId: string
  memberName: string
  labels: {
    resetPassword: string
    resetPasswordConfirm: string
    resetting: string
    resetSuccess: string
    tempPasswordLabel: string
    copy: string
    copied: string
  }
}) {
  const [isPending, startTransition] = useTransition()
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleClick() {
    if (!window.confirm(labels.resetPasswordConfirm.replace('{name}', memberName))) return
    setError(null)
    startTransition(async () => {
      const res = await resetTeamMemberPasswordAction(memberId)
      if (res.success && res.tempPassword) setTempPassword(res.tempPassword)
      else setError(res.error ?? 'Error')
    })
  }

  function copyPassword() {
    if (!tempPassword) return
    navigator.clipboard?.writeText(tempPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  if (tempPassword) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 max-w-xs">
        <p className="text-xs text-green-700 font-medium">{labels.resetSuccess}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="text-xs bg-white border border-green-200 rounded px-2 py-1 font-mono text-gray-800">
            {tempPassword}
          </code>
          <button type="button" onClick={copyPassword} className="text-xs font-medium text-bronze hover:text-bronze/80 shrink-0">
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="text-xs font-medium text-sl-on-surface-muted hover:text-bronze disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? labels.resetting : labels.resetPassword}
      </button>
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}
