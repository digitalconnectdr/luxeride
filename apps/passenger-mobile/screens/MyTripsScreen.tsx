// ── Historial de viajes del pasajero ────────────────────────────────────────
// Lee bookings directo por Supabase (RLS customers_select_own_bookings, ya
// existente) — antes esta pantalla era un placeholder fijo: si el pasajero
// cerraba la pantalla de "Reserva confirmada" sin tocar "Ver mi viaje", no
// tenía ninguna forma de volver a encontrar esa reserva. Tap en un viaje
// activo navega a TripTracking, que vive en el stack de la pestaña
// "Reservar" (navegación cross-tab: navigation.navigate('Reservar', { screen, params })).

import { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, RefreshControl, TextInput } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { callPassengerApi } from '../lib/api'
import { Button, Card, EmptyState, ScreenLoader, StatusBadge, MetaChip } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { font, radius, space, useThemedStyles, usePalette, type Palette } from '../lib/theme'
import type { BookingStatus } from '../lib/types'

interface TripRow {
  id: string
  booking_number: string
  status: BookingStatus
  scheduled_at: string
  total_amount: number | null
  currency: string | null
  passenger_count: number
  rated_at: string | null
  pickup_location: { address?: string; lat?: number; lng?: number } | null
  dropoff_location: { address?: string; lat?: number; lng?: number } | null
}

interface ReceiptFee {
  id: string
  type: string
  description: string | null
  amount: number
}

interface ReceiptPayment {
  id: string
  amount: number
  status: string
  payment_method: string | null
  captured_at: string | null
}

interface Receipt {
  bookingNumber: string
  currency: string
  baseAmount: number | null
  gratuityAmount: number | null
  gratuityPct: number | null
  promoDiscountAmount: number | null
  totalAmount: number | null
  fees: ReceiptFee[]
  payments: ReceiptPayment[]
}

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'assigned', 'en_route', 'arrived', 'in_progress']
// "Reservar de nuevo" solo tiene sentido para un viaje que ya se completó —
// uno cancelado/no-show no es una ruta que el pasajero probablemente quiera
// repetir tal cual (el motivo de la cancelación pudo ser la ruta misma).
const REBOOKABLE_STATUSES: BookingStatus[] = ['completed']

// Indicador de cercanía: mientras más cerca el viaje, más "urgente" el color
// (verde -> ámbar -> rojo), igual que el semáforo de StatusBadge pero para
// el tiempo restante en vez del estado.
function urgency(hoursUntil: number, c: Palette): { label: string; tint: string } {
  if (hoursUntil < 6) return { label: 'Muy pronto', tint: c.danger }
  if (hoursUntil < 24) return { label: 'Hoy', tint: c.warning }
  const days = Math.round(hoursUntil / 24)
  return { label: days <= 1 ? 'Mañana' : `En ${days} días`, tint: c.success }
}

// ── Pestañas de la lista ───────────────────────────────────────────────────
// Antes todo caía en una sola lista cronológica: con historial acumulado,
// encontrar el viaje de mañana implicaba pasar por encima de todos los
// completados.
type TripTab = 'upcoming' | 'completed' | 'cancelled'

const TABS: { key: TripTab; label: string }[] = [
  { key: 'upcoming', label: 'Próximos' },
  { key: 'completed', label: 'Completados' },
  { key: 'cancelled', label: 'Cancelados' },
]

function tabFor(status: BookingStatus): TripTab {
  if (status === 'completed') return 'completed'
  if (status === 'cancelled' || status === 'no_show') return 'cancelled'
  return 'upcoming'
}

interface TripCardProps {
  item: TripRow
  onNavigateTracking: () => void
  onRebook: () => void
  onRated: () => void
}

