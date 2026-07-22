// ── Logo de la empresa (white-label) ───────────────────────────────────────
// Mismo patrón que apps/web/app/quote/[id]/page.tsx y review/[id]/page.tsx:
// caja blanca redondeada con el logo si existe (ningún logo rompe el
// diseño), o la inicial del nombre sobre el color de marca si no.

import { Image, View, Text, StyleSheet } from 'react-native'
import { useBranding } from '../lib/branding'
import { font, radius, shadow } from '../lib/theme'

export function BrandMark({ size = 56 }: { size?: number }) {
  const { branding } = useBranding()

  if (branding.logoUrl) {
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: radius.md }]}>
        <Image source={{ uri: branding.logoUrl }} style={styles.image} resizeMode="contain" />
      </View>
    )
  }

  return (
    <View
      style={[
        styles.wrap,
        styles.fallback,
        { width: size, height: size, borderRadius: radius.md, backgroundColor: branding.primaryColor },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.45 }]}>
        {branding.name.trim().charAt(0).toUpperCase() || 'L'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    ...shadow.floating,
  },
  fallback: { padding: 0 },
  image: { width: '70%', height: '70%' },
  letter: { color: '#fff', fontFamily: font.display },
})
