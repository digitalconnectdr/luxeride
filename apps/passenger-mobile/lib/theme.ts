// ── Sistema de diseño de LuxeRide Pasajero ─────────────────────────────────
// A diferencia de apps/driver-mobile (dark bronce/dorado), esta app usa el
// tema claro "Ivory" ya establecido en la web (apps/web/lib/brand.ts, fondo
// #faf9f6 visto en app/payment/success/page.tsx) — el mockup de referencia
// del pasajero es de fondo claro. Misma tipografía de marca (Playfair
// Display + Inter) y misma escala de espacio/radio que driver-mobile, para
// que ambas apps se sientan de la misma familia aunque una sea clara y la
// otra oscura.

export const color = {
  bg: '#faf9f6',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#f3f1ea',
  border: '#e8e4d9',
  borderStrong: '#d9d3c2',
  gold: '#b8873a',
  goldSoft: '#e9c176',
  bronze: '#8a6526',
  ink: '#1d1d1f',
  inkMuted: '#6b6558',
  inkFaint: '#9c9587',
  success: '#3f8f5c',
  successSoft: '#3f8f5c1a',
  danger: '#c0473d',
  dangerSoft: '#c0473d1a',
  warning: '#b8873a',
  warningSoft: '#b8873a1a',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const

export const font = {
  display: 'PlayfairDisplay_700Bold',
  displaySemi: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const

export const shadow = {
  card: {
    shadowColor: '#1d1d1f',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: '#1d1d1f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: {
    shadowColor: '#b8873a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
} as const

export const STATUS_COLOR: Record<string, string> = {
  quote: color.inkFaint,
  pending: color.inkFaint,
  assigned: color.gold,
  en_route: color.gold,
  arrived: color.warning,
  in_progress: color.success,
  completed: color.inkMuted,
  cancelled: color.danger,
  no_show: color.danger,
}
