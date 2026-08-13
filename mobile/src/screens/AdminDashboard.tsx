import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { apiRequest, documentUrl } from '../api'
import { Button, Chip, EmptyState, Field, Notice, SectionTitle, Sheet, StatusPill } from '../components/ui'
import { colors, radii, shadows } from '../theme'
import type { ApplicationDocumentKey, UploadedDocument, Vendor, VendorStatus } from '../types'

type Props = {
  apiUrl: string
  token: string
  vendors: Vendor[]
  onVendorUpdated: (vendor: Vendor) => void
}

type ReviewAction = {
  kind: 'reject-document' | 'request-reupload' | 'delete-document' | 'vendor-needs-info' | 'vendor-reject'
  vendor: Vendor
  document?: UploadedDocument
}

const documentLabels: Record<ApplicationDocumentKey, string> = { foodLicense: 'Food license', identity: 'Owner ID', insurance: 'Insurance' }

export function AdminDashboard({ apiUrl, token, vendors: bootstrapVendors, onVendorUpdated }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>(bootstrapVendors)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [expanded, setExpanded] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => setVendors(bootstrapVendors), [bootstrapVendors])

  const refresh = async () => {
    setBusy('search')
    setError('')
    try {
      const query = new URLSearchParams({ search: search.trim(), status }).toString()
      const response = await apiRequest<{ vendors: Vendor[] }>(apiUrl, `/admin/vendors?${query}`, { token })
      setVendors(response.vendors)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load vendors')
    } finally {
      setBusy('')
    }
  }

  const updateLocalVendor = (vendor: Vendor) => {
    setVendors((current) => current.some((item) => item.id === vendor.id) ? current.map((item) => item.id === vendor.id ? vendor : item) : [vendor, ...current])
    onVendorUpdated(vendor)
  }

  const setVendorStatus = async (vendor: Vendor, nextStatus: VendorStatus, adminNote = '') => {
    setBusy(`vendor-${vendor.id}-${nextStatus}`)
    setError('')
    setSuccess('')
    try {
      const response = await apiRequest<{ vendor: Vendor }>(apiUrl, `/admin/vendors/${vendor.id}/status`, { token, method: 'PATCH', body: { status: nextStatus, adminNote } })
      updateLocalVendor(response.vendor)
      setSuccess(`${vendor.name} moved to ${nextStatus.replace(/-/g, ' ')}.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Status update failed')
    } finally {
      setBusy('')
    }
  }

  const setDocumentStatus = async (vendor: Vendor, document: UploadedDocument, nextStatus: 'approved' | 'rejected', rejectionReason = '') => {
    if (!document.id) return
    setBusy(`document-${document.id}`)
    setError('')
    setSuccess('')
    try {
      const response = await apiRequest<{ vendor?: Vendor }>(apiUrl, `/documents/${document.id}/status`, { token, method: 'PATCH', body: { status: nextStatus, rejectionReason } })
      if (response.vendor) updateLocalVendor(response.vendor)
      else await refresh()
      setSuccess(`${document.documentName || document.name} is ${nextStatus}.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Document review failed')
    } finally {
      setBusy('')
    }
  }

  const runReviewAction = async () => {
    if (!reviewAction || !reason.trim()) return
    const { kind, vendor, document } = reviewAction
    setBusy('review-action')
    setError('')
    setSuccess('')
    try {
      if (kind === 'vendor-needs-info' || kind === 'vendor-reject') {
        await setVendorStatus(vendor, kind === 'vendor-reject' ? 'rejected' : 'needs-info', reason.trim())
      } else if (document?.id) {
        if (kind === 'reject-document') {
          await setDocumentStatus(vendor, document, 'rejected', reason.trim())
        } else {
          const path = kind === 'request-reupload' ? `/documents/${document.id}/reupload-request` : `/documents/${document.id}`
          const method = kind === 'request-reupload' ? 'POST' : 'DELETE'
          const response = await apiRequest<{ vendor: Vendor }>(apiUrl, path, { token, method, body: { reason: reason.trim() } })
          updateLocalVendor(response.vendor)
          setSuccess(kind === 'request-reupload' ? 'Reupload requested. The vendor can upload a replacement.' : 'Document deleted. The vendor record has been updated.')
        }
      }
      setReviewAction(null)
      setReason('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Admin action failed')
    } finally {
      setBusy('')
    }
  }

  const preview = (document?: UploadedDocument) => document?.id && WebBrowser.openBrowserAsync(documentUrl(apiUrl, document.id, token), { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
  const openAction = (action: ReviewAction) => { setReviewAction(action); setReason(''); setError('') }

  return (
    <>
      <SectionTitle eyebrow="Verification queue" title="Vendor reviews" detail={`${vendors.length} records`} />
      <View style={styles.searchArea}>
        <Field label="Search vendors" value={search} onChangeText={setSearch} placeholder="Business, owner, pincode, or license" icon="search-outline" />
        <View style={styles.statusFilters}>{['all', 'pending', 'needs-info', 'approved', 'rejected'].map((item) => <Chip key={item} label={item.replace(/-/g, ' ')} selected={status === item} onPress={() => setStatus(item)} />)}</View>
        <Button label="Search database" icon="search" onPress={refresh} busy={busy === 'search'} />
      </View>
      {error ? <Notice tone="error" text={error} /> : null}
      {success ? <Notice tone="success" text={success} /> : null}

      <View style={styles.vendorList}>{vendors.length ? vendors.map((vendor) => {
        const documents = Object.values(vendor.documents || {}).filter(Boolean) as UploadedDocument[]
        const openDocuments = documents.filter((document) => document.status !== 'approved').length
        const isOpen = expanded === vendor.id
        return (
          <View key={vendor.id} style={styles.vendorRow}>
            <Pressable style={styles.vendorSummary} onPress={() => setExpanded(isOpen ? '' : vendor.id)}>
              <View style={styles.vendorAvatar}><Text style={styles.vendorInitial}>{vendor.name.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.vendorCopy}><Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text><Text style={styles.vendorMeta} numberOfLines={1}>{vendor.owner} · {vendor.cuisine || 'Onboarding'} · {vendor.pincode || 'No pincode'}</Text></View>
              <View style={styles.summaryRight}><Text style={styles.docCount}>{documents.length} uploaded</Text>{openDocuments ? <Text style={styles.openCount}>{openDocuments} need review</Text> : null}</View>
              <StatusPill status={vendor.status} />
              <Ionicons name={isOpen ? 'remove' : 'add'} size={20} color={colors.teal} />
            </Pressable>

            {isOpen ? (
              <View style={styles.vendorDetails}>
                <View style={styles.profileFacts}><Text style={styles.fact}><Ionicons name="location-outline" size={14} /> {vendor.address || 'Address pending'}</Text><Text style={styles.fact}><Ionicons name="document-text-outline" size={14} /> {vendor.license}</Text><Text style={styles.fact}><Ionicons name="navigate-outline" size={14} /> {vendor.serviceRadius} km radius</Text></View>
                {vendor.adminNote ? <Notice text={vendor.adminNote} tone={vendor.status === 'needs-info' || vendor.status === 'rejected' ? 'error' : 'info'} /> : null}
                <Text style={styles.blockTitle}>Documents from MySQL</Text>
                {(Object.keys(documentLabels) as ApplicationDocumentKey[]).map((key) => {
                  const document = vendor.documents?.[key]
                  return (
                    <View key={key} style={[styles.document, !document && styles.documentMissing]}>
                      <Ionicons name={document ? 'document-text-outline' : 'alert-circle-outline'} size={21} color={document ? colors.greenDark : colors.coral} />
                      <View style={styles.documentCopy}><Text style={styles.documentName}>{documentLabels[key]}</Text><Text style={styles.documentMeta} numberOfLines={1}>{document ? document.name : 'Not uploaded'}</Text>{document?.rejectionReason ? <Text style={styles.documentReason}>{document.rejectionReason}</Text> : null}</View>
                      {document ? <StatusPill status={document.status || 'pending'} /> : null}
                      {document?.id ? <View style={styles.documentActions}>
                        <Pressable accessibilityLabel="Preview" style={styles.iconAction} onPress={() => preview(document)}><Ionicons name="eye-outline" size={20} color={colors.ink} /></Pressable>
                        {document.status !== 'approved' ? <Pressable accessibilityLabel="Approve document" style={[styles.iconAction, styles.iconApprove]} onPress={() => setDocumentStatus(vendor, document, 'approved')}><Ionicons name="checkmark" size={20} color={colors.greenDark} /></Pressable> : null}
                        <Pressable accessibilityLabel="Reject document" style={styles.iconAction} onPress={() => openAction({ kind: 'reject-document', vendor, document })}><Ionicons name="close-circle-outline" size={20} color={colors.red} /></Pressable>
                        <Pressable accessibilityLabel="Request reupload" style={styles.iconAction} onPress={() => openAction({ kind: 'request-reupload', vendor, document })}><Ionicons name="refresh-outline" size={20} color={colors.teal} /></Pressable>
                        <Pressable accessibilityLabel="Delete document" style={styles.iconAction} onPress={() => openAction({ kind: 'delete-document', vendor, document })}><Ionicons name="trash-outline" size={20} color={colors.red} /></Pressable>
                      </View> : null}
                    </View>
                  )
                })}
                <Text style={styles.blockTitle}>Vendor decision</Text>
                <View style={styles.decisionActions}>
                  <Button label="Approve" icon="checkmark-circle-outline" compact onPress={() => setVendorStatus(vendor, 'approved', 'Vendor and required documents approved.')} busy={busy === `vendor-${vendor.id}-approved`} />
                  <Button label="Needs info" icon="information-circle-outline" compact variant="secondary" onPress={() => openAction({ kind: 'vendor-needs-info', vendor })} />
                  <Button label="Reject" icon="close-circle-outline" compact variant="danger" onPress={() => openAction({ kind: 'vendor-reject', vendor })} />
                </View>
              </View>
            ) : null}
          </View>
        )
      }) : <EmptyState icon="shield-checkmark-outline" title="No vendors found" body="Change the filters or search another business, owner, pincode, or license." />}</View>

      <Sheet visible={Boolean(reviewAction)} title={actionTitle(reviewAction?.kind)} onClose={() => !busy && setReviewAction(null)}>
        {reviewAction ? <Notice tone={reviewAction.kind.includes('delete') || reviewAction.kind.includes('reject') ? 'error' : 'info'} text={actionDescription(reviewAction)} /> : null}
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Enter a clear reason for the vendor" multiline icon="create-outline" />
        {error ? <Notice tone="error" text={error} /> : null}
        <Button label="Confirm action" icon="checkmark-outline" variant={reviewAction?.kind.includes('delete') || reviewAction?.kind.includes('reject') ? 'danger' : 'primary'} onPress={runReviewAction} busy={busy === 'review-action'} disabled={!reason.trim()} />
      </Sheet>
    </>
  )
}

function actionTitle(kind?: ReviewAction['kind']) {
  if (kind === 'reject-document') return 'Reject document'
  if (kind === 'request-reupload') return 'Request reupload'
  if (kind === 'delete-document') return 'Delete document'
  if (kind === 'vendor-reject') return 'Reject vendor'
  return 'Request vendor information'
}

function actionDescription(action: ReviewAction) {
  if (action.kind === 'delete-document') return `Delete ${action.document?.documentName || 'this document'} permanently from MySQL. This is separate from requesting a reupload.`
  if (action.kind === 'request-reupload') return `Remove the current ${action.document?.documentName || 'document'} and open a replacement upload for ${action.vendor.name}.`
  if (action.kind === 'reject-document') return `The rejection reason will be stored in MySQL and shown to ${action.vendor.name}.`
  return `The admin note will be stored against ${action.vendor.name} and shown in their dashboard.`
}

const styles = StyleSheet.create({
  searchArea: { gap: 12, backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, padding: 14, ...shadows.card },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  vendorList: { marginTop: 16, gap: 10 },
  vendorRow: { backgroundColor: colors.white, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', ...shadows.card },
  vendorSummary: { minHeight: 82, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  vendorAvatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  vendorInitial: { color: colors.teal, fontSize: 17, fontWeight: '900' },
  vendorCopy: { flex: 1, minWidth: 150 },
  vendorName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  vendorMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  summaryRight: { alignItems: 'flex-end' },
  docCount: { color: colors.muted, fontSize: 9 },
  openCount: { color: colors.coral, fontSize: 9, fontWeight: '900', marginTop: 2 },
  vendorDetails: { padding: 13, borderTopWidth: 1, borderTopColor: colors.line, gap: 12, backgroundColor: '#FBFCFA' },
  profileFacts: { gap: 7 },
  fact: { color: colors.muted, fontSize: 12 },
  blockTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 3 },
  document: { minHeight: 66, padding: 10, borderRadius: radii.sm, borderWidth: 1, borderColor: '#B9D9C8', backgroundColor: '#F0FAF5', flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  documentMissing: { backgroundColor: colors.coralSoft, borderColor: '#F0C5B9' },
  documentCopy: { flex: 1, minWidth: 120 },
  documentName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  documentMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  documentReason: { color: colors.red, fontSize: 9, fontWeight: '700', marginTop: 3 },
  documentActions: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C9D8D0', paddingTop: 8 },
  iconAction: { width: 38, height: 36, borderRadius: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  iconApprove: { backgroundColor: colors.greenSoft, borderColor: '#A7D3BA' },
  decisionActions: { gap: 8 },
})
