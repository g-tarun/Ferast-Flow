import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { apiRequest } from '../api'
import { Button, Chip, EmptyState, Field, Notice, SectionTitle, Sheet, StatusPill, money } from '../components/ui'
import { colors, radii, shadows } from '../theme'
import type { Booking, Role, Vendor } from '../types'

type Props = {
  apiUrl: string
  token: string
  role: Role
  bookings: Booking[]
  vendors: Vendor[]
  onBookingUpdated: (booking: Booking) => void
}

export function BookingsScreen({ apiUrl, token, role, bookings, vendors, onBookingUpdated }: Props) {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<Booking | null>(null)
  const [message, setMessage] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [rating, setRating] = useState(5)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const statuses = useMemo(() => ['all', ...Array.from(new Set(bookings.map((booking) => booking.status)))], [bookings])
  const visible = filter === 'all' ? bookings : bookings.filter((booking) => booking.status === filter)
  const vendorFor = (booking: Booking) => vendors.find((vendor) => vendor.id === booking.vendorId)

  const applyUpdate = (booking: Booking) => {
    onBookingUpdated(booking)
    setSelected(booking)
  }

  const runAction = async (key: string, task: () => Promise<{ booking: Booking }>) => {
    setBusy(key)
    setError('')
    try {
      const response = await task()
      applyUpdate(response.booking)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setBusy('')
    }
  }

  const sendMessage = async () => {
    if (!selected || !message.trim()) return
    const text = message.trim()
    await runAction('message', () => apiRequest(apiUrl, `/bookings/${selected.id}/messages`, { token, body: { text, from: role } }))
    setMessage('')
  }

  const vendorDecision = (decision: 'accept' | 'counter' | 'decline') => {
    if (!selected) return
    return runAction(decision, () => apiRequest(apiUrl, `/bookings/${selected.id}/vendor-decision`, { token, body: { decision } }))
  }

  const pay = async () => {
    if (!selected) return
    setBusy('pay')
    setError('')
    try {
      const intent = await apiRequest<{ payment: { id: string } }>(apiUrl, '/payments/intent', { token, body: { bookingId: selected.id } })
      const response = await apiRequest<{ booking: Booking }>(apiUrl, `/payments/${intent.payment.id}/confirm`, { token, body: {} })
      applyUpdate(response.booking)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment failed')
    } finally {
      setBusy('')
    }
  }

  const complete = () => selected && runAction('complete', () => apiRequest(apiUrl, `/bookings/${selected.id}/complete`, { token, body: {} }))
  const review = () => selected && runAction('review', () => apiRequest(apiUrl, `/bookings/${selected.id}/review`, { token, body: { rating, text: reviewText.trim() || 'Great service and food quality.' } }))

  return (
    <>
      <SectionTitle eyebrow={role === 'customer' ? 'Your events' : 'Operations'} title={role === 'customer' ? 'Booking history' : 'Booking requests'} detail={`${visible.length} records`} />
      <View style={styles.filters}>{statuses.map((status) => <Chip key={status} label={status.replace(/-/g, ' ')} selected={filter === status} onPress={() => setFilter(status)} />)}</View>
      {visible.length ? visible.map((booking) => {
        const vendor = vendorFor(booking)
        return (
          <Pressable key={booking.id} style={styles.bookingCard} onPress={() => { setSelected(booking); setError('') }}>
            <View style={styles.cardTop}>
              <View style={styles.bookingIcon}><Ionicons name="calendar" size={21} color={colors.green} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.bookingId}>{booking.id}</Text>
                <Text style={styles.vendorName} numberOfLines={1}>{vendor?.name || booking.vendorId}</Text>
              </View>
              <StatusPill status={booking.status} />
            </View>
            <View style={styles.bookingMeta}>
              <Text style={styles.meta}><Ionicons name="calendar-outline" size={14} /> {booking.date}</Text>
              <Text style={styles.meta}><Ionicons name="people-outline" size={14} /> {booking.guests}</Text>
              <Text style={styles.meta}><Ionicons name="wallet-outline" size={14} /> {money(booking.amount)}</Text>
            </View>
            <View style={styles.cardFooter}><Text style={styles.eventType}>{booking.eventType}</Text><Text style={styles.openText}>Open details <Ionicons name="chevron-forward" size={14} /></Text></View>
          </Pressable>
        )
      }) : <EmptyState icon="calendar-outline" title="No bookings here" body="Bookings and quote requests saved in MySQL will appear here." />}

      <Sheet visible={Boolean(selected)} title={selected?.id || 'Booking'} onClose={() => setSelected(null)}>
        {selected ? (
          <>
            <View style={styles.detailHeader}>
              <View><Text style={styles.detailVendor}>{vendorFor(selected)?.name || selected.vendorId}</Text><Text style={styles.detailMeta}>{selected.eventType} · {selected.date} · {selected.guests} guests</Text></View>
              <StatusPill status={selected.status} />
            </View>
            <View style={styles.amountRow}><View><Text style={styles.amountLabel}>Booking total</Text><Text style={styles.amountHint}>Paid {money(selected.deposit)}</Text></View><Text style={styles.amount}>{money(selected.amount)}</Text></View>

            {role === 'vendor' && ['quote-sent', 'countered'].includes(selected.status) ? (
              <View style={styles.actionGrid}>
                <Button label="Accept" icon="checkmark" compact onPress={() => vendorDecision('accept')} busy={busy === 'accept'} />
                <Button label="Counter" icon="swap-horizontal" compact variant="secondary" onPress={() => vendorDecision('counter')} busy={busy === 'counter'} />
                <Button label="Decline" icon="close" compact variant="danger" onPress={() => vendorDecision('decline')} busy={busy === 'decline'} />
              </View>
            ) : null}
            {role === 'customer' && ['accepted', 'countered', 'payment-due'].includes(selected.status) ? <Button label={`Pay ${selected.paymentChoice === 'full' ? money(selected.amount) : money(Math.ceil(selected.amount * 0.3))}`} icon="card-outline" onPress={pay} busy={busy === 'pay'} /> : null}
            {(role === 'vendor' || role === 'admin') && selected.status === 'confirmed' ? <Button label="Mark service completed" icon="checkmark-done-outline" onPress={complete} busy={busy === 'complete'} /> : null}
            {error ? <Notice tone="error" text={error} /> : null}

            <Text style={styles.blockTitle}>Timeline</Text>
            <View style={styles.timeline}>{selected.timeline.map((item, index) => <View key={`${item}-${index}`} style={styles.timelineItem}><View style={[styles.timelineDot, index === selected.timeline.length - 1 && styles.timelineDotActive]} /><Text style={styles.timelineText}>{item}</Text></View>)}</View>

            <Text style={styles.blockTitle}>Conversation</Text>
            <View style={styles.messages}>{selected.messages.length ? selected.messages.map((item, index) => (
              <View key={`${item.time}-${index}`} style={[styles.message, item.from === role && styles.messageOwn]}>
                <Text style={styles.messageRole}>{item.from}</Text><Text style={styles.messageText}>{item.text}</Text><Text style={styles.messageTime}>{item.time}</Text>
              </View>
            )) : <Text style={styles.noMessages}>No messages yet.</Text>}</View>
            {selected.status !== 'declined' ? <><Field label="New message" value={message} onChangeText={setMessage} placeholder="Type a message" multiline icon="chatbubble-outline" /><Button label="Send message" icon="send-outline" variant="secondary" onPress={sendMessage} busy={busy === 'message'} disabled={!message.trim()} /></> : null}

            {role === 'customer' && selected.status === 'completed' && !selected.review ? (
              <View style={styles.reviewBox}>
                <Text style={styles.blockTitle}>Rate this caterer</Text>
                <View style={styles.ratingRow}>{[1, 2, 3, 4, 5].map((item) => <Pressable key={item} onPress={() => setRating(item)}><Ionicons name={item <= rating ? 'star' : 'star-outline'} size={30} color={colors.gold} /></Pressable>)}</View>
                <Field label="Review" value={reviewText} onChangeText={setReviewText} placeholder="How was the food and service?" multiline />
                <Button label="Submit review" icon="star-outline" onPress={review} busy={busy === 'review'} />
              </View>
            ) : null}
            {selected.review ? <Notice tone="success" text={`${selected.review.rating}/5 · ${selected.review.text}`} /> : null}
          </>
        ) : null}
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 15 },
  bookingCard: { backgroundColor: colors.white, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.line, marginBottom: 12, ...shadows.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookingIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0 },
  bookingId: { color: colors.coral, fontSize: 11, fontWeight: '900' },
  vendorName: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  bookingMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 11 },
  eventType: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  openText: { color: colors.greenDark, fontSize: 12, fontWeight: '900' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  detailVendor: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  detailMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  amountLabel: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  amountHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
  amount: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  actionGrid: { gap: 8 },
  blockTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 5 },
  timeline: { gap: 0 },
  timelineItem: { minHeight: 38, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3, backgroundColor: '#CBD4CE', borderWidth: 3, borderColor: colors.white },
  timelineDotActive: { backgroundColor: colors.green },
  timelineText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
  messages: { gap: 8 },
  message: { maxWidth: '88%', alignSelf: 'flex-start', backgroundColor: '#EEF2EF', borderRadius: 12, borderBottomLeftRadius: 3, padding: 10 },
  messageOwn: { alignSelf: 'flex-end', backgroundColor: colors.greenSoft, borderBottomLeftRadius: 12, borderBottomRightRadius: 3 },
  messageRole: { color: colors.greenDark, textTransform: 'capitalize', fontSize: 10, fontWeight: '900' },
  messageText: { color: colors.ink, fontSize: 13, lineHeight: 18, marginTop: 2 },
  messageTime: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'right' },
  noMessages: { color: colors.muted, fontSize: 13, paddingVertical: 12 },
  reviewBox: { gap: 12 },
  ratingRow: { flexDirection: 'row', gap: 4 },
})
