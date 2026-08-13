import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, radii, shadows, spacing } from '../theme'

type IconName = ComponentProps<typeof Ionicons>['name']

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenContent}>{children}</View>
  )
  return <SafeAreaView style={styles.safe}>{content}</SafeAreaView>
}

export function TopBar({
  title,
  subtitle,
  notificationCount = 0,
  onNotifications,
  onLogout,
}: {
  title: string
  subtitle: string
  notificationCount?: number
  onNotifications: () => void
  onLogout: () => void
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.brandMark}>
        <Ionicons name="restaurant-outline" size={22} color={colors.white} />
      </View>
      <View style={styles.topBarCopy}>
        <Text style={styles.topBarTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.topBarSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Pressable accessibilityLabel="Notifications" style={styles.iconButton} onPress={onNotifications}>
        <Ionicons name="notifications-outline" size={22} color={colors.ink} />
        {notificationCount > 0 ? (
          <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{Math.min(notificationCount, 99)}</Text></View>
        ) : null}
      </Pressable>
      <Pressable accessibilityLabel="Log out" style={styles.iconButton} onPress={onLogout}>
        <Ionicons name="log-out-outline" size={22} color={colors.ink} />
      </Pressable>
    </View>
  )
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  compact = false,
}: {
  label: string
  icon?: IconName
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  busy?: boolean
  compact?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        styles[`button_${variant}` as keyof typeof styles],
        (disabled || busy) && styles.buttonDisabled,
        pressed && !(disabled || busy) && styles.buttonPressed,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={variant === 'secondary' || variant === 'ghost' ? colors.green : colors.white} /> : null}
      {!busy && icon ? <Ionicons name={icon} size={18} color={variant === 'secondary' || variant === 'ghost' ? colors.greenDark : colors.white} /> : null}
      <Text style={[styles.buttonText, (variant === 'secondary' || variant === 'ghost') && styles.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  )
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  multiline,
  editable = true,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  icon?: IconName
  secureTextEntry?: boolean
  keyboardType?: ComponentProps<typeof TextInput>['keyboardType']
  autoCapitalize?: ComponentProps<typeof TextInput>['autoCapitalize']
  multiline?: boolean
  editable?: boolean
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, multiline && styles.fieldMultiline, !editable && styles.fieldReadOnly]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8A948E"
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={false}
          multiline={multiline}
          editable={editable}
        />
      </View>
    </View>
  )
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.white : colors.greenDark} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  )
}

export function StatusPill({ status }: { status: string }) {
  const tone = status === 'approved' || status === 'confirmed' || status === 'completed'
    ? 'good'
    : status === 'rejected' || status === 'declined'
      ? 'bad'
      : status === 'needs-info' || status === 'countered'
        ? 'info'
        : 'warn'
  return (
    <View style={[styles.statusPill, styles[`status_${tone}` as keyof typeof styles]]}>
      <Text style={[styles.statusText, styles[`statusText_${tone}` as keyof typeof styles]]}>{status.replace(/-/g, ' ')}</Text>
    </View>
  )
}

export function SectionTitle({ eyebrow, title, detail }: { eyebrow?: string; title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  )
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={27} color={colors.green} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  )
}

export function LoadingState({ label = 'Loading FeastFlow' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.green} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  )
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityLabel="Close" style={styles.iconButton} onPress={onClose}>
              <Ionicons name="close" size={23} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

export function Notice({ tone = 'info', text }: { tone?: 'info' | 'error' | 'success'; text: string }) {
  const icon: IconName = tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'
  return (
    <View style={[styles.notice, styles[`notice_${tone}` as keyof typeof styles]]}>
      <Ionicons name={icon} size={19} color={tone === 'error' ? colors.red : tone === 'success' ? colors.greenDark : colors.teal} />
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  )
}

export function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  screenContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.md, paddingBottom: 112, flexGrow: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  brandMark: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  topBarCopy: { flex: 1, minWidth: 0 },
  topBarTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800', color: colors.ink },
  topBarSubtitle: { fontSize: 12, lineHeight: 16, color: colors.muted },
  iconButton: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', right: -4, top: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  button: { minHeight: 50, borderRadius: radii.md, paddingHorizontal: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', ...shadows.raised },
  buttonCompact: { minHeight: 40, paddingHorizontal: 13, shadowOpacity: 0, elevation: 0 },
  button_primary: { backgroundColor: colors.green },
  button_secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#A9CFBC', shadowOpacity: 0, elevation: 0 },
  button_danger: { backgroundColor: colors.red },
  button_ghost: { backgroundColor: colors.greenSoft, shadowOpacity: 0, elevation: 0 },
  buttonDisabled: { opacity: 0.42, shadowOpacity: 0, elevation: 0 },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  buttonTextSecondary: { color: colors.greenDark },
  fieldWrap: { gap: 7 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  field: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#CFD8D2', borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: 13 },
  fieldMultiline: { minHeight: 94, alignItems: 'flex-start', paddingTop: 13 },
  fieldReadOnly: { backgroundColor: '#EEF1EF' },
  fieldInput: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  fieldInputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  chip: { minHeight: 34, borderRadius: radii.pill, borderWidth: 1, borderColor: '#B9D8C8', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: colors.white },
  statusPill: { borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  status_good: { backgroundColor: colors.greenSoft }, status_warn: { backgroundColor: colors.goldSoft }, status_info: { backgroundColor: colors.tealSoft }, status_bad: { backgroundColor: colors.redSoft },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusText_good: { color: colors.greenDark }, statusText_warn: { color: '#835D08' }, statusText_info: { color: colors.teal }, statusText_bad: { color: colors.red },
  sectionHeading: { marginTop: 24, marginBottom: 13, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionCopy: { flex: 1 },
  eyebrow: { color: colors.coral, textTransform: 'uppercase', fontSize: 11, lineHeight: 16, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  sectionDetail: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  emptyState: { minHeight: 220, padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6, maxWidth: 290 },
  loading: { flex: 1, minHeight: 440, alignItems: 'center', justifyContent: 'center', gap: 15 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14, 23, 18, 0.45)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#C8D0CB', alignSelf: 'center', marginTop: 9 },
  sheetHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  sheetBody: { padding: 16, paddingBottom: 28, gap: 14 },
  notice: { padding: 13, borderRadius: radii.md, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1 },
  notice_info: { backgroundColor: colors.tealSoft, borderColor: '#B7DDE3' },
  notice_error: { backgroundColor: colors.redSoft, borderColor: '#F4C6C6' },
  notice_success: { backgroundColor: colors.greenSoft, borderColor: '#B8DDCB' },
  noticeText: { flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '600' },
})
