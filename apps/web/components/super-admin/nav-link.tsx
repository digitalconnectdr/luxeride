'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()
  // Match exact path OR any sub-path (e.g. /super-admin/companies/[id])
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      prefetch={false}
      className={[
        'flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
        isActive
          ? 'bg-gold/10 text-bronze'
          : 'text-sl-on-surface-muted hover:text-sl-on-surface hover:bg-sl-bg/60',
      ].join(' ')}
    >
      {label}
    </Link>
  )
}
