#!/usr/bin/env node
// ── Respaldo manual de la base de datos de Supabase ───────────────────────────
// Uso: npm run db:backup (desde la raíz del proyecto).
// Lee la cadena de conexión desde scripts/.env.backup (nunca se sube a git —
// ver .gitignore) y usa el propio Supabase CLI (vía npx, sin pg_dump local)
// para generar un dump SQL completo, guardado en la carpeta de destino de
// abajo con la fecha del día en el nombre.

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env.backup')

// Carpeta elegida por el usuario para guardar los respaldos.
const DEST_DIR = String.raw`D:\JPRS DIGITAL CONNECT\Proyectos\Plataforma de Transporte, Reservas y Apps Móviles\LuxeRide\Backups`

function loadDbUrl() {
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL

  if (!existsSync(envPath)) {
    console.error(
      `\nFalta configurar la conexión. Crea el archivo:\n  ${envPath}\n` +
      `con una sola línea:\n  SUPABASE_DB_URL=postgresql://postgres:TU_PASSWORD@TU_HOST:5432/postgres\n\n` +
      `Esa cadena sale de: Supabase → tu proyecto → Settings → Database → Connection string (URI).\n` +
      `Usa "Direct connection" (puerto 5432), no el pooler.\n`,
    )
    process.exit(1)
  }

  const line = readFileSync(envPath, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('SUPABASE_DB_URL='))

  if (!line) {
    console.error(`El archivo ${envPath} existe pero no tiene la línea SUPABASE_DB_URL=...`)
    process.exit(1)
  }

  return line.trim().slice('SUPABASE_DB_URL='.length).trim()
}

const dbUrl = loadDbUrl()

if (!existsSync(DEST_DIR)) {
  mkdirSync(DEST_DIR, { recursive: true })
}

const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
const outFile = path.join(DEST_DIR, `luxeride-db-${stamp}.sql`)

console.log(`Respaldando la base de datos a:\n  ${outFile}\n`)

const result = spawnSync(
  'npx',
  ['--yes', 'supabase', 'db', 'dump', '--db-url', dbUrl, '-f', outFile],
  { stdio: 'inherit', shell: true },
)

if (result.status !== 0) {
  console.error('\nEl respaldo falló. Revisa el mensaje de arriba (conexión, contraseña, etc).')
  process.exit(result.status ?? 1)
}

console.log(`\nListo. Respaldo guardado en:\n  ${outFile}`)
