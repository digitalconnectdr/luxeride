import Link from 'next/link'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { TeamInviteForm } from '@/components/admin/team-invite-form'
import { TeamMemberActiveToggle, TeamMemberRoleSelect, TeamMemberResetPasswordButton } from '@/components/admin/team-controls'
import { getDict } from '@/lib/i18n/server'
import type { UserRole } from '@/lib/auth/permissions'

const ROLE_BADGE: Record<string, string> = {
  company_owner:  'bg-amber-50 text-amber-700 border-amber-200',
  company_admin:  'bg-blue-50 text-blue-700 border-blue-200',
  dispatcher:     'bg-purple-50 text-purple-700 border-purple-200',
  accounting:     'bg-teal-50 text-teal-700 border-teal-200',
  driver:         'bg-green-50 text-green-700 border-green-200',
}

// Roles que pertenecen al equipo operativo — deliberadamente excluye
// 'customer' (pasajeros, ahora en su propia pestaña) y 'corporate_manager'/
// 'corporate_user' (cuentas corporativas, gestionadas en /admin/corporate).
// Antes esta página no filtraba por rol en absoluto: cualquier pasajero que
// se registrara desde la app móvil (o una cuenta corporativa) aparecía aquí
// de forma permanente, mezclado con el staff real.
const STAFF_ROLES: UserRole[] = ['company_owner', 'company_admin', 'dispatcher', 'accounting', 'driver']

const CUSTOMERS_PAGE_SIZE = 20

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function escapeIlikePattern(term: string): string {
  // El filtro .or() de PostgREST usa "," y "(" ")" como sintaxis — envolver
  // el valor entre comillas dobles permite que el texto de búsqueda los
  // contenga sin romper el query (ver https://postgrest.org/en/stable/references/api/tables_views.html#operators).
  return `"%${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`
}

interface SearchParams {
  tab?: string
  q?: string
  from?: string
  to?: string
  page?: string
}

export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireRole('company_owner', 'company_admin')
  const isOwner = user.role === 'company_owner'
  const t = getDict().admin.team
  const admin = createAdminClient()
  const tab = searchParams.tab === 'customers' ? 'customers' : 'staff'

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-sl-on-surface tracking-tight">{t.title}</h1>
          <div className="w-10 h-[3px] bg-gold mt-2 mb-2.5 rounded-full" />
          <p className="text-sm text-sl-on-surface-muted">{tab === 'customers' ? t.customersSubtitle : t.subtitle}</p>
        </div>
      </div>

      {/* Pestañas */}
      <div className="inline-flex items-center gap-1 bg-sl-surface-variant/50 rounded-full p-1 border border-sl-outline-variant">
        <Link
          href="/admin/team?tab=staff"
          className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === 'staff' ? 'bg-gold text-white shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
          }`}
        >
          {t.tabStaff}
        </Link>
        <Link
          href="/admin/team?tab=customers"
          className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
            tab === 'customers' ? 'bg-gold text-white shadow-sm' : 'text-sl-on-surface-muted hover:text-sl-on-surface'
          }`}
        >
          {t.tabCustomers}
        </Link>
      </div>

      {tab === 'staff' ? (
        <StaffTab user={user} isOwner={isOwner} t={t} admin={admin} />
      ) : (
        <CustomersTab companyId={user.company_id!} t={t} admin={admin} searchParams={searchParams} />
      )}

    </div>
  )
}

