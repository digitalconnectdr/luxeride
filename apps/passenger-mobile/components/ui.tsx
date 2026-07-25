// ── Kit de componentes compartidos ─────────────────────────────────────────
// Todas las primitivas leen la paleta activa (claro/oscuro) vía
// useThemedStyles — ver lib/theme.tsx. Ninguna define colores literales
// fuera de su fábrica de estilos, para que cambiar de tema no deje islas
// del tema anterior.

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
import {
  font,
  radius,
  space,
  statusColors,
  useThemedStyles,
  usePalette,
  type Palette,
  type ShadowSet,
} from '../lib/theme'
import { STATUS_LABEL, type BookingStatus } from '../lib/types'

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(baseStyles)
  return <View style={[styles.card, style]}>{children}</View>
}

/** Tarjeta con borde dorado — el realce del mockup (destacar una opción). */
export function GoldCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(baseStyles)
  return <View style={[styles.card, styles.cardGold, style]}>{children}</View>
}

export function ScreenLoader() {
  const styles = useThemedStyles(baseStyles)
  const c = usePalette()
  return (
    <View style={styles.center}>
      <ActivityIndicator color={c.gold} size="large" />
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
}) {
  const styles = useThemedStyles(baseStyles)
  const c = usePalette()
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={30} color={c.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

// ── Botón ──────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  /** primary = dorado sólido · secondary = contorno · ghost = plano · danger = contorno rojo */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  haptic?: 'light' | 'medium' | 'none'
  style?: StyleProp<ViewStyle>
}

export function Button({ label, onPress, loading, disabled, icon, variant = 'primary', haptic, style }: ButtonProps) {
  const styles = useThemedStyles(buttonStyles)
  const c = usePalette()
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'
  const contentColor = isPrimary ? c.onGold : isDanger ? c.danger : c.ink

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic ?? (isDanger ? 'medium' : 'light')}
      style={[
        styles.base,
        isPrimary && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isDanger && styles.danger,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color={contentColor} />}
          <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
        </View>
      )}
    </PressableScale>
  )
}

// ── Badge de estado ────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: BookingStatus | string }) {
  const styles = useThemedStyles(badgeStyles)
  const c = usePalette()
  const tint = statusColors(c)[status] ?? c.inkMuted
  return (
    <View style={[styles.base, { backgroundColor: `${tint}1f`, borderColor: `${tint}55` }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.label, { color: tint }]}>{STATUS_LABEL[status as BookingStatus] ?? status}</Text>
    </View>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(baseStyles)
  return <Text style={styles.sectionLabel}>{children}</Text>
}

/** Dato pequeño con icono — las filas de meta del mockup (6 pasajeros · 4 maletas). */
export function MetaChip({
  icon,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  tint?: string
}) {
  const styles = useThemedStyles(baseStyles)
  const c = usePalette()
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={tint ?? c.inkFaint} />
      <Text style={[styles.metaChipText, tint ? { color: tint } : null]}>{label}</Text>
    </View>
  )
}

