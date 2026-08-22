import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capitalizeSentence, capitalizeWords, formatPolishDateTime } from '../../lib/polishText';

export const CLIENT_MEETING_EMAIL_INTRO =
  'Umówiliśmy się na spotkanie. Termin jest ustalony — szczegóły i listę przygotowań znajdziesz poniżej.';

export const CLIENT_CARD_EMAIL_INTRO =
  'Przesyłam moją wizytówkę EstateOS™ — w razie pytań o nieruchomości jestem do dyspozycji.';

export type ClientEmailPreviewData = {
  to: string;
  subject: string;
  clientFirstName: string;
  agentName: string;
  agentTitle: string;
  agencyName: string;
  agentPhone?: string | null;
  agentEmail?: string | null;
  agentAvatarUrl?: string | null;
  intro: string;
  meetingAt?: Date | null;
  meetingLocation?: string | null;
  emailComment?: string | null;
  prepLabels?: string[];
};

type Props = {
  visible: boolean;
  data: ClientEmailPreviewData | null;
  isDark?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ClientEmailPreviewModal({
  visible,
  data,
  isDark,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const greetingName = capitalizeWords(data?.clientFirstName || 'Kliencie');
  const comment = data?.emailComment ? capitalizeSentence(data.emailComment) : '';
  const prep = (data?.prepLabels || []).filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7', paddingTop: 12 }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>PODGLĄD WIADOMOŚCI</Text>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#111' }]}>Mail do klienta</Text>
          </View>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Ionicons name="close-circle" size={28} color={isDark ? '#8E8E93' : '#C7C7CC'} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>
          To jest dokładna treść, którą otrzyma klient. Komentarz wewnętrzny agenta nie jest tutaj widoczny.
        </Text>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.metaCard, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <MetaRow label="Do" value={data?.to || '—'} isDark={isDark} />
            <MetaRow label="Temat" value={data?.subject || '—'} last isDark={isDark} />
          </View>

          <View style={styles.mailShadow}>
            <View style={styles.mailHero}>
              <Text style={styles.mailHeroKicker}>Wizytówka agenta</Text>
              <Text style={styles.mailHeroTitle}>Witaj {greetingName}</Text>
            </View>
            <View style={[styles.mailBody, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
              <View style={styles.agentRow}>
                {data?.agentAvatarUrl ? (
                  <Image source={{ uri: data.agentAvatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{(data?.agentName || 'A').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agentName, { color: isDark ? '#fff' : '#111' }]}>{data?.agentName}</Text>
                  <Text style={styles.agentTitle}>{(data?.agentTitle || 'Agent nieruchomości').toUpperCase()}</Text>
                  <Text style={{ color: isDark ? '#8E8E93' : '#6C6C70', marginTop: 4, fontSize: 13 }}>
                    {data?.agencyName}
                  </Text>
                </View>
              </View>

              <Text style={[styles.intro, { color: isDark ? '#E5E5EA' : '#374151' }]}>{data?.intro}</Text>

              {data?.meetingAt ? (
                <View style={styles.meetingBox}>
                  <Text style={styles.meetingKicker}>Umówione spotkanie</Text>
                  <Text style={styles.meetingWhen}>{formatPolishDateTime(data.meetingAt)}</Text>
                  {data.meetingLocation ? (
                    <Text style={styles.meetingLoc}>{data.meetingLocation}</Text>
                  ) : null}
                  {comment ? <Text style={styles.meetingNote}>{comment}</Text> : null}
                </View>
              ) : comment ? (
                <Text style={[styles.intro, { color: isDark ? '#E5E5EA' : '#374151' }]}>{comment}</Text>
              ) : null}

              {prep.length > 0 ? (
                <View style={styles.prepBox}>
                  <Text style={styles.prepKicker}>Proszę przygotować</Text>
                  {prep.map((item) => (
                    <Text key={item} style={styles.prepItem}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}

              {data?.agentPhone ? (
                <Text style={[styles.contact, { color: isDark ? '#E5E5EA' : '#111' }]}>Telefon · {data.agentPhone}</Text>
              ) : null}
              {data?.agentEmail ? (
                <Text style={[styles.contact, { color: isDark ? '#E5E5EA' : '#111' }]}>E-mail · {data.agentEmail}</Text>
              ) : null}

              <Text style={styles.attachHint}>
                W załączniku znajdziesz wizytówkę vCard
                {data?.meetingAt ? ' oraz plik kalendarza (.ics).' : '.'}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
          <Pressable onPress={onCancel} style={[styles.btn, styles.btnGhost, { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)' }]}>
            <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800' }}>Popraw</Text>
          </Pressable>
          <Pressable onPress={onConfirm} disabled={busy} style={[styles.btn, styles.btnPrimary]}>
            <Text style={styles.btnPrimaryText}>{busy ? 'Wysyłanie…' : 'Akceptuję i wysyłam'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MetaRow({
  label,
  value,
  last,
  isDark,
}: {
  label: string;
  value: string;
  last?: boolean;
  isDark?: boolean;
}) {
  return (
    <View style={[styles.metaRow, !last && styles.metaRowLine]}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, { color: isDark ? '#fff' : '#111' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16 },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(60,60,67,0.28)',
    marginBottom: 10,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 2 },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  metaCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 16,
    shadowColor: '#1a1612',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  metaRow: { paddingVertical: 10 },
  metaRowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(60,60,67,0.12)' },
  metaLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#8E8E93', marginBottom: 2 },
  metaValue: { fontSize: 14, fontWeight: '700', color: '#111' },
  mailShadow: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
    marginBottom: 8,
  },
  mailHero: {
    backgroundColor: '#102a23',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 36,
  },
  mailHeroKicker: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  mailHeroTitle: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.4, marginTop: 8 },
  mailBody: { marginTop: -22, marginHorizontal: 12, marginBottom: 12, borderRadius: 22, padding: 18 },
  agentRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: '#10b981' },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#fff', fontSize: 24, fontWeight: '900' },
  agentName: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  agentTitle: { marginTop: 4, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#059669' },
  intro: { fontSize: 15, lineHeight: 22, marginBottom: 14 },
  meetingBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  meetingKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#047857', textTransform: 'uppercase' },
  meetingWhen: { marginTop: 6, fontSize: 18, fontWeight: '900', color: '#064e3b' },
  meetingLoc: { marginTop: 4, color: '#065f46', fontSize: 14, fontWeight: '600' },
  meetingNote: { marginTop: 8, color: '#374151', fontSize: 14, lineHeight: 20 },
  prepBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  prepKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: '#475569', textTransform: 'uppercase', marginBottom: 8 },
  prepItem: { fontSize: 14, color: '#334155', lineHeight: 22 },
  contact: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  attachHint: { marginTop: 16, fontSize: 12, color: '#9ca3af', lineHeight: 18 },
  footer: { flexDirection: 'row', gap: 12, paddingTop: 10 },
  btn: { flex: 1, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnGhost: { borderWidth: 1 },
  btnPrimary: { backgroundColor: '#34C759' },
  btnPrimaryText: { color: '#000', fontWeight: '900', fontSize: 14, textAlign: 'center' },
});