// Componente propio (no una función inline dentro de renderItem) porque el
// panel de calificación necesita su propio estado por tarjeta (expandido,
// estrellas, comentario) — un FlatList no da hooks-por-ítem si el render se
// queda como closure suelto. Mismo patrón que TripRow en
// apps/driver-mobile/screens/EarningsScreen.tsx ("Calificar pasajero"), aquí
// invertido: el PASAJERO califica el viaje/conductor.
function TripCard({ item, onNavigateTracking, onRebook, onRated }: TripCardProps) {
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const [ratingOpen, setRatingOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ratingError, setRatingError] = useState('')

  // Pagar con tarjeta Whop guardada (de un viaje anterior con esta misma
  // empresa) + propina opcional — cubre el caso "la empresa cobra en
  // efectivo/después, pero el pasajero ya tiene tarjeta guardada y quiere
  // pagar (con propina) directo desde la app". Mismo mecanismo exacto que
  // ya usa el checkout público de la web (chargeWithSavedWhopCardAction) —
  // si el viaje ya tiene un pago exitoso, esa misma acción lo rechaza sola,
  // no se duplica esa validación acá.
  const [savedCard, setSavedCard] = useState<{ last4: string | null; brand: string | null } | null>(null)
  const [gratuityPct, setGratuityPct] = useState(0)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [paid, setPaid] = useState(false)

  // Recibo — desglose de tarifa (base, descuento, propina, cargos, total),
  // mismo dato que ya ve el operador en /admin/bookings/[id]. Se carga solo
  // al abrir el panel (no en el mount de la tarjeta) para no disparar una
  // llamada extra por cada viaje completado en la lista.
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  async function toggleReceipt() {
    if (receiptOpen) {
      setReceiptOpen(false)
      return
    }
    setReceiptOpen(true)
    if (receipt) return
    setLoadingReceipt(true)
    const result = await callPassengerApi<{ receipt?: Receipt }>('receipt', { bookingId: item.id })
    setLoadingReceipt(false)
    if (result.success && result.receipt) setReceipt(result.receipt)
  }

  useEffect(() => {
    if (item.status !== 'completed') return
    let cancelled = false
    callPassengerApi<{ found: boolean; card?: { last4: string | null; brand: string | null } }>(
      'saved-card',
      { bookingId: item.id },
    ).then((r) => {
      if (!cancelled && r.success && r.found && r.card) setSavedCard(r.card)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.status])

  async function payWithSavedCard() {
    setPaying(true)
    setPayError('')
    const result = await callPassengerApi('charge-saved-card', { bookingId: item.id, gratuityPct })
    setPaying(false)
    if (!result.success) {
      setPayError(result.error === 'Esta reservación ya tiene un pago registrado'
        ? 'Este viaje ya tiene un pago registrado.'
        : 'No se pudo procesar el pago. Intenta de nuevo.')
      return
    }
    setPaid(true)
  }

  const isActive = ACTIVE_STATUSES.includes(item.status)
  const date = new Date(item.scheduled_at)
  const hoursUntil = (date.getTime() - Date.now()) / 3_600_000
  const showUrgency = isActive && hoursUntil > 0 && hoursUntil < 240 // hasta 10 días
  const urgencyInfo = showUrgency ? urgency(hoursUntil, c) : null
  const canRebook =
    REBOOKABLE_STATUSES.includes(item.status) &&
    item.pickup_location?.lat != null && item.pickup_location?.lng != null &&
    item.dropoff_location?.lat != null && item.dropoff_location?.lng != null
  const canRate = item.status === 'completed' && !item.rated_at

  async function submitRating() {
    if (stars < 1) return
    setSubmitting(true)
    setRatingError('')
    const result = await callPassengerApi('submit-review', { bookingId: item.id, rating: stars, comment })
    setSubmitting(false)
    if (!result.success) {
      setRatingError('No se pudo enviar tu calificación. Intenta de nuevo.')
      return
    }
    setRatingOpen(false)
    onRated()
  }

  return (
    <PressableScale onPress={onNavigateTracking}>
      <Card style={styles.card}>
        {/* Badge primero y número después, como en el mockup: el estado es
        lo que el pasajero busca al escanear la lista, el código no. */}
        <View style={styles.row}>
          <StatusBadge status={item.status} />
          <Text style={styles.number}>{item.booking_number}</Text>
        </View>

        <View style={styles.addressRow}>
          <View style={[styles.dot, { backgroundColor: c.gold }]} />
          <Text style={styles.address} numberOfLines={1}>
            {item.pickup_location?.address ?? 'Origen'}
          </Text>
        </View>
        <View style={styles.addressRow}>
          <View style={[styles.dot, { backgroundColor: c.danger }]} />
          <Text style={styles.address} numberOfLines={1}>
            {item.dropoff_location?.address ?? 'Destino'}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dateGroup}>
            <Text style={styles.date}>
              {date.toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })} ·{' '}
              {date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {urgencyInfo && (
              <View style={[styles.urgencyPill, { backgroundColor: `${urgencyInfo.tint}18`, borderColor: `${urgencyInfo.tint}40` }]}>
                <View style={[styles.urgencyDot, { backgroundColor: urgencyInfo.tint }]} />
                <Text style={[styles.urgencyText, { color: urgencyInfo.tint }]}>{urgencyInfo.label}</Text>
              </View>
            )}
          </View>
          {item.total_amount != null && (
            <Text style={styles.price}>
              ${item.total_amount.toFixed(0)} {item.currency ?? 'USD'}
            </Text>
          )}
        </View>

        {/* Meta del viaje — pasajeros (los datos de vehículo/maletas no
        viven en bookings, así que no se inventan). */}
        <View style={styles.metaRow}>
          <MetaChip icon="people-outline" label={`${item.passenger_count} pasajero${item.passenger_count === 1 ? '' : 's'}`} />
        </View>

        {isActive && (
          <View style={styles.activeHint}>
            <Ionicons name="navigate-outline" size={13} color={c.gold} />
            <Text style={styles.activeHintText}>Toca para ver el viaje en vivo</Text>
          </View>
        )}

        {canRebook && (
          <PressableScale onPress={onRebook}>
            <View style={styles.rebookBtn}>
              <Ionicons name="repeat-outline" size={14} color={c.gold} />
              <Text style={styles.rebookText}>Reservar de nuevo</Text>
            </View>
          </PressableScale>
        )}

        {item.rated_at ? (
          <View style={styles.ratedRow}>
            <Ionicons name="star" size={12} color={c.gold} />
            <Text style={styles.ratedText}>Ya calificaste este viaje</Text>
          </View>
        ) : canRate ? (
          <>
            <PressableScale onPress={() => setRatingOpen((v) => !v)}>
              <View style={styles.rateBtn}>
                <Ionicons name="star-outline" size={14} color={c.gold} />
                <Text style={styles.rateBtnText}>Calificar viaje</Text>
              </View>
            </PressableScale>

            {ratingOpen && (
              <View style={styles.ratingPanel}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <PressableScale key={n} onPress={() => setStars(n)} haptic="light" hitSlop={6}>
                      <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={28} color={c.gold} />
                    </PressableScale>
                  ))}
                </View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Comentario (opcional)"
                  placeholderTextColor={c.inkFaint}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={2}
                />
                {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
                <Button label="Enviar calificación" icon="checkmark" onPress={submitRating} loading={submitting} disabled={stars < 1} />
              </View>
            )}
          </>
        ) : null}

        {savedCard && !paid && (
          <View style={styles.payPanel}>
            <View style={styles.payRow}>
              <Ionicons name="card-outline" size={14} color={c.gold} />
              <Text style={styles.payText}>
                Pagar viaje con {savedCard.brand ?? 'tarjeta'} •••• {savedCard.last4 ?? '····'}
              </Text>
            </View>
            <View style={styles.tipRow}>
              {[0, 15, 18, 20].map((pct) => (
                <PressableScale key={pct} onPress={() => setGratuityPct(pct)} haptic="light">
                  <View style={[styles.tipChip, gratuityPct === pct && styles.tipChipActive]}>
                    <Text style={[styles.tipChipText, gratuityPct === pct && styles.tipChipTextActive]}>
                      {pct === 0 ? 'Sin propina' : `${pct}%`}
                    </Text>
                  </View>
                </PressableScale>
              ))}
            </View>
            {payError ? <Text style={styles.ratingError}>{payError}</Text> : null}
            <Button
              label={gratuityPct > 0 ? `Pagar con ${gratuityPct}% de propina` : 'Pagar viaje'}
              icon="checkmark"
              onPress={payWithSavedCard}
              loading={paying}
              variant="secondary"
            />
          </View>
        )}
        {paid && (
          <View style={styles.ratedRow}>
            <Ionicons name="checkmark-circle" size={12} color={c.success} />
            <Text style={styles.ratedText}>Pago recibido, ¡gracias!</Text>
          </View>
        )}

        {item.status === 'completed' && (
          <>
            <PressableScale onPress={toggleReceipt}>
              <View style={styles.rebookBtn}>
                <Ionicons name="receipt-outline" size={14} color={c.gold} />
                <Text style={styles.rebookText}>{receiptOpen ? 'Ocultar recibo' : 'Ver recibo'}</Text>
              </View>
            </PressableScale>

            {receiptOpen && (
              <View style={styles.receiptPanel}>
                {loadingReceipt ? (
                  <Text style={styles.receiptMuted}>Cargando recibo…</Text>
                ) : !receipt ? (
                  <Text style={styles.receiptMuted}>No se pudo cargar el recibo.</Text>
                ) : (
                  <>
                    <ReceiptLine label="Tarifa base" amount={receipt.baseAmount} currency={receipt.currency} />
                    {receipt.fees.map((fee) => (
                      <ReceiptLine
                        key={fee.id}
                        label={fee.description ?? fee.type}
                        amount={fee.amount}
                        currency={receipt.currency}
                      />
                    ))}
                    {!!receipt.promoDiscountAmount && (
                      <ReceiptLine
                        label="Descuento"
                        amount={-receipt.promoDiscountAmount}
                        currency={receipt.currency}
                      />
                    )}
                    {!!receipt.gratuityAmount && (
                      <ReceiptLine
                        label={receipt.gratuityPct ? `Propina (${receipt.gratuityPct}%)` : 'Propina'}
                        amount={receipt.gratuityAmount}
                        currency={receipt.currency}
                      />
                    )}
                    <View style={styles.receiptTotalRow}>
                      <Text style={styles.receiptTotalLabel}>Total</Text>
                      <Text style={styles.receiptTotalValue}>
                        ${Number(receipt.totalAmount ?? 0).toFixed(2)} {receipt.currency}
                      </Text>
                    </View>
                    {receipt.payments[0] && (
                      <Text style={styles.receiptMuted}>
                        {receipt.payments[0].status === 'succeeded' ? 'Pagado' : receipt.payments[0].status} ·{' '}
                        {receipt.payments[0].payment_method ?? 'tarjeta'}
                      </Text>
                    )}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </Card>
    </PressableScale>
  )
}

function ReceiptLine({ label, amount, currency }: { label: string; amount: number | null; currency: string }) {
  const styles = useThemedStyles(makeStyles)
  if (amount == null) return null
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.receiptValue}>
        {amount < 0 ? '-' : ''}${Math.abs(amount).toFixed(2)} {currency}
      </Text>
    </View>
  )
}

export function MyTripsScreen() {
  // any: esta pantalla vive en el Tab.Navigator raíz, no en BookingStack
  // (que es donde vive TripTracking) — React Navigation soporta navegar a un
  // screen anidado de otra pestaña, pero no hay un tipo compartido para eso.
  const navigation = useNavigation<any>()
  const styles = useThemedStyles(makeStyles)
  const c = usePalette()
  const [trips, setTrips] = useState<TripRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TripTab>('upcoming')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('bookings')
      .select('id, booking_number, status, scheduled_at, total_amount, currency, passenger_count, rated_at, pickup_location, dropoff_location')
      .order('scheduled_at', { ascending: false })
      .limit(30)

    if (loadError) {
      setError('No pudimos cargar tus viajes')
      return
    }
    setError('')
    setTrips((data ?? []) as unknown as TripRow[])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  function rebook(item: TripRow) {
    const pickup = item.pickup_location
    const dropoff = item.dropoff_location
    if (pickup?.lat == null || pickup?.lng == null || dropoff?.lat == null || dropoff?.lng == null) return
    navigation.navigate('Reservar', {
      screen: 'NewBooking',
      params: {
        prefill: {
          pickupAddress: pickup.address ?? '',
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          dropoffAddress: dropoff.address ?? '',
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          passengerCount: item.passenger_count,
        },
      },
    })
  }

  if (!trips && !error) return <ScreenLoader />

  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState icon="alert-circle-outline" title="No se pudo cargar" subtitle={error} />
      </View>
    )
  }

  const all = trips ?? []
  const counts: Record<TripTab, number> = {
    upcoming: all.filter((t) => tabFor(t.status) === 'upcoming').length,
    completed: all.filter((t) => tabFor(t.status) === 'completed').length,
    cancelled: all.filter((t) => tabFor(t.status) === 'cancelled').length,
  }
  // Los próximos se leen mejor del más cercano al más lejano; el historial,
  // del más reciente hacia atrás (que es como llega la consulta).
  const visible = all
    .filter((t) => tabFor(t.status) === tab)
    .sort((a, b) =>
      tab === 'upcoming'
        ? new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        : new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
    )

  const emptyCopy: Record<TripTab, { title: string; subtitle: string }> = {
    upcoming: {
      title: 'Sin viajes próximos',
      subtitle: 'Cuando reserves un viaje, lo verás aquí.',
    },
    completed: { title: 'Sin viajes completados', subtitle: 'Tus viajes terminados aparecerán aquí.' },
    cancelled: { title: 'Sin viajes cancelados', subtitle: 'Aquí verás los viajes que no se realizaron.' },
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <PressableScale key={t.key} onPress={() => setTab(t.key)} haptic="light" style={styles.tabItem}>
              <View style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                  {t.label}
                </Text>
                {counts[t.key] > 0 && (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{counts[t.key]}</Text>
                  </View>
                )}
              </View>
            </PressableScale>
          )
        })}
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.gold} />}
        ListEmptyComponent={
          <EmptyState icon="time-outline" title={emptyCopy[tab].title} subtitle={emptyCopy[tab].subtitle} />
        }
        renderItem={({ item }) => (
          <TripCard
            item={item}
            onNavigateTracking={() =>
              navigation.navigate('Reservar', { screen: 'TripTracking', params: { bookingId: item.id } })
            }
            onRebook={() => rebook(item)}
            onRated={load}
          />
        )}
      />
    </View>
  )
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  tabBar: {
    flexDirection: 'row',
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    backgroundColor: c.bg,
  },
  tabItem: { flex: 1 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  tabActive: { backgroundColor: c.goldWash, borderColor: c.borderGold },
  tabText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 12.5 },
  tabTextActive: { color: c.gold, fontFamily: font.bodySemi },
  tabCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceRaised,
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: c.gold },
  tabCountText: { color: c.inkFaint, fontFamily: font.bodySemi, fontSize: 10 },
  tabCountTextActive: { color: c.onGold },
  list: { flex: 1 },
  listContent: { padding: space.lg, gap: space.md },
  card: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { color: c.ink, fontFamily: font.bodyBold, fontSize: 14 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  address: { flex: 1, color: c.inkFaint, fontFamily: font.body, fontSize: 13 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xs,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  dateGroup: { gap: 4, flexShrink: 1 },
  date: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 12 },
  urgencyPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  urgencyDot: { width: 5, height: 5, borderRadius: 2.5 },
  urgencyText: { fontFamily: font.bodySemi, fontSize: 10 },
  // Dorado, como en el mockup: el precio es el dato que el pasajero compara
  // entre viajes, y en tinta normal competía con el número de reserva.
  price: { color: c.gold, fontFamily: font.bodyBold, fontSize: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  activeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  activeHintText: { color: c.gold, fontFamily: font.bodyMedium, fontSize: 11 },
  rebookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  rebookText: { color: c.gold, fontFamily: font.bodySemi, fontSize: 12 },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ratedText: { color: c.inkFaint, fontFamily: font.bodyMedium, fontSize: 11 },
  rateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.xs,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
  },
  rateBtnText: { color: c.gold, fontFamily: font.bodySemi, fontSize: 12 },
  ratingPanel: { marginTop: space.sm, gap: space.sm },
  starsRow: { flexDirection: 'row', gap: space.sm, alignSelf: 'center' },
  commentInput: {
    backgroundColor: c.bg,
    color: c.ink,
    fontFamily: font.body,
    fontSize: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  ratingError: { color: c.danger, fontFamily: font.bodyMedium, fontSize: 12 },
  payPanel: { marginTop: space.sm, gap: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  payText: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 12, flexShrink: 1 },
  tipRow: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  tipChip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceRaised,
  },
  tipChipActive: { backgroundColor: c.gold, borderColor: c.gold },
  tipChipText: { color: c.ink, fontFamily: font.bodyMedium, fontSize: 12 },
  tipChipTextActive: { color: c.onGold },
  receiptPanel: { marginTop: space.sm, gap: 6, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: c.border },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  receiptLabel: { flex: 1, color: c.inkFaint, fontFamily: font.body, fontSize: 12 },
  receiptValue: { color: c.ink, fontFamily: font.bodyBold, fontSize: 12 },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  receiptTotalLabel: { color: c.ink, fontFamily: font.bodySemi, fontSize: 13 },
  receiptTotalValue: { color: c.ink, fontFamily: font.bodyBold, fontSize: 13 },
  receiptMuted: { color: c.inkFaint, fontFamily: font.body, fontSize: 11 },
  })
