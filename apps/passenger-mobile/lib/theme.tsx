// ── Sistema de diseño de LuxeRide Pasajero — claro + oscuro ────────────────
// Antes esta app era SOLO clara (tema "Ivory" de la web). El mockup de
// referencia del pasajero pasó a ser oscuro-lujo (negro azulado + dorado), y
// el usuario pidió explícitamente poder elegir entre claro y oscuro — así que
// el `color` que antes era un objeto estático importado a nivel de módulo
// ahora vive en un contexto, y cada pantalla obtiene su paleta con
// useTheme()/useThemedStyles().
//
// Por qué useThemedStyles y no StyleSheet.create suelto: StyleSheet.create se
// evalúa UNA vez al importar el módulo, así que congelaría los colores del
// primer tema para siempre. La fábrica de estilos recibe la paleta y su
// resultado se cachea por (fábrica, paleta) — cambiar de tema recalcula una
// sola vez por pantalla, no en cada render.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme, type StyleProp } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

// ── Paletas ────────────────────────────────────────────────────────────────
// Ambas exponen exactamente las mismas claves, así ninguna pantalla necesita
// preguntar en qué tema está para pintar algo: pide el token y ya.

export interface Palette {
  mode: 'light' | 'dark'
  /** Fondo de pantalla. */
  bg: string
  /** Fondo de barras (header, tab bar) — un escalón por encima de bg. */
  bgElevated: string
  /** Fondo de tarjeta. */
  surface: string
  /** Campos, chips, superficies dentro de una tarjeta. */
  surfaceRaised: string
  border: string
  borderStrong: string
  /** Borde dorado tenue — realces del mockup oscuro (tarjeta destacada). */
  borderGold: string
  gold: string
  goldSoft: string
  /** Relleno translúcido dorado para chips/badges. */
  goldWash: string
  bronze: string
  /** Texto sobre el botón dorado (oscuro en ambos temas: el dorado es claro). */
  onGold: string
  ink: string
  inkMuted: string
  inkFaint: string
  success: string
  successSoft: string
  danger: string
  dangerSoft: string
  warning: string
  warningSoft: string
  /** Overlay de modales/sheets. */
  overlay: string
  /** Estilo de mapa de Google (react-native-maps) acorde al tema. */
  mapStyle: MapStyleElement[]
}

interface MapStyleElement {
  featureType?: string
  elementType?: string
  stylers: Record<string, string | number>[]
}

// Mapa oscuro — mismo espíritu que el mockup (agua azul profundo, calles
// grises, ruta dorada dibujada encima por el Polyline de la pantalla).
const DARK_MAP: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#16202e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1420' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a97a8' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6d7a8c' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1b2a24' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#212c3d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a97a8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c3a4f' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1d2736' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1420' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5b70' }] },
]

export const lightPalette: Palette = {
  mode: 'light',
  bg: '#faf9f6',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#f3f1ea',
  border: '#e8e4d9',
  borderStrong: '#d9d3c2',
  borderGold: '#d8b877',
  gold: '#b8873a',
  goldSoft: '#e9c176',
  goldWash: 'rgba(184,135,58,0.10)',
  bronze: '#8a6526',
  onGold: '#ffffff',
  ink: '#1d1d1f',
  inkMuted: '#6b6558',
  // ~4.77:1 sobre blanco — cumple WCAG AA para texto pequeño.
  inkFaint: '#797263',
  success: '#3f8f5c',
  successSoft: 'rgba(63,143,92,0.10)',
  danger: '#c0473d',
  dangerSoft: 'rgba(192,71,61,0.10)',
  warning: '#b8873a',
  warningSoft: 'rgba(184,135,58,0.10)',
  overlay: 'rgba(0,0,0,0.40)',
  mapStyle: [],
}

