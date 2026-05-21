/**
 * Panel admina: zgłoszenia UGC (oferty i użytkownicy).
 * Otwierany z ProfileScreen → Narzędzia Administratora.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import { mailtoEstateosSubject } from '../constants/appContact';
import {
  ADMIN_REPORT_CATEGORY_LABELS,
  ADMIN_REPORT_STATUS_LABELS,
  type AdminContentReport,
  type AdminReportCategory,
  type AdminReportStatus,
} from '../contracts/adminReportsContract';
import {
  AdminReportsServiceError,
  fetchAdminContentReports,
  rejectOfferFromReport,
  updateAdminContentReport,
} from '../services/adminReportsService';

type Theme = {
  background: string;
  text: string;
  subtitle: string;
  glass: 'dark' | 'light';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  onQueueChange?: (pendingCount: number) => void;
};

type StatusTab = 'PENDING' | 'IN_REVIEW' | 'ARCHIVED';
type TargetFilter = 'ALL' | 'OFFER' | 'USER';

const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: 'PENDING', label: 'Oczekujące' },
  { id: 'IN_REVIEW', label: 'W toku' },
  { id: 'ARCHIVED', label: 'Archiwum' },
];

const TARGET_FILTERS: Array<{ id: TargetFilter; label: string }> = [
  { id: 'ALL', label: 'Wszystkie' },
  { id: 'OFFER', label: 'Oferty' },
  { id: 'USER', label: 'Użytkownicy' },
];

const CATEGORY_ORDER: AdminReportCategory[] = [
  'SCAM',
  'HARASSMENT',
  'ILLEGAL_CONTENT',
  'MISLEADING_OFFER',
  'SPAM',
  'OTHER',
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function categoryColor(cat: AdminReportCategory, isDark: boolean): string {
  switch (cat) {
    case 'SCAM':
      return isDark ? '#FF453A' : '#FF3B30';
    case 'HARASSMENT':
    case 'ILLEGAL_CONTENT':
      return isDark ? '#FF9F0A' : '#FF9500';
    case 'MISLEADING_OFFER':
      return isDark ? '#BF5AF2' : '#AF52DE';
    default:
      return isDark ? '#64D2FF' : '#007AFF';
  }
}

export default function AdminContentReportsModal({ visible, onClose, theme, onQueueChange }: Props) {
  const { token } = useAuthStore() as { token: string | null };
  const isDark = theme.glass === 'dark';

  const [statusTab, setStatusTab] = useState<StatusTab>('PENDING');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('ALL');
  const [reports, setReports] = useState<AdminContentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      try {
        const { reports: list, counts } = await fetchAdminContentReports(token, {
          status: statusTab,
          targetType: targetFilter,
        });
        setReports(list);
        onQueueChange?.(counts.pending);
      } catch (err) {
        const msg =
          err instanceof AdminReportsServiceError ? err.message : 'Nie udało się pobrać zgłoszeń.';
        Alert.alert('Błąd', msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, statusTab, targetFilter, onQueueChange],
  );

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const grouped = useMemo(() => {
    const map = new Map<AdminReportCategory, AdminContentReport[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const r of reports) {
      const key = (r.category in ADMIN_REPORT_CATEGORY_LABELS ? r.category : 'OTHER') as AdminReportCategory;
      map.get(key)?.push(r);
    }
    return CATEGORY_ORDER.map((cat) => ({ cat, items: map.get(cat) ?? [] })).filter((g) => g.items.length > 0);
  }, [reports]);

  const patchReport = useCallback(
    async (report: AdminContentReport, status: AdminReportStatus, adminNote?: string) => {
      if (!token || busyId) return;
      setBusyId(report.id);
      try {
        await updateAdminContentReport(token, report.id, {
          status,
          adminNote: adminNote ?? noteDraft[report.id] ?? report.adminNote ?? null,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load({ silent: true });
        if (status !== 'PENDING') setExpandedId(null);
      } catch (err) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const msg =
          err instanceof AdminReportsServiceError ? err.message : 'Nie udało się zapisać.';
        Alert.alert('Błąd', msg);
      } finally {
        setBusyId(null);
      }
    },
    [token, busyId, noteDraft, load],
  );

  const handleRejectOffer = useCallback(
    async (report: AdminContentReport) => {
      const offerId = report.offer?.id;
      if (!token || !offerId) return;
      Alert.alert(
        'Odrzucić ofertę?',
        `Oferta #${offerId} zostanie oznaczona jako REJECTED. Kontynuować?`,
        [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Odrzuć ofertę',
            style: 'destructive',
            onPress: async () => {
              setBusyId(report.id);
              try {
                await rejectOfferFromReport(token, offerId);
                await patchReport(report, 'ACTIONED');
              } catch (err) {
                const msg =
                  err instanceof AdminReportsServiceError ? err.message : 'Nie udało się odrzucić oferty.';
                Alert.alert('Błąd', msg);
              } finally {
                setBusyId(null);
              }
            },
          },
        ],
      );
    },
    [token, patchReport],
  );

  const openMail = useCallback((email: string | null | undefined, subject: string) => {
    if (!email) {
      Alert.alert('Brak e-maila', 'Ten użytkownik nie ma adresu e-mail w bazie.');
      return;
    }
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => Alert.alert('Błąd', 'Nie udało się otworzyć klienta poczty.'));
  }, []);

  const palette = useMemo(
    () => ({
      cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      pillBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      inset: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    }),
    [isDark],
  );

  const renderReportCard = (report: AdminContentReport) => {
    const expanded = expandedId === report.id;
    const catColor = categoryColor(report.category, isDark);
    const isOffer = report.targetType === 'OFFER';
    const subjectTarget = isOffer
      ? `Oferta #${report.offer?.id ?? report.targetId}`
      : `Użytkownik #${report.reportedUser?.id ?? report.targetId}`;

    return (
      <View
        key={report.id}
        style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setExpandedId(expanded ? null : report.id);
            if (!noteDraft[report.id] && report.adminNote) {
              setNoteDraft((p) => ({ ...p, [report.id]: report.adminNote ?? '' }));
            }
          }}
          style={({ pressed }) => [pressed && { opacity: 0.88 }]}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.catPill, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}>
              <Text style={[styles.catPillText, { color: catColor }]}>
                {ADMIN_REPORT_CATEGORY_LABELS[report.category] ?? report.category}
              </Text>
            </View>
            <Text style={[styles.whenText, { color: theme.subtitle }]}>{formatWhen(report.createdAt)}</Text>
          </View>

          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {isOffer
              ? report.offer?.title || `Oferta #${report.targetId}`
              : report.reportedUser?.name || `Użytkownik #${report.reportedUser?.id ?? report.targetId}`}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.subtitle }]} numberOfLines={2}>
            {isOffer
              ? `${report.offer?.street || '—'} · status ${report.offer?.status || '?'} · właściciel: ${report.offer?.owner?.name || report.offer?.owner?.email || '—'}`
              : report.reportedUser?.email || '—'}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.subtitle }]}>
            Zgłosił: {report.reporter.name || report.reporter.email || `#${report.reporter.id}`}
          </Text>
          {report.reason ? (
            <Text style={[styles.reasonPreview, { color: theme.text }]} numberOfLines={expanded ? undefined : 2}>
              „{report.reason}"
            </Text>
          ) : null}
          <View style={styles.cardFooterRow}>
            <View style={[styles.statusChip, { backgroundColor: palette.inset }]}>
              <Text style={[styles.statusChipText, { color: theme.subtitle }]}>
                {ADMIN_REPORT_STATUS_LABELS[report.status]}
              </Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.subtitle} />
          </View>
        </Pressable>

        {expanded ? (
          <View style={styles.expandedBlock}>
            {report.adminNote ? (
              <Text style={[styles.adminNoteSaved, { color: theme.subtitle }]}>
                Notatka: {report.adminNote}
              </Text>
            ) : null}

            <Text style={[styles.fieldLabel, { color: theme.subtitle }]}>Notatka wewnętrzna / odpowiedź</Text>
            <TextInput
              value={noteDraft[report.id] ?? report.adminNote ?? ''}
              onChangeText={(t) => setNoteDraft((p) => ({ ...p, [report.id]: t.slice(0, 2000) }))}
              placeholder="Co zrobiłeś, co napisałeś do stron…"
              placeholderTextColor={theme.subtitle}
              multiline
              style={[
                styles.noteInput,
                {
                  color: theme.text,
                  backgroundColor: palette.inset,
                  borderColor: palette.cardBorder,
                },
              ]}
            />

            <View style={styles.actionGrid}>
              {statusTab === 'PENDING' ? (
                <Pressable
                  onPress={() => patchReport(report, 'IN_REVIEW')}
                  disabled={busyId === report.id}
                  style={({ pressed }) => [styles.actionBtn, styles.actionNeutral, pressed && { opacity: 0.8 }]}
                >
                  <Text style={[styles.actionBtnTextDark, { color: isDark ? '#fff' : '#111' }]}>
                    Weź w toku
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => openMail(report.reporter.email, `EstateOS — Twoje zgłoszenie (${subjectTarget})`)}
                style={({ pressed }) => [styles.actionBtn, styles.actionBlue, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="mail-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Do zgłaszającego</Text>
              </Pressable>

              {(report.reportedUser?.email || report.offer?.owner?.email) ? (
                <Pressable
                  onPress={() =>
                    openMail(
                      report.reportedUser?.email || report.offer?.owner?.email,
                      `EstateOS — zgłoszenie dotyczące ${subjectTarget}`,
                    )
                  }
                  style={({ pressed }) => [styles.actionBtn, styles.actionPurple, pressed && { opacity: 0.8 }]}
                >
                  <Ionicons name="mail-outline" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Do autora</Text>
                </Pressable>
              ) : null}

              {isOffer && report.offer?.id ? (
                <Pressable
                  onPress={() => handleRejectOffer(report)}
                  disabled={busyId === report.id}
                  style={({ pressed }) => [styles.actionBtn, styles.actionDanger, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.actionBtnText}>Odrzuć ofertę</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => patchReport(report, 'ACTIONED')}
                disabled={busyId === report.id}
                style={({ pressed }) => [styles.actionBtn, styles.actionGreen, pressed && { opacity: 0.8 }]}
              >
                {busyId === report.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>Zamknij — podjęto działanie</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => patchReport(report, 'DISMISSED')}
                disabled={busyId === report.id}
                style={({ pressed }) => [styles.actionBtn, styles.actionMuted, pressed && { opacity: 0.8 }]}
              >
                <Text style={[styles.actionBtnTextDark, { color: isDark ? '#fff' : '#111' }]}>
                  Odrzuć zgłoszenie
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  mailtoEstateosSubject(`Moderacja UGC — zgłoszenie #${report.id}`),
                ).catch(() => {})
              }
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.linkText}>Skopiuj kontekst na {`kontakt@estateos.pl`}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Zgłoszenia UGC</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>
              Oferty i użytkownicy · reaguj na bieżąco
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={32} color={theme.subtitle} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStatusTab(tab.id);
                  setExpandedId(null);
                }}
                style={[
                  styles.tabPill,
                  { backgroundColor: active ? '#FF453A' : palette.pillBg },
                ]}
              >
                <Text style={[styles.tabPillText, { color: active ? '#fff' : theme.text }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.targetRow, { backgroundColor: palette.inset }]}>
          {TARGET_FILTERS.map((f) => {
            const active = targetFilter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTargetFilter(f.id);
                  setExpandedId(null);
                }}
                style={[styles.targetBtn, active && styles.targetBtnActive]}
              >
                <Text style={[styles.targetBtnText, { color: active ? '#fff' : theme.subtitle }]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#FF453A" />
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load({ silent: true });
                }}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {reports.length === 0 ? (
              <Text style={[styles.empty, { color: theme.subtitle }]}>
                Brak zgłoszeń w tej zakładce.
              </Text>
            ) : statusTab === 'PENDING' ? (
              grouped.map((section) => (
                <View key={section.cat} style={styles.sectionBlock}>
                  <View style={styles.sectionHeader}>
                    <View
                      style={[
                        styles.sectionDot,
                        { backgroundColor: categoryColor(section.cat, isDark) },
                      ]}
                    />
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                      {ADMIN_REPORT_CATEGORY_LABELS[section.cat]} ({section.items.length})
                    </Text>
                  </View>
                  {section.items.map(renderReportCard)}
                </View>
              ))
            ) : (
              reports.map(renderReportCard)
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 18 : 12,
    paddingBottom: 10,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  tabsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabPillText: { fontSize: 14, fontWeight: '700' },
  targetRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 4,
  },
  targetBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  targetBtnActive: { backgroundColor: '#FF453A' },
  targetBtnText: { fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionBlock: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  catPillText: { fontSize: 11, fontWeight: '800' },
  whenText: { fontSize: 11 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardMeta: { fontSize: 12.5, lineHeight: 17 },
  reasonPreview: { fontSize: 13.5, fontStyle: 'italic', marginTop: 8, lineHeight: 19 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  expandedBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.25)' },
  adminNoteSaved: { fontSize: 12, marginBottom: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  noteInput: {
    minHeight: 72,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  actionGrid: { gap: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionBlue: { backgroundColor: '#0A84FF' },
  actionPurple: { backgroundColor: '#5E5CE6' },
  actionGreen: { backgroundColor: '#34C759' },
  actionDanger: { backgroundColor: '#FF453A' },
  actionNeutral: { backgroundColor: 'rgba(255,149,0,0.18)' },
  actionMuted: { backgroundColor: 'rgba(128,128,128,0.15)' },
  actionBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionBtnTextDark: { color: '#111', fontSize: 14, fontWeight: '700' },
  linkRow: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#0A84FF', fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
