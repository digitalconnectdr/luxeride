import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { CreateCorporateAccountForm } from '@/components/admin/corporate-controls'

export const metadata: Metadata = { title: 'Cuentas Corporativas' }

export default async function CorporateAccountsPage() {
  const user = await requireRole('company_owner', 'company_admin', 'accounting')
  if (!user.company_id) {
    return <p className="p-8 text-sl-on-surface-muted">Sin empresa asignada.</p>
  }

  const admin = createAdminClient()
  const { data: accounts } = await admin
    .from('corporate_accounts')
    .select('id, name, contact_name, contact_email, credit_limit, current_balance, payment_terms, billing_cycle, require_approval, is_active, created_at')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false })

  const canManage = ['company_owner', 'company_admin'].includes(user.role)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">
            Cuentas Corporativas
          </h1>
          <p className="text-sm text-sl-on-surface-muted mt-1">
            Empresas cliente con facturación a crédito y usuarios autorizados.
          </p>
        </div>
      </div>

      {canManage && <CreateCorporateAccountForm />}

      {!accounts?.length ? (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl p-10 text-center">
          <p className="text-sm text-sl-on-surface-muted">
            No hay cuentas corporativas todavía.
          </p>
        </div>
      ) : (
        <div className="bg-sl-surface-high border border-sl-outline-variant rounded-2xl overflow-hidden divide-y divide-sl-outline-variant">
          {accounts.map((acc) => (
            <Link
              key={acc.id}
              href={`/admin/corporate/${acc.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-sl-bg/50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-sl-on-surface">{acc.name}</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      acc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {acc.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                  {acc.require_approval && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-[#0071e3]">
                      Requiere aprobación
                    </span>
                  )}
                </div>
                <p className="text-xs text-sl-on-surface-muted mt-1">
                  {acc.contact_name ?? '—'}
                  {acc.contact_email && ` · ${acc.contact_email}`}
                  {` · Net ${acc.payment_terms ?? 30} días`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-sl-on-surface">
                  ${Number(acc.current_balance ?? 0).toFixed(2)}
                  <span className="text-xs font-normal text-sl-on-surface-muted">
                    {' '}/ ${Number(acc.credit_limit ?? 0).toFixed(0)}
                  </span>
                </p>
                <p className="text-[10px] text-sl-on-surface-muted uppercase tracking-wider mt-0.5">
                  Balance / Límite
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
