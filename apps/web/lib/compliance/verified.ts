// ── LuxeRide Verified ──────────────────────────────────────────────────────────
// Sello de confianza visible al pasajero en el micrositio. Deliberadamente NO
// es un motor nuevo: reusa el compliance_score que ya se calcula (ver
// lib/compliance/engine.ts) con el mismo umbral que ya define el status
// 'compliant' (score >= 90) — licencias, permisos y seguros al día.
//
// Se apoya en el compliance score y no en el Operator Score porque este
// último es volátil (cambia con tendencias de ingreso, conversión, etc.),
// y un sello de confianza al pasajero necesita ser estable y objetivo, no
// algo que suba y baje con el desempeño comercial del mes.
//
// Antigüedad del vehículo (paridad exacta con Uber Elite) queda fuera a
// propósito: el compliance engine no la evalúa hoy, y la política correcta
// varía por clase de vehículo (un Sprinter no envejece igual que un sedán).

export function isLuxeRideVerified(complianceScore: number | null | undefined): boolean {
  return complianceScore != null && complianceScore >= 90
}
