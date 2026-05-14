/**
 * ====================================================================
 *  EstateOS™ — Panel admina: Weryfikacja prawna ofert (KW + nr lokalu)
 * ====================================================================
 *
 *  Modal otwierany z `ProfileScreen → Narzędzia Administratora`. Pokazuje
 *  kolejkę ofert czekających na weryfikację prawną (zgłoszony numer
 *  księgi wieczystej + numer mieszkania). Admin:
 *    1. czyta numer KW i adres,
 *    2. klika „Sprawdź w EKW" — otwiera się oficjalna przeglądarka KW
 *       z pre-wypełnionym numerem (jeśli backend dostarczy `ekwQuickLink`),
 *    3. ACK-uje akcją „Akceptuj" → na ofercie zapala się zielony znaczek,
 *       albo „Odrzuć" → wybiera powód z listy (i opcjonalnie dopisuje
 *       komentarz dla właściciela), ofertę dostaje status REJECTED.
 *
 *  Modal jest CELOWO ODŁĄCZONY od `ProfileScreen.tsx` — ten plik ma już
 *  ponad 2.7k linii i każdy następny modał inline jeszcze utrudnia mu
 *  utrzymanie. Konwencja z `Admin*Modal` w ProfileScreen jest zachowana
 *  (ten sam shape propsów: `visible`, `onClose`, `theme`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../store/useAuthStore';
import {
  approveLegalVerification,
  fetchAdminLegalVerificationQueue,
  LegalVerificationServiceError,
  rejectLegalVerification,
} from '../services/legalVerificationService';
import {
  type AdminLegalVerificationQueueItem,
  type LegalVerificationRejectionReason,
  type LegalVerificationStatus,
  LEGAL_VERIFICATION_REJECTION_REASONS,
  getRejectionReasonLabel,
} from '../contracts/legalVerificationContract';

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
  /** Po zmianie kolejki rodzic może odświeżyć licznik PENDING w sekcji „Zarząd". */
  onQueueChange?: (pendingCount: number) => void;
};

const TABS: Array<{ id: Extract<LegalVerificationStatus, 'PENDING' | 'REJECTED' | 'VERIFIED'>; label: string }> = [
  { id: 'PENDING', label: 'Do weryfikacji' },
  { id: 'REJECTED', label: 'Odrzucone' },
  { id: 'VERIFIED', label: 'Zatwierdzone' },
];

