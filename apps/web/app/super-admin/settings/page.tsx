import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth/session'
import { UpdatePasswordForm } from '@/components/super-admin/update-password-form'

export const metadata: Metadata = { title: 'Mi cuenta' }
export const dynamic = 'force-dynamic'

export default async function SuperAdminSettingsPage() {
  const user = await requireRole('super_admin')
  const name = `${user.profile.first_name} ${user.profile.last_name}`.trim()

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Mi cuenta</h1>
        <p className="text-sm text-sl-on-surface-muted mt-1">Datos de tu sesión de super-admin y seguridad.</p>
      </div>

      <div className="bg-white border border-sl-outline-variant rounded-xl p-6 space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Nombre</p>
          <p className="text-sm text-sl-on-surface mt-1">{name || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Correo</p>
          <p className="text-sm text-sl-on-surface mt-1">{user.email}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sl-on-surface-muted">Rol</p>
          <p className="text-sm text-sl-on-surface mt-1">Super-admin</p>
        </div>
      </div>

      <div className="bg-white border border-sl-outline-variant rounded-xl p-6">
        <h2 className="text-sm font-semibold text-sl-on-surface mb-1">Cambiar contraseña</h2>
        <p className="text-xs text-sl-on-surface-muted mb-4">Se aplica de inmediato a tu sesión actual.</p>
        <UpdatePasswordForm />
      </div>
    </div>
  )
}