export const darkPalette: Palette = {
  mode: 'dark',
  bg: '#070b12',
  bgElevated: '#0b1220',
  surface: '#0f1826',
  surfaceRaised: '#16202f',
  border: '#1e2a3b',
  borderStrong: '#2b3a51',
  borderGold: 'rgba(216,169,82,0.35)',
  // Dorado más luminoso que el de la web: sobre fondo casi negro el bronce
  // #b8873a se apaga y pierde el aire "champagne" del mockup.
  gold: '#d8a952',
  goldSoft: '#f0c979',
  goldWash: 'rgba(216,169,82,0.12)',
  bronze: '#b8873a',
  onGold: '#12161d',
  ink: '#f4f6fa',
  inkMuted: '#9aa7b8',
  // ~5.6:1 sobre bg y ~5.0:1 sobre surface — legible sin competir con `ink`.
  inkFaint: '#78849a',
  success: '#43a06b',
  successSoft: 'rgba(67,160,107,0.14)',
  danger: '#e0655a',
  dangerSoft: 'rgba(224,101,90,0.14)',
  warning: '#d8a952',
  warningSoft: 'rgba(216,169,82,0.14)',
  overlay: 'rgba(0,0,0,0.65)',
  mapStyle: DARK_MAP,
}

// ── Sombras ────────────────────────────────────────────────────────────────
// En claro la sombra da relieve; en oscuro una sombra negra sobre fondo negro
// no se ve, así que la profundidad la carga el borde y el escalón de color.

export interface ShadowSet {
  card: object
  floating: object
  glow: object
}

export function shadowsFor(c: Palette): ShadowSet {
  if (c.mode === 'dark') {
    return {
      card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 4,
      },
      floating: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 8,
      },
      glow: {
        shadowColor: c.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 18,
        elevation: 6,
      },
    }
  }
  return {
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
      shadowColor: c.gold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 4,
    },
  }
}

export function statusColors(c: Palette): Record<string, string> {
  return {
    quote: c.inkFaint,
    pending: c.warning,
    assigned: c.gold,
    en_route: c.gold,
    arrived: c.warning,
    in_progress: c.success,
    completed: c.success,
    cancelled: c.danger,
    no_show: c.danger,
  }
}

// ── Contexto ───────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'luxeride.passenger.themeMode'

interface ThemeContextValue {
  /** Paleta ya resuelta (nunca 'system'). */
  c: Palette
  shadow: ShadowSet
  /** Preferencia guardada por el usuario. */
  mode: ThemeMode
  setMode: (next: ThemeMode) => void
}

// El default es oscuro para que un render accidental fuera del provider no
// pinte una pantalla blanca en medio de la app oscura.
const ThemeContext = createContext<ThemeContextValue>({
  c: darkPalette,
  shadow: shadowsFor(darkPalette),
  mode: 'system',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  // La preferencia se lee una vez al arrancar. Mientras tanto se usa el tema
  // del sistema — no hay parpadeo perceptible porque AsyncStorage resuelve
  // antes del primer frame útil en la práctica, y si tardara, el fallback ya
  // es el tema correcto para la mayoría de usuarios.
  useEffect(() => {
    let alive = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!alive) return
        if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved)
      })
      .catch(() => {
        /* sin preferencia guardada — se queda en 'system' */
      })
    return () => {
      alive = false
    }
  }, [])

  function setMode(next: ThemeMode) {
    setModeState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      /* que no se persista no debe romper el cambio en pantalla */
    })
  }

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode
    const c = resolved === 'light' ? lightPalette : darkPalette
    return { c, shadow: shadowsFor(c), mode, setMode }
  }, [mode, system])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

// ── useThemedStyles ────────────────────────────────────────────────────────
// Cache de dos niveles: la fábrica (estable, definida a nivel de módulo en
// cada pantalla) → la paleta → el objeto de estilos ya creado. Sin esto,
// cada render volvería a llamar StyleSheet.create.

type StyleFactory<T> = (c: Palette, shadow: ShadowSet) => T

const styleCache = new WeakMap<StyleFactory<unknown>, WeakMap<Palette, unknown>>()

export function useThemedStyles<T>(factory: StyleFactory<T>): T {
  const { c, shadow } = useTheme()
  return useMemo(() => {
    let byPalette = styleCache.get(factory as StyleFactory<unknown>)
    if (!byPalette) {
      byPalette = new WeakMap<Palette, unknown>()
      styleCache.set(factory as StyleFactory<unknown>, byPalette)
    }
    const hit = byPalette.get(c)
    if (hit) return hit as T
    const created = factory(c, shadow)
    byPalette.set(c, created)
    return created
  }, [factory, c, shadow])
}

/** Azúcar para componentes que solo necesitan la paleta. */
export function usePalette(): Palette {
  return useTheme().c
}

export type ThemedStyle = StyleProp<never>
