import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ProfileCardShell from '../profile/ProfileCardShell';
import {
  confirmPortalSchedule,
  proposePortalScheduleChange,
  type PortalScheduleSlot,
} from '../../services/clientPortalService';

type Colors = {
  card: string;
  text: string;
  secondary: string;
  border: string;
  green: string;
  gold: string;
  tint: string;
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  const label = date.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return label.charAt(0).toLocaleUpperCase('pl-PL') + label.slice(1);
}

function parseLocalStartsAt(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export default function PortalScheduleCard({
  portalToken,
  kind,
  slot,
  role,
  compact,
  canInteract,
  isDark,
  colors,
  onDone,
}: {
  portalToken: string;
  kind: 'meeting' | 'presentation';
  slot: PortalScheduleSlot;
  role: string;
  compact?: boolean;
  canInteract: boolean;
  isDark: boolean;
  colors: Colors;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<'confirm' | 'change' | null>(null);
  const [openChange, setOpenChange] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [reason, setReason] = useState('');

  const isSeller = String(role || '').toUpperCase() === 'SELLER';
  const isPresentation = kind === 'presentation';
  const label = isPresentation
    ? isSeller
      ? 'Pokaz mieszkania kupującemu'
      : 'Prezentacja nieruchomości'
    : isSeller
      ? 'Spotkanie z agentem'
      : 'Umówienie spotkania';
  const confirmed = slot.status === 'confirmed';

  const confirm = async () => {
    if (!canInteract) return;
    setBusy('confirm');
    try {
      await confirmPortalSchedule(portalToken, kind);
      onDone();
    } catch (err: any) {
      Alert.alert('Termin', err?.message || 'Nie udało się potwierdzić.');
    } finally {
      setBusy(null);
    }
  };

  const sendChange = async () => {
    if (!canInteract) return;
    const iso = parseLocalStartsAt(startsAt);
    if (!iso) {
      Alert.alert('Termin', 'Podaj datę w formacie RRRR-MM-DD GG:MM.');
      return;
    }
    if (reason.trim().length < 3) {
      Alert.alert('Termin', 'Dopisz krótki powód zmiany.');
      return;
    }
    setBusy('change');
    try {
      await proposePortalScheduleChange(portalToken, kind, { startsAt: iso, reason: reason.trim() });
      setOpenChange(false);
      setStartsAt('');
      setReason('');
      onDone();
    } catch (err: any) {
      Alert.alert('Termin', err?.message || 'Nie udało się wysłać propozycji.');
    } finally {
      setBusy(null);
    }
  };

  if (compact) {
    return (
      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
        {label} ({formatWhen(slot.startsAt)}){confirmed ? ' — zakończone.' : '.'}
      </Text>
    );
  }

  return (
    <ProfileCardShell isDark={isDark} style={{ marginBottom: 12 }} faceStyle={{ padding: 16 }}>
      <Text style={{ color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, marginTop: 8 }}>
        {formatWhen(slot.startsAt)}
      </Text>
      {slot.location ? (
        <Text style={{ color: colors.secondary, marginTop: 4 }}>{slot.location}</Text>
      ) : null}
      {isPresentation && isSeller ? (
        <Text style={{ color: colors.secondary, marginTop: 8, fontSize: 13, lineHeight: 18 }}>
          To oglądanie z kupującym — nie spotkanie z agentem. Potwierdzenie idzie też do drugiej strony.
        </Text>
      ) : null}
      <Text style={{ color: confirmed ? colors.green : '#FF9500', fontWeight: '800', fontSize: 12, marginTop: 8 }}>
        {confirmed ? 'Potwierdzone' : 'Do potwierdzenia'}
      </Text>
      {slot.status === 'pending' && slot.reason ? (
        <Text style={{ color: '#B45309', marginTop: 6, fontSize: 13 }}>Prośba o zmianę: {slot.reason}</Text>
      ) : null}

      {canInteract ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          {!confirmed ? (
            <Pressable onPress={() => void confirm()} disabled={Boolean(busy)} style={[styles.primary, { opacity: busy ? 0.6 : 1 }]}>
              {busy === 'confirm' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Potwierdź termin</Text>
              )}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setOpenChange((v) => !v)}
            disabled={Boolean(busy)}
            style={[styles.secondary, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {openChange ? 'Anuluj zmianę' : 'Zaproponuj inny termin'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {openChange ? (
        <View style={{ marginTop: 10 }}>
          <TextInput
            value={startsAt}
            onChangeText={setStartsAt}
            placeholder="Nowy termin, np. 2026-09-10 18:00"
            placeholderTextColor={colors.secondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
          />
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Dlaczego zmieniasz termin"
            placeholderTextColor={colors.secondary}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card, minHeight: 72 }]}
          />
          <Pressable
            onPress={() => void sendChange()}
            disabled={Boolean(busy)}
            style={[styles.primary, { marginTop: 4, opacity: busy ? 0.6 : 1 }]}
          >
            {busy === 'change' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Wyślij propozycję agentowi</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </ProfileCardShell>
  );
}

const styles = StyleSheet.create({
  primary: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  secondary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  input: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
