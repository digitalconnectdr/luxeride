'use client'
// ── Lista de sujetos (conductores o cuentas corporativas) con estado de firma ──

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SignAgreementModal } from './sign-agreement-modal'

export interface AgreementSubject {
  id: string
  name: string
  signedAt: string | null
}

export function AgreementList({
  subjectType,
  title,
  agreementText,
  subjects,
  noneLabel,
}: {
  subjectType: 'driver' | 'corporate_account'
  title: string
  agreementText: string
  subjects: AgreementSubject[]
  noneLabel: string
}) {
  const router = useRouter()
  const [signing, setSigning] = useState<AgreementSubject | null>(null)

  return (
    <div className="bg-sl-surface border border-sl-outline-variant rounded-xl overflow-hidden">
      {!subjects.length ? (
        <p className="p-6 text-sm text-sl-on-surface-muted">{noneLabel}</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-b border-sl-outline-variant last:border-0">
                <td className="px-4 py-3 text-sl-on-surface">{s.name}</td>
                <td className="px-4 py-3 text-right">
                  {s.signedAt ? (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                      ✓ {new Date(s.signedAt).toLocaleDateString()}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSigning(s)}
                      className="text-xs font-medium px-3 py-1.5 bg-bronze text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Firmar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {signing && (
        <SignAgreementModal
          subjectType={subjectType}
          subjectId={signing.id}
          title={title}
          agreementText={agreementText}
          onClose={() => setSigning(null)}
          onSigned={() => { setSigning(null); router.refresh() }}
        />
      )}
    </div>
  )
}
