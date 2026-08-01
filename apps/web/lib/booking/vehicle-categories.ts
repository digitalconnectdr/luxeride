// ── "Explora por categoría" del micrositio: filtro contra la flota real ────────
// dict.microsite.categories es una lista fija (marketing) de 6 ítems, igual en
// en/es/pt. Antes se mostraban las 6 sin importar la flota de la empresa (ej.
// "Coupes" aparecía aunque nadie tuviera un cupé). Este mapa posicional (mismo
// orden que el array del diccionario) dice qué vehicle_class real habilita
// cada categoría — null = transversal, siempre visible si hay flota activa.
// Clases reales: supabase/migrations/20260607000001_extensions.sql (vehicle_class).
const CATEGORY_CLASSES: (string[] | null)[] = [
  ['sedan'],
  ['suv'],
  ['exotic'],
  ['van', 'sprinter', 'bus'],
  ['limousine'],
  null,
]

/** Índices de dict.microsite.categories que la flota de la empresa justifica mostrar. */
export function visibleCategoryIndices(fleetClasses: string[]): number[] {
  const classes = new Set(fleetClasses)
  return CATEGORY_CLASSES.reduce<number[]>((acc, allowed, i) => {
    if (allowed === null || allowed.some((c) => classes.has(c))) acc.push(i)
    return acc
  }, [])
}
