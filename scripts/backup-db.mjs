#!/usr/bin/env node
// ── Respaldo manual de la base de datos de Supabase ───────────────────────────
// Uso: npm run db:backup (desde la raíz del proyecto).
// Lee la cadena de conexión desde scripts/.env.backup (nunca se sube a git —
// ver .gitignore) y usa el propio Supabase CLI (vía npx, sin pg_dump local)
// para generar un dump SQL completo, guardado en la carpeta de destino de
// abajo con la fecha del día en el nombre.

import { existsSync, mkdirSync, readFileSync, copyFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
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
      `Usa el "Session pooler" (NO "Direct connection" — ese host es IPv6-only y Docker no lo resuelve).\n`,
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
const fileName = `luxeride-db-${stamp}.sql`
const outFile = path.join(DEST_DIR, fileName)

// Se vuelca primero a una ruta temporal SIN espacios ni comas (os.tmpdir()).
// DEST_DIR sí los tiene ("...Plataforma de Transporte, Reservas...") y, al
// pasar por varias capas de shell (npm → npx → el binario de Supabase
// descargado), esas comillas se pierden en Windows y el CLI recibe la ruta
// partida en varios argumentos sueltos. Volcar a una ruta simple y luego
// mover el archivo con Node evita depender de que el quoting sobreviva.
const tmpFile = path.join(os.tmpdir(), fileName)

console.log(`Respaldando la base de datos...\n`)

// Se arma un solo string de comando (en vez de pasar un array de args junto
// a shell:true) porque Node emite un DeprecationWarning en ese caso — con
// el comando ya armado como texto no hay ambigüedad y no hace falta que Node
// escape nada por nosotros.
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`
// "@latest" es intencional: una copia vieja de la CLI en caché de npx trae
// un pg_dump que no soporta versiones nuevas de Postgres (ver nota abajo).
const cmd = `npx --yes supabase@latest db dump --db-url ${quote(dbUrl)} -f ${quote(tmpFile)}`

const result = spawnSync(cmd, { stdio: 'inherit', shell: true })

if (result.status !== 0) {
  console.error('\nEl respaldo falló. Revisa el mensaje de arriba (conexión, contraseña, etc).')
  process.exit(result.status ?? 1)
}

copyFileSync(tmpFile, outFile)
unlinkSync(tmpFile)

console.log(`\nListo. Respaldo guardado en:\n  ${outFile}`)