/** Fila de menú con icono + chevron — secciones CUENTA / SOPORTE del perfil. */
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
  /** Si se pasa, el chevron apunta hacia abajo/arriba en vez de a la derecha. */
  expanded?: boolean
}) {
  const styles = useThemedStyles(baseStyles)
  const c = usePalette()
  const tint = danger ? c.danger : c.ink
  return (
    <PressableScale onPress={onPress} haptic="light">
      <View style={[styles.menuRow, danger && styles.menuRowDanger]}>
        <Ionicons name={icon} size={18} color={danger ? c.danger : c.gold} />
        <Text style={[styles.menuRowLabel, { color: tint }]}>{label}</Text>
        {value ? <Text style={styles.menuRowValue}>{value}</Text> : null}
        <Ionicons
          name={expanded === undefined ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={c.inkFaint}
        />
      </View>
    </PressableScale>
  )
}

/** Cabecera de pantalla del mockup: volver + título + acción opcional. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: ReactNode
}) {
  const styles = useThemedStyles(baseStyles)
  const c = usePalette()
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <PressableScale onPress={onBack} hitSlop={10} haptic="light">
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </PressableScale>
      ) : (
        <View style={styles.headerSpacer} />
      )}
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  )
}

// ── Campos ─────────────────────────────────────────────────────────────────

interface FieldProps
  extends Pick<TextInputProps, 'secureTextEntry' | 'keyboardType' | 'autoCapitalize' | 'onSubmitEditing' | 'editable'> {
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
  const styles = useThemedStyles(fieldStyles)
  const c = usePalette()
  return (
    <View style={[styles.wrap, focused && styles.wrapFocused, style]}>
      <Ionicons name={icon} size={18} color={focused ? c.gold : c.inkFaint} />
      <TextInput style={styles.input} placeholderTextColor={c.inkFaint} autoCorrect={false} {...inputProps} />
    </View>
  )
}

/**
 * Campo con etiqueta flotante SOBRE el valor — el patrón de "Datos del
 * pasajero" en el mockup de confirmación, donde la etiqueta ("Nombre
 * completo") tiene que seguir visible aunque el campo ya esté lleno.
 */
export function LabeledField({
  icon,
  label,
  focused,
  style,
  ...inputProps
}: FieldProps & { label: string }) {
  const styles = useThemedStyles(fieldStyles)
  const c = usePalette()
  return (
    <View style={[styles.wrap, styles.wrapLabeled, focused && styles.wrapFocused, style]}>
      <Ionicons name={icon} size={18} color={focused ? c.gold : c.inkFaint} style={styles.labeledIcon} />
      <View style={styles.labeledTextWrap}>
        <Text style={styles.floatingLabel}>{label}</Text>
        <TextInput
          style={styles.labeledInput}
          placeholderTextColor={c.inkFaint}
          autoCorrect={false}
          {...inputProps}
        />
      </View>
    </View>
  )
}

export function FieldButton({
  icon,
  label,
  placeholder,
  active,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string | null
  placeholder: string
  active?: boolean
  onPress: () => void
  style?: StyleProp<ViewStyle>
}) {
  const styles = useThemedStyles(fieldStyles)
  const c = usePalette()
  return (
    <PressableScale onPress={onPress}>
      <View style={[styles.wrap, active && styles.wrapFocused, style]}>
        <Ionicons name={icon} size={18} color={label ? c.gold : c.inkFaint} />
        <Text style={[styles.input, !label && styles.placeholder]}>{label ?? placeholder}</Text>
      </View>
    </PressableScale>
  )
}

// ── Fábricas de estilos ────────────────────────────────────────────────────

const fieldStyles = (c: Palette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      backgroundColor: c.surfaceRaised,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: 14,
    },
    wrapLabeled: { alignItems: 'flex-start', paddingVertical: space.md },
    wrapFocused: { borderColor: c.gold },
    input: { flex: 1, color: c.ink, fontFamily: font.body, fontSize: 15, paddingVertical: 0 },
    placeholder: { color: c.inkFaint },
    labeledIcon: { marginTop: 2 },
    labeledTextWrap: { flex: 1, gap: 2 },
    floatingLabel: {
      color: c.inkFaint,
      fontFamily: font.bodyMedium,
      fontSize: 10.5,
      letterSpacing: 0.4,
    },
    labeledInput: { color: c.ink, fontFamily: font.bodySemi, fontSize: 15, padding: 0 },
  })

const baseStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: space.xl,
      ...shadow.card,
    },
    cardGold: { borderColor: c.borderGold, borderWidth: 1.5 },
    center: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
    empty: { alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl, gap: space.sm },
    emptyIconWrap: {
      width: 64,
      height: 64,
      borderRadius: radius.pill,
      backgroundColor: c.surfaceRaised,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.sm,
    },
    emptyTitle: { color: c.ink, fontFamily: font.bodySemi, fontSize: 15, textAlign: 'center' },
    emptySubtitle: { color: c.inkFaint, fontFamily: font.body, fontSize: 13, textAlign: 'center', marginTop: 2 },
    sectionLabel: {
      color: c.inkFaint,
      fontFamily: font.bodySemi,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaChipText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 11.5 },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      backgroundColor: c.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: space.lg,
      paddingVertical: 14,
    },
    menuRowDanger: { backgroundColor: 'transparent', borderColor: `${c.danger}55` },
    menuRowLabel: { flex: 1, fontFamily: font.bodyMedium, fontSize: 14 },
    menuRowValue: { color: c.inkFaint, fontFamily: font.body, fontSize: 12.5 },
    screenHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: c.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    screenHeaderTitle: { flex: 1, color: c.ink, fontFamily: font.bodySemi, fontSize: 16 },
    headerSpacer: { width: 2 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  })

const buttonStyles = (c: Palette, shadow: ShadowSet) =>
  StyleSheet.create({
    base: {
      borderRadius: radius.md,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: c.gold, ...shadow.glow },
    secondary: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.borderStrong },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: `${c.danger}55` },
    disabled: { opacity: 0.5 },
    content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    label: { fontFamily: font.bodySemi, fontSize: 15 },
  })

const badgeStyles = (c: Palette) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: space.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    label: { fontFamily: font.bodySemi, fontSize: 11.5 },
  })
