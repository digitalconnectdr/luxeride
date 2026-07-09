// ── Sistema de diseño de LuxeRide Conductor ────────────────────────────────
// Paleta oscura de lujo (bronce/dorado), tipografía Playfair Display (cifras
// y titulares) + Inter (todo lo demás), escalas de espaciado/radio compartidas.
// Un solo lugar de verdad para que las pantallas no diverjan entre sí.

export const color = {
  bg: '#15130f',
  bgElevated: '#1c1a15',
  surface: '#221f19',
  surfaceRaised: '#2a261e',
  border: '#39332686',
  borderStrong: '#4a4234',
  gold: '#e9c176',
  goldSoft: '#f0d29b',
  bronze: '#9a7228',
  ink: '#f6f2ea',
  inkMuted: '#b3ab9c',
  inkFaint: '#8f887c',
  success: '#7fbf8f',
  successSoft: '#7fbf8f22',
  danger: '#e2726a',
  dangerSoft: '#e2726a22',
  warning: '#e0a458',
  warningSoft: '#e0a45822',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  floating: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
  },
  glow: {
    shadowColor: '#e9c176',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
} as const

export const STATUS_COLOR: Record<string, string> = {
  pending: color.inkFaint,
  assigned: color.gold,
  en_route: color.gold,
  arrived: color.warning,
  in_progress: color.success,
  completed: color.inkMuted,
  cancelled: color.danger,
  no_show: color.danger,
}
