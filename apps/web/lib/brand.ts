// ── Marca centralizada ────────────────────────────────────────────────────────
// Punto único de verdad para el nombre del sistema. Para renombrar la marca en
// el futuro, cambiar SOLO estos valores: los diccionarios i18n y la UI los
// interpolan vía brand.name / brand.poweredBy / brand.legal.
//
// En las cadenas de los diccionarios se usa el placeholder {brand}, que se
// resuelve con withBrand() al renderizar (o se interpola directo con ${brand.name}).

export const brand = {
  /** Nombre comercial del producto. */
  name: 'LuxeRide',
  /** Empresa que desarrolla / opera la plataforma. */
  poweredBy: 'JPRS Digital Connect',
} as const

/** "LuxeRide — Powered by JPRS Digital Connect" */
export const brandLegal = `${brand.name} | Powered by ${brand.poweredBy}`

/**
 * Reemplaza el placeholder {brand} por el nombre real de la marca.
 * Útil para cadenas i18n que mencionan el producto.
 */
export function withBrand(text: string): string {
  return text.replace(/\{brand\}/g, brand.name)
}
