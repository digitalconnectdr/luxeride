// ── Parser CSV mínimo (sin dependencia externa) ───────────────────────────────
// Soporta comillas dobles (con "" escapado dentro) y comas/saltos de línea
// dentro de campos entrecomillados. Suficiente para exports típicos de Excel/
// Google Sheets — no pretende cubrir el estándar RFC 4180 completo.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += c
      }
      continue
    }
    if (c === '"') { inQuotes = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\n') {
      row.push(field); field = ''
      rows.push(row); row = []
      continue
    }
    field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0))
}

/** Convierte filas de encabezado + datos en objetos { columna: valor }. */
export function csvToRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const headers = rows[0]!.map((h) => h.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => { rec[h] = (row[i] ?? '').trim() })
    return rec
  })
}
