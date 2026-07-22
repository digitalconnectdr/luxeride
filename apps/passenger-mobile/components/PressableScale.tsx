// ── Botón base con feedback táctil premium ─────────────────────────────────
// Idéntico a apps/driver-mobile/components/PressableScale.tsx (mismo fix de
// propagación de estilos de tamaño al Animated.View exterior, ver ese
// archivo para el detalle del bug original).

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