export default function AdminLegalVerificationModal({ visible, onClose, theme, onQueueChange }: Props) {
  const { token } = useAuthStore() as any;
  const isDark = theme.glass === 'dark';

  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('PENDING');
  const [items, setItems] = useState<AdminLegalVerificationQueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  // Stan modalu odrzucenia — trzymamy go tutaj (a nie w osobnym
  // komponencie), bo używa go tylko ten ekran.
  const [rejectingItem, setRejectingItem] = useState<AdminLegalVerificationQueueItem | null>(null);
  const [rejectReasonCode, setRejectReasonCode] = useState<LegalVerificationRejectionReason>('KW_NOT_FOUND');
  const [rejectReasonText, setRejectReasonText] = useState('');

  const loadQueue = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await fetchAdminLegalVerificationQueue(activeTab, token);
      setItems(list);
      if (activeTab === 'PENDING') onQueueChange?.(list.length);
    } catch (err) {
      const msg = err instanceof LegalVerificationServiceError ? err.message : 'Nie udało się pobrać kolejki.';
      Alert.alert('Błąd', msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, token, onQueueChange]);

  useEffect(() => {
    if (visible) loadQueue();
  }, [visible, loadQueue]);

  const handleApprove = useCallback(async (item: AdminLegalVerificationQueueItem) => {
    if (submittingId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmittingId(item.offerId);
    try {
      await approveLegalVerification(item.offerId, { internalNote: null }, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadQueue();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof LegalVerificationServiceError ? err.message : 'Nie udało się zatwierdzić.';
      Alert.alert('Błąd', msg);
    } finally {
      setSubmittingId(null);
    }
  }, [loadQueue, submittingId, token]);

  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingItem) return;
    if (rejectReasonCode === 'OTHER' && !rejectReasonText.trim()) {
      Alert.alert('Walidacja', 'Wybrałeś „Inny powód" — dopisz krótki komentarz dla właściciela.');
      return;
    }
    setSubmittingId(rejectingItem.offerId);
    try {
      await rejectLegalVerification(
        rejectingItem.offerId,
        { reasonCode: rejectReasonCode, reasonText: rejectReasonText.trim() || null },
        token,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRejectingItem(null);
      setRejectReasonText('');
      setRejectReasonCode('KW_NOT_FOUND');
      await loadQueue();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof LegalVerificationServiceError ? err.message : 'Nie udało się odrzucić.';
      Alert.alert('Błąd', msg);
    } finally {
      setSubmittingId(null);
    }
  }, [rejectReasonCode, rejectReasonText, rejectingItem, loadQueue, token]);

  const openExternalEKW = useCallback((item: AdminLegalVerificationQueueItem) => {
    const url = item.ekwQuickLink || 'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW';
    Linking.openURL(url).catch(() => Alert.alert('Błąd', 'Nie udało się otworzyć EKW.'));
  }, []);

  const palette = useMemo(
    () => ({
      cardBg: isDark ? '#1C1C1E' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      pillBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    }),
    [isDark],
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.text }]}>Weryfikacja prawna</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>
              KW + nr lokalu z ofert · ręczna walidacja w EKW
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={32} color={theme.subtitle} />
          </Pressable>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab.id);
                }}
                style={({ pressed }) => [
                  styles.tabPill,
                  {
                    backgroundColor: isActive ? '#34C759' : palette.pillBg,
                  },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={[styles.tabPillText, { color: isActive ? '#FFFFFF' : theme.text }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#34C759" style={{ marginTop: 48 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.subtitle} />
            <Text style={[styles.emptyText, { color: theme.subtitle }]}>
              {activeTab === 'PENDING' ? 'Brak zgłoszeń do weryfikacji.' : 'Brak ofert w tym widoku.'}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }} showsVerticalScrollIndicator={false}>
            {items.map((item) => (
              <QueueCard
                key={item.offerId}
                item={item}
                theme={theme}
                isBusy={submittingId === item.offerId}
                onOpenEKW={() => openExternalEKW(item)}
                onApprove={() => handleApprove(item)}
                onReject={() => {
                  setRejectingItem(item);
                  setRejectReasonCode('KW_NOT_FOUND');
                  setRejectReasonText('');
                }}
                canActOn={activeTab === 'PENDING'}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Modal odrzucenia — zagnieżdżony, otwiera się tylko gdy `rejectingItem != null` */}
      <Modal
        visible={rejectingItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectingItem(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 48 : 0}
        >
        <View style={styles.rejectBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setRejectingItem(null)} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.rejectSheet, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
            <Text style={[styles.rejectTitle, { color: theme.text }]}>Odrzuć weryfikację</Text>
            <Text style={[styles.rejectSub, { color: theme.subtitle }]}>
              Oferta #{rejectingItem?.offerId} · KW {rejectingItem?.landRegistryNumber}
            </Text>

            <Text style={[styles.rejectGroupLabel, { color: theme.subtitle }]}>Powód</Text>
            <View style={styles.reasonsList}>
              {LEGAL_VERIFICATION_REJECTION_REASONS.map((code) => {
                const active = rejectReasonCode === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRejectReasonCode(code);
                    }}
                    style={({ pressed }) => [
                      styles.reasonPill,
                      {
                        backgroundColor: active ? '#FF3B30' : palette.pillBg,
                        borderColor: active ? '#FF3B30' : palette.cardBorder,
                      },
                      pressed && { opacity: 0.78 },
                    ]}
                  >
                    <Text style={[styles.reasonPillText, { color: active ? '#FFFFFF' : theme.text }]} numberOfLines={1}>
                      {getRejectionReasonLabel(code)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.rejectGroupLabel, { color: theme.subtitle }]}>
              Komentarz dla właściciela {rejectReasonCode === 'OTHER' ? '(wymagany)' : '(opcjonalny)'}
            </Text>
            <TextInput
              value={rejectReasonText}
              onChangeText={setRejectReasonText}
              placeholder="Np. „KW jest, ale lokal nr 14A nie istnieje w wykazie — sprawdź czy nie chodzi o 14B."
              placeholderTextColor={theme.subtitle}
              style={[
                styles.reasonInput,
                {
                  color: theme.text,
                  backgroundColor: palette.pillBg,
                  borderColor: palette.cardBorder,
                },
              ]}
              multiline
              numberOfLines={3}
            />

            <View style={styles.rejectActions}>
              <Pressable
                onPress={() => setRejectingItem(null)}
                style={({ pressed }) => [
                  styles.rejectCancel,
                  { backgroundColor: palette.pillBg },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={[styles.rejectCancelText, { color: theme.text }]}>Anuluj</Text>
              </Pressable>
              <Pressable
                onPress={handleRejectConfirm}
                disabled={submittingId !== null}
                style={({ pressed }) => [
                  styles.rejectConfirm,
                  { opacity: submittingId !== null ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {submittingId !== null ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rejectConfirmText}>Odrzuć ofertę</Text>
                )}
              </Pressable>
            </View>
          </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

// --------------------------------------------------------------------
//  Pojedyncza karta w kolejce
// --------------------------------------------------------------------
function QueueCard({
  item,
  theme,
  isBusy,
  canActOn,
  onOpenEKW,
  onApprove,
  onReject,
}: {
  item: AdminLegalVerificationQueueItem;
  theme: Theme;
  isBusy: boolean;
  canActOn: boolean;
  onOpenEKW: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const subtle = theme.subtitle;
  const submittedLabel = useMemo(() => {
    if (!item.submittedAt) return null;
    try {
      const d = new Date(item.submittedAt);
      return d.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  }, [item.submittedAt]);

  const addressLine = [item.city, item.district, item.street, item.apartmentNumber ? `m. ${item.apartmentNumber}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
            {item.offerTitle || `Oferta #${item.offerId}`}
          </Text>
          {!!addressLine && (
            <Text style={[styles.cardSub, { color: subtle }]} numberOfLines={2}>
              {addressLine}
            </Text>
          )}
        </View>
        {submittedLabel ? (
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={12} color={subtle} />
            <Text style={[styles.timePillText, { color: subtle }]}>{submittedLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.kwBox, { borderColor: cardBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
        <Text style={[styles.kwLabel, { color: subtle }]}>Numer księgi wieczystej</Text>
        <Text style={[styles.kwValue, { color: theme.text }]} selectable>
          {item.landRegistryNumber}
        </Text>
        {item.apartmentNumber ? (
          <>
            <Text style={[styles.kwLabel, { color: subtle, marginTop: 8 }]}>Numer lokalu</Text>
            <Text style={[styles.kwValue, { color: theme.text }]} selectable>
              {item.apartmentNumber}
            </Text>
          </>
        ) : null}
        {item.ownerNote ? (
          <>
            <Text style={[styles.kwLabel, { color: subtle, marginTop: 8 }]}>Notatka właściciela</Text>
            <Text style={[styles.cardSub, { color: theme.text }]}>{item.ownerNote}</Text>
          </>
        ) : null}
      </View>

      <Pressable
        onPress={onOpenEKW}
        style={({ pressed }) => [
          styles.ekwBtn,
          { borderColor: '#007AFF', opacity: pressed ? 0.78 : 1 },
        ]}
      >
        <Ionicons name="open-outline" size={16} color="#007AFF" />
        <Text style={styles.ekwBtnText}>Sprawdź w EKW</Text>
      </Pressable>

      {canActOn ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={onApprove}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.approveBtn,
              { opacity: isBusy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                <Text style={styles.approveBtnText}>Akceptuj</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.rejectBtn,
              { opacity: isBusy ? 0.6 : pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="close-circle" size={18} color="#FF3B30" />
            <Text style={styles.rejectBtnText}>Odrzuć</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  tabPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  tabPillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyText: { fontSize: 14, fontWeight: '600', marginTop: 12, textAlign: 'center' },

  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 12, fontWeight: '600', marginTop: 3, lineHeight: 16 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timePillText: { fontSize: 11, fontWeight: '700' },

  kwBox: { borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 12 },
  kwLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  kwValue: { fontSize: 15, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },

  ekwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.4,
    marginBottom: 10,
  },
  ekwBtnText: { color: '#007AFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 14,
  },
  approveBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,59,48,0.12)',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: '#FF3B30',
  },
  rejectBtnText: { color: '#FF3B30', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },

  rejectBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  rejectSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  rejectTitle: { fontSize: 18, fontWeight: '900' },
  rejectSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  rejectGroupLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  reasonsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  reasonPillText: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.2 },
  reasonInput: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  rejectActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  rejectCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  rejectCancelText: { fontSize: 14, fontWeight: '800' },
  rejectConfirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
  },
  rejectConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
});