async function StaffTab({
  user, isOwner, t, admin,
}: {
  user: Awaited<ReturnType<typeof requireRole>>
  isOwner: boolean
  t: ReturnType<typeof getDict>['admin']['team']
  admin: ReturnType<typeof createAdminClient>
}) {
  const { data: members } = await admin
    .from('user_profiles')
    .select('id, first_name, last_name, role, is_active, phone, created_at')
    .eq('company_id', user.company_id!)
    .in('role', STAFF_ROLES)
    .order('created_at', { ascending: true })

  return (
    <>
      <div className="flex justify-end -mt-2">
        <span className="text-xs text-sl-on-surface-muted">
          {members?.length ?? 0} {t.members}
        </span>
      </div>

      <TeamInviteForm t={t} isOwner={isOwner} />

      {!members || members.length === 0 ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{t.empty}</p>
        </div>
      ) : (
        <>
          {/* Mobile: tarjetas apiladas — más legible que una tabla angosta en el celular */}
          <div className="md:hidden space-y-3">
            {members.map((member) => {
              const isSelf = member.id === user.id
              const isOwnerRole = member.role === 'company_owner'

              return (
                <div key={member.id} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-4 space-y-3">
                  <div>
                    <p className="font-medium text-sl-on-surface">
                      {member.first_name} {member.last_name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-sl-on-surface-muted font-normal">{t.you}</span>
                      )}
                    </p>
                    {member.phone && (
                      <p className="text-xs text-sl-on-surface-muted mt-0.5">{member.phone}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.thRole}</p>
                      {isOwnerRole || isSelf ? (
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[member.role] ?? ''}`}>
                          {member.role.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <TeamMemberRoleSelect
                          memberId={member.id}
                          currentRole={member.role as UserRole}
                          roleLabels={t.roles}
                          saving={t.saving}
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.thStatus}</p>
                      {isOwnerRole || isSelf ? (
                        <span className={`text-xs font-medium ${member.is_active ? 'text-green-700' : 'text-gray-400'}`}>
                          {member.is_active ? t.active : t.inactive}
                        </span>
                      ) : (
                        <TeamMemberActiveToggle
                          memberId={member.id}
                          isActive={member.is_active}
                          labels={{ active: t.active, inactive: t.inactive }}
                        />
                      )}
                    </div>
                  </div>
                  {!isOwnerRole && !isSelf && (
                    <TeamMemberResetPasswordButton
                      memberId={member.id}
                      memberName={`${member.first_name} ${member.last_name}`}
                      labels={{
                        resetPassword: t.resetPassword,
                        resetPasswordConfirm: t.resetPasswordConfirm,
                        resetting: t.resetting,
                        resetSuccess: t.resetSuccess,
                        tempPasswordLabel: t.tempPasswordLabel,
                        copy: t.copy,
                        copied: t.copied,
                      }}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop/tablet: tabla completa */}
          <div className="hidden md:block bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thMember}</th>
                  <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thRole}</th>
                  <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thStatus}</th>
                  <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sl-outline-variant/50">
                {members.map((member) => {
                  const isSelf  = member.id === user.id
                  const isOwnerRole = member.role === 'company_owner'

                  return (
                    <tr key={member.id} className="hover:bg-sl-bg/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-sl-on-surface">
                          {member.first_name} {member.last_name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-sl-on-surface-muted font-normal">{t.you}</span>
                          )}
                        </p>
                        {member.phone && (
                          <p className="text-xs text-sl-on-surface-muted mt-0.5">{member.phone}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isOwnerRole || isSelf ? (
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_BADGE[member.role] ?? ''}`}>
                            {member.role.replace(/_/g, ' ')}
                          </span>
                        ) : (
                          <TeamMemberRoleSelect
                            memberId={member.id}
                            currentRole={member.role as UserRole}
                            roleLabels={t.roles}
                            saving={t.saving}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isOwnerRole || isSelf ? (
                          <span className={`text-xs font-medium ${member.is_active ? 'text-green-700' : 'text-gray-400'}`}>
                            {member.is_active ? t.active : t.inactive}
                          </span>
                        ) : (
                          <TeamMemberActiveToggle
                            memberId={member.id}
                            isActive={member.is_active}
                            labels={{ active: t.active, inactive: t.inactive }}
                          />
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {!isOwnerRole && !isSelf && (
                          <TeamMemberResetPasswordButton
                            memberId={member.id}
                            memberName={`${member.first_name} ${member.last_name}`}
                            labels={{
                              resetPassword: t.resetPassword,
                              resetPasswordConfirm: t.resetPasswordConfirm,
                              resetting: t.resetting,
                              resetSuccess: t.resetSuccess,
                              tempPasswordLabel: t.tempPasswordLabel,
                              copy: t.copy,
                              copied: t.copied,
                            }}
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}

async function CustomersTab({
  companyId, t, admin, searchParams,
}: {
  companyId: string
  t: ReturnType<typeof getDict>['admin']['team']
  admin: ReturnType<typeof createAdminClient>
  searchParams: SearchParams
}) {
  const q = (searchParams.q ?? '').trim()
  const from = searchParams.from ?? ''
  const to = searchParams.to ?? ''
  const hasFilters = !!(q || from || to)

  let query = admin
    .from('user_profiles')
    .select('id, first_name, last_name, phone, is_active, created_at', { count: 'exact' })
    .eq('company_id', companyId)
    .eq('role', 'customer')

  if (q) {
    const pattern = escapeIlikePattern(q)
    query = query.or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern}`)
  }
  if (from) query = query.gte('created_at', `${from}T00:00:00`)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1)
  const offset = (page - 1) * CUSTOMERS_PAGE_SIZE

  const { data: customers, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + CUSTOMERS_PAGE_SIZE - 1)

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / CUSTOMERS_PAGE_SIZE))

  // Email y último acceso viven en auth.users, no en user_profiles — se
  // resuelven solo para las filas de la página actual (máx.
  // CUSTOMERS_PAGE_SIZE llamadas), nunca para el total de pasajeros de la
  // empresa. last_sign_in_at ya viene incluido en la misma respuesta de
  // getUserById que se pedía solo por el email — no es una llamada extra.
  const customersWithEmail = await Promise.all(
    (customers ?? []).map(async (c) => {
      let email: string | null = null
      let lastSignInAt: string | null = null
      try {
        const { data } = await admin.auth.admin.getUserById(c.id)
        email = data.user?.email ?? null
        lastSignInAt = data.user?.last_sign_in_at ?? null
      } catch { /* usuario sin datos de auth accesibles — se omite */ }
      return { ...c, email, lastSignInAt }
    }),
  )

  function pageHref(p: number) {
    const params = new URLSearchParams({ tab: 'customers' })
    if (q) params.set('q', q)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (p > 1) params.set('page', String(p))
    return `/admin/team?${params.toString()}`
  }

  return (
    <>
      <div className="flex justify-end -mt-2">
        <span className="text-xs text-sl-on-surface-muted">
          {t.customersCount.replace('{count}', String(total))}
        </span>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="customers" />
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.thCustomer}</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={t.searchPlaceholder}
            className="w-full text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface placeholder:text-sl-on-surface-muted/50 focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.fromLabel}</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-sl-on-surface-muted mb-1">{t.toLabel}</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="text-sm bg-sl-bg border border-sl-outline-variant rounded-lg px-3 py-2 text-sl-on-surface focus:border-bronze focus:outline-none focus:ring-1 focus:ring-bronze"
          />
        </div>
        <button type="submit" className="px-4 py-2 text-sm font-semibold bg-gold text-gray-900 rounded-lg hover:bg-gold/90 transition-all">
          {t.filter}
        </button>
        {hasFilters && (
          <Link href="/admin/team?tab=customers" className="text-xs text-sl-on-surface-muted hover:text-sl-on-surface">
            {t.clearFilters}
          </Link>
        )}
      </form>

      {customersWithEmail.length === 0 ? (
        <div className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-12 text-center">
          <p className="text-sm text-sl-on-surface-muted">{hasFilters ? t.noResults : t.customersEmpty}</p>
        </div>
      ) : (
        <>
          {/* Mobile: tarjetas apiladas */}
          <div className="md:hidden space-y-3">
            {customersWithEmail.map((c) => (
              <div key={c.id} className="bg-white border border-sl-outline-variant rounded-2xl shadow-sm p-4 space-y-2">
                <p className="font-medium text-sl-on-surface">{c.first_name} {c.last_name}</p>
                {c.phone && <p className="text-xs text-sl-on-surface-muted">{c.phone}</p>}
                {c.email && <p className="text-xs text-sl-on-surface-muted">{c.email}</p>}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-sl-on-surface-muted space-y-0.5">
                    <p>{t.thSignupDate}: {formatDateTime(c.created_at)}</p>
                    <p>{t.thLastLogin}: {formatDateTime(c.lastSignInAt)}</p>
                  </div>
                  <span className={`text-xs font-medium ${c.is_active ? 'text-green-700' : 'text-gray-400'}`}>
                    {c.is_active ? t.active : t.inactive}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop/tablet */}
          <div className="hidden md:block bg-white border border-sl-outline-variant rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thCustomer}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thEmail}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thSignupDate}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thLastLogin}</th>
                    <th className="text-left px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">{t.thStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sl-outline-variant/50">
                  {customersWithEmail.map((c) => (
                    <tr key={c.id} className="hover:bg-sl-bg/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-sl-on-surface">{c.first_name} {c.last_name}</p>
                        {c.phone && <p className="text-xs text-sl-on-surface-muted mt-0.5">{c.phone}</p>}
                      </td>
                      <td className="px-6 py-4 text-sl-on-surface-muted">{c.email ?? '—'}</td>
                      <td className="px-6 py-4 text-sl-on-surface-muted">{formatDateTime(c.created_at)}</td>
                      <td className="px-6 py-4 text-sl-on-surface-muted">{formatDateTime(c.lastSignInAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium ${c.is_active ? 'text-green-700' : 'text-gray-400'}`}>
                          {c.is_active ? t.active : t.inactive}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-sl-on-surface-muted">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="text-bronze hover:text-bronze/80">{t.prevPage}</Link>
              ) : <span />}
              <span>{t.pageInfo.replace('{page}', String(page)).replace('{total}', String(totalPages))}</span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="text-bronze hover:text-bronze/80">{t.nextPage}</Link>
              ) : <span />}
            </div>
          )}
        </>
      )}
    </>
  )
}
