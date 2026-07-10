// ── Botón base con feedback táctil premium ─────────────────────────────────
// Escala + opacity al presionar (Animated, sin dependencias extra) y un pulso
// háptico ligero. Todas las pantallas construyen sus botones sobre este.
//
// BUG REAL encontrado (2026-07-10): el `style` del llamador (que casi
// siempre incluye `flex: 1` para estirarse dentro de una fila) solo se
// aplicaba al Pressable INTERNO — el Animated.View que en realidad es el
// hijo directo de la fila del padre nunca recibía ese `flex: 1`, así que el
// botón se encogía al tamaño de su contenido en vez de estirarse (los
// botones de Llamar/WhatsApp y los de la firma se veían chicos/rotos por
// esto). Ahora las propiedades de TAMAÑO (flex, width, alignSelf, etc.) se
// copian también al Animated.View exterior; el resto del estilo (fondo,
// padding, layout de los hijos) se queda igual en el Pressable interno.

import { useRef } from 'react'
import { Animated, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  haptic?: 'light' | 'medium' | 'none'
}

const SIZING_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth'] as const

export function PressableScale({ style, onPressIn, onPressOut, haptic = 'light', ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const flattened = (StyleSheet.flatten(style) ?? {}) as ViewStyle
  const sizingStyle: ViewStyle = {}
  for (const key of SIZING_KEYS) {
    const value = flattened[key]
    if (value !== undefined) (sizingStyle as Record<string, unknown>)[key] = value
  }

  return (
    <Animated.View style={[sizingStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        style={style}
        onPressIn={(e) => {
          Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start()
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start()
          if (haptic !== 'none') {
            Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
          }
          onPressOut?.(e)
        }}
      />
    </Animated.View>
  )
}
