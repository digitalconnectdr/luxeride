'use client'
// ── Modal de firma de acuerdo (conductor o cuenta corporativa) ─────────────────

import { useState, useTransition } from 'react'
import { SignaturePad } from './signature-pad'
import { signDriverAgreementAction, signCorporateAgreementAction } from '@/app/actions/esignature'

export function SignAgreementModal({
  subjectType,
  subjectId,
  title,
  agreementText,
  onClose,
  onSigned,
}: {
  subjectType: 'driver' | 'corporate_account'
  subjectId: string
  title: string
  agreementText: string
  onClose: () => void
  onSigned: () => void
}) {
  const [signedByName, setSignedByName] = useState('')
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!signedByName.trim()) { setError('El nombre es obligatorio'); return }
    if (!signatureDataUrl) { setError('Falta la firma'); return }
    setError('')
    startTransition(async () => {
      const action = subjectType === 'driver' ? signDriverAgreementAction : signCorporateAgreementAction
      const result = await action(subjectId, signedByName, signatureDataUrl)
      if (!result.success) { setError(result.error ?? 'Error'); return }
      onSigned()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <h2 className="font-playfair text-lg font-semibold text-[#1d1d1f]">{title}</h2>

        <div className="max-h-48 overflow-y-auto text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3">
          {agreementText}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Nombre de quien firma</label>
          <input
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Firma</label>
          <SignaturePad onChange={setSignatureDataUrl} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-[#1d1d1f]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium bg-[#1d1d1f] text-white rounded-lg disabled:opacity-50"
          >
            {isPending ? 'Firmando…' : 'Firmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
