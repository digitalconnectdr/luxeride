import type { Metadata } from 'next'
import { Lightbulb, Mail } from 'lucide-react'
import { requireRole } from '@/lib/auth/session'
import { getDict } from '@/lib/i18n/server'

export function generateMetadata(): Metadata {
  return { title: getDict().admin.help.title }
}

export default async function HelpPage() {
  await requireRole('super_admin', 'company_owner', 'company_admin', 'dispatcher', 'accounting')

  const dict = getDict()
  const t = dict.admin.help

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-8">
      <div>
        <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
        <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
        <p className="text-sm text-sl-on-surface-muted max-w-2xl">{t.subtitle}</p>
      </div>

      <div className="space-y-8">
        {t.categories.map((cat) => (
          <div key={cat.heading}>
            <h2 className="font-playfair text-lg font-semibold text-sl-on-surface mb-3">{cat.heading}</h2>
            <div className="space-y-3">
              {cat.items.map((item) => (
                <div key={item.q} className="bg-white border border-sl-outline-variant rounded-xl p-4">
                  <p className="text-sm font-semibold text-sl-on-surface">{item.q}</p>
                  <p className="text-sm text-sl-on-surface-muted mt-1">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-sl-bg border border-sl-outline-variant rounded-xl p-5 flex items-start gap-3">
        <Lightbulb size={18} className="text-bronze shrink-0 mt-0.5" />
        <p className="text-sm text-sl-on-surface">{t.feedbackHint}</p>
      </div>

      <div className="flex items-center gap-2 text-sm text-sl-on-surface-muted">
        <Mail size={14} className="shrink-0" />
        <span>{t.stillNeedHelp}</span>
        <a href={`mailto:${t.contactEmail}`} className="text-bronze font-medium hover:underline">
          {t.contactEmail}
        </a>
      </div>
    </div>
  )
}
