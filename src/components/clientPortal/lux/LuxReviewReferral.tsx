import React, { useState } from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LuxButton, LuxCard, LuxChip, LuxField, LuxKicker, LuxTitle } from './LuxUI';
import { luxAction } from './luxApi';
import type { LuxPalette } from './luxTheme';

/** Po kluczach: ocena współpracy + polecenie znajomego (trafia do agenta jako nowy kontakt). */
export function LuxReview({
  token,
  palette,
  agentFirst,
  review,
  reviewLink,
  onChanged,
}: {
  token: string;
  palette: LuxPalette;
  agentFirst: string;
  review?: { rating: number; comment: string | null } | null;
  reviewLink?: string;
  onChanged: () => void;
}) {
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(Boolean(review));

  const submit = async () => {
    setBusy(true);
    try {
      await luxAction(token, 'submit_review', { rating, comment });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      onChanged();
    } catch (e) {
      Alert.alert('Ocena', e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxCard palette={palette}>
      <LuxKicker palette={palette}>Twoja opinia</LuxKicker>
      <LuxTitle palette={palette}>{sent ? 'Dziękujemy za ocenę' : `Jak oceniasz współpracę z ${agentFirst}?`}</LuxTitle>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            disabled={sent}
            onPress={() => {
              void Haptics.selectionAsync();
              setRating(n);
            }}
            hitSlop={4}
          >
            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? '#D8A93B' : palette.muted} />
          </Pressable>
        ))}
      </View>
      {!sent ? (
        <>
          <LuxField palette={palette} value={comment} onChangeText={setComment} placeholder="Kilka słów (opcjonalnie)" multiline />
          <LuxButton palette={palette} label="Wyślij ocenę" onPress={() => void submit()} busy={busy} disabled={!rating} style={{ marginTop: 12 }} />
        </>
      ) : rating >= 4 && reviewLink ? (
        <LuxButton palette={palette} variant="ghost" label="Zostaw też opinię w Google" onPress={() => void Linking.openURL(reviewLink)} style={{ marginTop: 14 }} />
      ) : null}
    </LuxCard>
  );
}

export function LuxReferral({ token, palette, agentFirst }: { token: string; palette: LuxPalette; agentFirst: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [need, setNeed] = useState<'BUYER' | 'SELLER' | 'RENT'>('BUYER');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await luxAction(token, 'send_referral', { name, phone, need, note });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSent(true);
      setName('');
      setPhone('');
      setNote('');
    } catch (e) {
      Alert.alert('Polecenie', e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxCard palette={palette}>
      <LuxKicker palette={palette}>Polecenie</LuxKicker>
      <LuxTitle palette={palette}>Znasz kogoś, kto kupuje albo sprzedaje?</LuxTitle>
      <Text style={{ fontSize: 14, color: palette.muted, marginTop: 6, lineHeight: 20 }}>
        {sent ? `Dziękujemy! ${agentFirst} odezwie się do tej osoby.` : `Podaj kontakt — ${agentFirst} zadzwoni i powie, że to od Ciebie.`}
      </Text>
      {!open ? (
        <LuxButton palette={palette} variant="ghost" label={sent ? 'Poleć kolejną osobę' : 'Poleć znajomego'} onPress={() => { setOpen(true); setSent(false); }} style={{ marginTop: 12 }} />
      ) : (
        <>
          <LuxField palette={palette} label="Imię" value={name} onChangeText={setName} />
          <LuxField palette={palette} label="Telefon" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <LuxChip palette={palette} label="Kupuje" on={need === 'BUYER'} onPress={() => setNeed('BUYER')} />
            <LuxChip palette={palette} label="Sprzedaje" on={need === 'SELLER'} onPress={() => setNeed('SELLER')} />
            <LuxChip palette={palette} label="Wynajem" on={need === 'RENT'} onPress={() => setNeed('RENT')} />
          </View>
          <LuxField palette={palette} value={note} onChangeText={setNote} placeholder="Coś, co warto wiedzieć (opcjonalnie)" />
          <LuxButton palette={palette} label="Wyślij polecenie" onPress={() => void send().then(() => setOpen(false))} busy={busy} disabled={!name.trim() || !phone.trim()} style={{ marginTop: 14 }} />
        </>
      )}
    </LuxCard>
  );
}
