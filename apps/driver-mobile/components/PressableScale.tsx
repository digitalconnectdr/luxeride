// ── Botón base con feedback táctil premium ─────────────────────────────────
// Escala + opacity al presionar (Animated, sin dependencias extra) y un pulso
// háptico ligero. Todas las pantallas construyen sus botones sobre este.

import { useRef } from 'react'
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  haptic?: 'light' | 'medium' | 'none'
}

export function PressableScale({ style, onPressIn, onPressOut, haptic = 'light', ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
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
