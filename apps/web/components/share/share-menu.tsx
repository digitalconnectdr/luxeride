'use client'
// ── Menú de compartir — mismo patrón de dropdown que LanguageSwitcher (click
// para abrir, cierra con click afuera/Escape). Íconos genéricos por red +
// etiqueta de texto (no se reproduce ningún logo con derechos de autor —
// igual que el ícono de WhatsApp ya existente en el footer del micrositio).
// Instagram no tiene un "share intent" web público como el resto de redes —
// se copia el link y se abre instagram.com, con una pista para pegarlo en
// la bio/historia.

import { useEffect, useRef, useState } from 'react'

export interface ShareLabels {
  share: string
  copyLink: string
  copied: string
  instagramHint: string
}

function openShareWindow(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=650')
}

const ShareGlyph = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
    <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
  </svg>
)

const WhatsAppIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
)

const TelegramIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
)

const LinkedInIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="8" width="4" height="12" /><circle cx="5" cy="4" r="1.6" />
    <path d="M11 20v-8" /><path d="M11 12.5c0-1.5 1.3-2.5 3-2.5 2 0 3 1.3 3 3.6V20" />
  </svg>
)

const RedditIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <ellipse cx="12" cy="14" rx="8" ry="6" />
    <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
    <path d="M9 17c1 .8 5 .8 6 0" />
    <path d="M12 8V4" /><circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const FacebookIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 4h-2a4 4 0 0 0-4 4v3H7v4h2v9h4v-9h2.5l.5-4H13V8a1 1 0 0 1 1-1h2z" />
  </svg>
)

const EmailIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" />
  </svg>
)

const InstagramIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const LinkIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 17H7a5 5 0 0 1 0-10h2" /><path d="M15 7h2a5 5 0 0 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" />
  </svg>
)

export function ShareMenu({
  url,
  title,
  variant = 'dark',
  labels,
}: {
  url: string
  title: string
  variant?: 'dark' | 'light'
  labels: ShareLabels
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const enc = encodeURIComponent
  const t = enc(title)
  const u = enc(url)

  const items = [
    { key: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, action: () => openShareWindow(`https://wa.me/?text=${t}%20${u}`) },
    { key: 'telegram', label: 'Telegram', icon: TelegramIcon, action: () => openShareWindow(`https://t.me/share/url?url=${u}&text=${t}`) },
    { key: 'facebook', label: 'Facebook', icon: FacebookIcon, action: () => openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${u}`) },
    { key: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon, action: () => openShareWindow(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`) },
    { key: 'reddit', label: 'Reddit', icon: RedditIcon, action: () => openShareWindow(`https://www.reddit.com/submit?url=${u}&title=${t}`) },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: InstagramIcon,
      action: () => {
        copyLink()
        window.open('https://instagram.com', '_blank', 'noopener,noreferrer')
      },
    },
    { key: 'email', label: 'Email', icon: EmailIcon, action: () => { window.location.href = `mailto:?subject=${t}&body=${enc(`${title}\n\n${url}`)}` } },
  ]

  const dark = variant === 'dark'

  const buttonCls = dark
    ? 'border-white/15 text-white/70 hover:border-[#e9c176]/60 hover:text-white'
    : 'border-[#e5e1d8] bg-white text-[#75716a] hover:border-bronze hover:text-[#1d1b18]'

  const menuCls = dark
    ? 'bg-[#1c1916] border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)]'
    : 'bg-white border-[#e5e1d8] shadow-[0_8px_30px_rgba(29,27,24,0.12)]'

  const itemCls = dark
    ? 'text-white/70 hover:bg-white/[0.06] hover:text-white'
    : 'text-[#4e4639] hover:bg-[#faf8f3] hover:text-[#1d1b18]'

  const hintCls = dark ? 'text-white/40' : 'text-[#9a948a]'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={labels.share}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 cursor-pointer transition-colors ${buttonCls}`}
      >
        {ShareGlyph}
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-2 z-50 min-w-[190px] rounded-xl border p-1.5 ${menuCls}`}>
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => { it.action(); if (it.key !== 'instagram') setOpen(false) }}
              className={`w-full flex items-center gap-2.5 text-left text-[13px] rounded-lg px-3 py-2 transition-colors ${itemCls}`}
            >
              {it.icon}
              <span className="flex-1">{it.label}</span>
            </button>
          ))}
          <div className={`my-1 h-px ${dark ? 'bg-white/10' : 'bg-[#e5e1d8]'}`} />
          <button
            type="button"
            onClick={copyLink}
            className={`w-full flex items-center gap-2.5 text-left text-[13px] rounded-lg px-3 py-2 transition-colors ${itemCls}`}
          >
            {LinkIcon}
            <span className="flex-1">{copied ? labels.copied : labels.copyLink}</span>
          </button>
          <p className={`px-3 pt-1.5 text-[10.5px] leading-snug ${hintCls}`}>{labels.instagramHint}</p>
        </div>
      )}
    </div>
  )
}
