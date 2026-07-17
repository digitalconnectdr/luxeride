'use client'
// ── Generador de contenido de marketing (AI Growth Assistant) ─────────────────

import { useState, useTransition } from 'react'
import { generateGrowthContentAction } from '@/app/actions/ai-growth'
import type { Dictionary } from '@/lib/i18n/server'

type T = Dictionary['admin']['growthAssistant']

export function ContentGenerator({ t }: { t: T }) {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const res = await generateGrowthContentAction(prompt)
      if (!res.success || !res.data) {
        setError(res.error ?? 'Error')
        return
      }
      setResult(res.data.text)
    })
  }

  function copyResult() {
    navigator.clipboard?.writeText(result)
  }

  return (
    <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-sm font-semibold text-sl-on-surface">{t.generatorTitle}</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t.generatorPlaceholder}
          rows={3}
          maxLength={500}
          className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending || !prompt.trim()}
          className="px-4 py-2 text-sm font-medium bg-bronze text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isPending ? t.generating : t.generate}
        </button>
      </form>

      {result && (
        <div className="bg-sl-bg border border-sl-outline-variant rounded-lg p-4 space-y-2">
          <p className="text-sm text-sl-on-surface whitespace-pre-wrap">{result}</p>
          <button type="button" onClick={copyResult} className="text-xs font-medium text-bronze hover:opacity-80">
            {t.copyResult}
          </button>
        </div>
      )}
    </div>
  )
}
