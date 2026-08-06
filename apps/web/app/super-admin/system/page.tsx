import type { Metadata } from 'next'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { requireRole } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/server'
import { SERVICE_LABELS, type HealthStatus } from '@/lib/monitoring/health'
import { getSuperAdminEmails, getSuperAdminPhones } from '@/lib/notifications'
import { InfoTip } from '@/components/ui/info-tip'
import { RunHealthCheckButton } from '@/components/super-admin/run-health-check-button'

export const metadata: Metadata = { title: 'Sistema' }
export const dynamic = 'force-dynamic'

const SERVICE_ORDER = [
  'supabase', 'db_capacity', 'vercel', 'gps_tracking',
  'twilio', 'resend', 'stripe', 'whop',
  'google_maps', 'openai', 'flight_tracking',
]

const STATUS_STYLE: Record<HealthStatus, { label: string; dot: string; badge: string }> = {
  ok: { label: 'Operativo', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700' },
  degraded: { label: 'Degradado', dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700' },
  down: { label: 'Caído', dot: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
  unknown: { label: 'Sin datos', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

export default async function SystemHealthPage() {
  await requireRole('super_admin')

  const admin = createAdminClient()
  const [{ data: rows }, superAdminEmails, superAdminPhones] = await Promise.all([
    admin.from('system_health_checks').select('*'),
    getSuperAdminEmails(),
    getSuperAdminPhones(),
  ])

  const byService = new Map((rows ?? []).map((r) => [r.service, r]))
  const capacityRow = byService.get('db_capacity')
  const capacityMeta = capacityRow?.meta as { usedBytes?: number; limitBytes?: number; limitGb?: number; pctUsed?: number } | null

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-playfair text-3xl font-semibold text-sl-on-surface">Sistema</h1>
          <p className="text-sm text-sl-on-surface-muted mt-1 max-w-[70ch]">
            Estado de todos los servicios que usa LuxeRide, en un solo lugar. Los chequeos corren bajo demanda —
            no hay un proceso corriendo todo el tiempo en el fondo.
          </p>
        </div>
        <RunHealthCheckButton />
      </div>

      {/* ── Capacidad de la base de datos ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl px-6 py-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a] flex items-center">
            Capacidad de la base de datos (Supabase)
            <InfoTip text="Tamaño real de la base de datos vs. el límite configurado en SUPABASE_STORAGE_LIMIT_GB (por defecto 8 GB, el incluido en el plan Pro). Ajusta esa variable si tu plan tiene otro límite." />
          </p>
          {capacityMeta?.pctUsed !== undefined && (
            <span className="text-sm font-semibold text-[#1d1b18]">{capacityMeta.pctUsed.toFixed(1)}%</span>
          )}
        </div>
        {capacityMeta?.usedBytes !== undefined && capacityMeta?.limitBytes !== undefined ? (
          <>
            <div className="h-2.5 rounded-full bg-[#f0ede5] overflow-hidden">
              <div
                className={`h-full rounded-full ${(capacityMeta.pctUsed ?? 0) >= 90 ? 'bg-red-500' : (capacityMeta.pctUsed ?? 0) >= 75 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, capacityMeta.pctUsed ?? 0)}%` }}
              />
            </div>
            <p className="text-xs text-[#75716a] mt-2">
              {formatBytes(capacityMeta.usedBytes)} usados de {capacityMeta.limitGb} GB configurados
            </p>
          </>
        ) : (
          <p className="text-sm text-[#75716a]">Sin datos todavía — pulsa &quot;Verificar ahora&quot;.</p>
        )}
      </div>

      {/* ── Grid de servicios ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICE_ORDER.filter((s) => s !== 'db_capacity').map((service) => {
          const row = byService.get(service)
          const status = (row?.status ?? 'unknown') as HealthStatus
          const style = STATUS_STYLE[status]
          return (
            <div key={service} className="bg-white border border-[#e5e1d8] rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#1d1b18]">{SERVICE_LABELS[service] ?? service}</p>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              </div>
              {row?.message && <p className="text-xs text-[#75716a] mt-1.5">{row.message}</p>}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#a8a39a]">
                {row?.response_ms !== null && row?.response_ms !== undefined && <span>{row.response_ms}ms</span>}
                {row?.checked_at && (
                  <span>hace {formatDistanceToNow(new Date(row.checked_at), { locale: es })}</span>
                )}
                {!row && <span>Nunca verificado</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Configuración de alertas ── */}
      <div className="bg-white border border-[#e5e1d8] rounded-xl px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#75716a] mb-3 flex items-center">
          Alertas automáticas
          <InfoTip text="El cron /api/cron/system-health corre estos mismos chequeos y avisa por email + SMS SOLO cuando un servicio pasa de funcionando a caído (o se recupera) — nunca en cada corrida, para no saturar." />
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#a8a39a] mb-1">Email (SUPER_ADMIN_EMAIL)</p>
            {superAdminEmails.length > 0 ? (
              <ul className="text-[#1d1b18] space-y-0.5">
                {superAdminEmails.map((e) => <li key={e}>{e}</li>)}
              </ul>
            ) : (
              <p className="text-orange-600">Sin destinatarios configurados</p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[#a8a39a] mb-1">SMS (SUPER_ADMIN_PHONE)</p>
            {superAdminPhones.length > 0 ? (
              <ul className="text-[#1d1b18] space-y-0.5">
                {superAdminPhones.map((p) => <li key={p}>{p}</li>)}
              </ul>
            ) : (
              <p className="text-orange-600">Sin destinatarios configurados</p>
            )}
          </div>
        </div>
        <p className="text-[11px] text-[#75716a] mt-4 max-w-[75ch]">
          Importante: si el proyecto está en el plan Hobby de Vercel, los Cron Jobs solo corren una vez al día —
          insuficiente para detectar una caída en tiempo real. Para eso, apunta un monitor externo gratuito
          (ej. UptimeRobot, cada 5 minutos) a <code className="text-[11px] bg-[#f0ede5] px-1 py-0.5 rounded">/api/health</code>,
          que corre fuera de Vercel y sí detecta si la app deja de responder desde afuera.
        </p>
      </div>
    </div>
  )
}
