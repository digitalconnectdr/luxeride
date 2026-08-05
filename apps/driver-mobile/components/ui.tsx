// ── Kit de componentes compartidos ─────────────────────────────────────────
// Primitivas reusadas por todas las pantallas para que el look & feel no
// diverja: tarjeta con elevación, botones (primario/secundario/peligro),
// badge de estado, estado vacío y spinner de pantalla completa.
//
// Paridad con la app del pasajero: este kit tenía 6 componentes contra los 13
// de `apps/passenger-mobile/components/ui.tsx`, y por eso cada pantalla del
// conductor improvisaba su propio encabezado, sus filas y sus campos con
// estilos sueltos. Se portaron las primitivas que faltaban (ScreenHeader,
// MetaChip, MenuRow, GoldCard, Field, LabeledField, Divider) adaptadas al
// tema oscuro estático de esta app — el chófer trabaja de noche y al volante,
// así que aquí NO hay tema claro a propósito.

import type { ReactNode } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
  type TextInputProps,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { PressableScale } from './PressableScale'
import { color, font, radius, shadow, space, STATUS_COLOR } from '../lib/theme'
import { STATUS_LABEL, type BookingStatus } from '../lib/types'

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

/** Tarjeta destacada con borde dorado — para lo único importante de la pantalla. */
export function GoldCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, styles.goldCard, style]}>{children}</View>
}

/** Separador fino, para no repetir un View con borderTopWidth en cada pantalla. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />
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

/** Cabecera de pantalla: volver + título + acción opcional a la derecha. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <View style={headerStyles.wrap}>
      {onBack ? (
        <PressableScale onPress={onBack} hitSlop={10} haptic="light">
          <Ionicons name="arrow-back" size={22} color={color.ink} />
        </PressableScale>
      ) : (
        <View style={headerStyles.spacer} />
      )}
      <View style={headerStyles.titleWrap}>
        <Text style={headerStyles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={headerStyles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={headerStyles.right}>{right}</View>
    </View>
  )
}

/**
 * Encabezado de una pantalla de PESTAÑA (sin botón de volver): título grande
 * en Playfair, subtítulo opcional y una acción a la derecha.
 *
 * Existe porque las 4 pantallas de pestaña (Mis viajes, Ganancias, Documentos,
 * Perfil) declaraban cada una su propio `headerTitle` con los mismos valores
 * copiados — y una ya había divergido (le faltaba el ajuste de interlínea).
 * Un solo sitio evita que la deriva vuelva a pasar.
 */
export function TabHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  /** Controles propios de la pantalla (ej. el conmutador Hoy/Reservas). */
  children?: ReactNode
}) {
  return (
    <View style={tabHeaderStyles.wrap}>
      <View style={tabHeaderStyles.titleRow}>
        <Text style={tabHeaderStyles.title}>{title}</Text>
        {right}
      </View>
      {children}
      {subtitle ? <Text style={tabHeaderStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

/** Dato pequeño con icono, para las filas de meta (18.9 mi · 65 min · 3 pax). */
export function MetaChip({
  icon,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  tint?: string
}) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={tint ?? color.inkFaint} />
      <Text style={[styles.metaChipText, tint ? { color: tint } : null]}>{label}</Text>
    </View>
  )
}

/** Fila de menú con icono + chevron — secciones del perfil y de documentos. */
export function MenuRow({
  icon,
  label,
  value,
  onPress,
  danger,
  expanded,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value?: string
  onPress: () => void
  danger?: boolean
  /** Si se pasa, el chevron apunta arriba/abajo en vez de a la derecha. */
  expanded?: boolean
}) {
  return (
    <PressableScale onPress={onPress} haptic="light">
      <View style={[menuStyles.row, danger && menuStyles.rowDanger]}>
        <Ionicons name={icon} size={18} color={danger ? color.danger : color.gold} />
        <Text style={[menuStyles.label, { color: danger ? color.danger : color.ink }]}>{label}</Text>
        {value ? <Text style={menuStyles.value}>{value}</Text> : null}
        <Ionicons
          name={expanded === undefined ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={color.inkFaint}
        />
      </View>
    </PressableScale>
  )
}

// ── Campos ─────────────────────────────────────────────────────────────────

interface FieldProps
  extends Pick<
    TextInputProps,
    'secureTextEntry' | 'keyboardType' | 'autoCapitalize' | 'onSubmitEditing' | 'editable' | 'multiline'
  > {
  icon: keyof typeof Ionicons.glyphMap
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  focused: boolean
  onFocus: () => void
  onBlur: () => void
  style?: StyleProp<ViewStyle>
}

export function Field({ icon, focused, style, ...inputProps }: FieldProps) {
  return (
    <View style={[fieldStyles.wrap, focused && fieldStyles.wrapFocused, style]}>
      <Ionicons name={icon} size={18} color={focused ? color.gold : color.inkFaint} />
      <TextInput
        style={fieldStyles.input}
        placeholderTextColor={color.inkFaint}
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  )
}

/** Campo con la etiqueta SOBRE el valor — sigue visible aunque el campo esté lleno. */
export function LabeledField({
  icon,
  label,
  focused,
  style,
  ...inputProps
}: FieldProps & { label: string }) {
  return (
    <View style={[fieldStyles.wrap, fieldStyles.labeledWrap, focused && fieldStyles.wrapFocused, style]}>
      <Ionicons name={icon} size={18} color={focused ? color.gold : color.inkFaint} style={fieldStyles.labeledIcon} />
      <View style={fieldStyles.labeledBody}>
        <Text style={fieldStyles.label}>{label}</Text>
        <TextInput
          style={fieldStyles.labeledInput}
          placeholderTextColor={color.inkFaint}
          autoCorrect={false}
          {...inputProps}
        />
      </View>
    </View>
  )
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
  goldCard: { borderColor: `${color.gold}55` },
  divider: { height: 1, backgroundColor: color.border },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaChipText: { color: color.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
})

const headerStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
  },
  spacer: { width: 22 },
  titleWrap: { flex: 1 },
  // Playfair para el título: es la voz de marca de LuxeRide y lo que separa
  // esta app de cualquier app de reparto genérica.
  title: { color: color.ink, fontFamily: font.displaySemi, fontSize: 20 },
  subtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 12, marginTop: 2 },
  right: { minWidth: 22, alignItems: 'flex-end' },
})

const tabHeaderStyles = StyleSheet.create({
  wrap: { gap: space.md, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { color: color.ink, fontFamily: font.display, fontSize: 28, marginBottom: -space.xs, flex: 1 },
  subtitle: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
})

const menuStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
  },
  rowDanger: { borderColor: `${color.danger}44` },
  label: { flex: 1, fontFamily: font.bodyMedium, fontSize: 14.5 },
  value: { color: color.inkFaint, fontFamily: font.body, fontSize: 13 },
})

const fieldStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  wrapFocused: { borderColor: color.gold },
  input: { flex: 1, color: color.ink, fontFamily: font.body, fontSize: 15, padding: 0 },
  labeledWrap: { alignItems: 'flex-start', paddingVertical: space.md },
  labeledIcon: { marginTop: 2 },
  labeledBody: { flex: 1 },
  label: {
    color: color.inkFaint,
    fontFamily: font.bodySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  labeledInput: { color: color.ink, fontFamily: font.bodyMedium, fontSize: 15, padding: 0 },
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
