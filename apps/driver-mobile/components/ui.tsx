// ── Kit de componentes compartidos ─────────────────────────────────────────
// Primitivas reusadas por todas las pantallas para que el look & feel no
// diverja: tarjeta con elevación, botones (primario/secundario/peligro),
// badge de estado, estado vacío y spinner de pantalla completa.

import type { ReactNode } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PressableScale } from './PressableScale'
import { color, font, radius, shadow, space, STATUS_COLOR } from '../lib/theme'
import { STATUS_LABEL, type BookingStatus } from '../lib/types'

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function ScreenLoader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color.gold} size="large" />
    </View>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={30} color={color.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

interface ButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  variant?: 'primary' | 'secondary' | 'danger'
  haptic?: 'light' | 'medium' | 'none'
  style?: StyleProp<ViewStyle>
}

export function Button({ label, onPress, loading, disabled, icon, variant = 'primary', haptic, style }: ButtonProps) {
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic ?? (isDanger ? 'medium' : 'light')}
      style={[
        buttonStyles.base,
        isPrimary && buttonStyles.primary,
        variant === 'secondary' && buttonStyles.secondary,
        isDanger && buttonStyles.danger,
        (disabled || loading) && buttonStyles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? color.bg : color.ink} />
      ) : (
        <View style={buttonStyles.content}>
          {icon && <Ionicons name={icon} size={18} color={isPrimary ? color.bg : isDanger ? color.danger : color.ink} />}
          <Text
            style={[
              buttonStyles.label,
              isPrimary && buttonStyles.labelPrimary,
              isDanger && buttonStyles.labelDanger,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  )
}

export function StatusBadge({ status }: { status: BookingStatus | string }) {
  const tint = STATUS_COLOR[status] ?? color.inkMuted
  return (
    <View style={[badgeStyles.base, { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}>
      <View style={[badgeStyles.dot, { backgroundColor: tint }]} />
      <Text style={[badgeStyles.label, { color: tint }]}>{STATUS_LABEL[status as BookingStatus] ?? status}</Text>
    </View>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: space.xl,
    ...shadow.card,
  },
  center: { flex: 1, backgroundColor: color.bg, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { color: color.ink, fontFamily: font.bodySemi, fontSize: 15, textAlign: 'center' },
  emptySubtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 13, textAlign: 'center', marginTop: 2 },
  sectionLabel: {
    color: color.inkFaint,
    fontFamily: font.bodySemi,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
})

const buttonStyles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: color.gold, ...shadow.glow },
  secondary: { backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.borderStrong },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: `${color.danger}55` },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: font.bodySemi, fontSize: 15, color: color.ink },
  labelPrimary: { color: color.bg },
  labelDanger: { color: color.danger },
})

const badgeStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: font.bodySemi, fontSize: 12 },
})
