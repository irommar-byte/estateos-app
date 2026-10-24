import React, { useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import LuxSheet from './LuxSheet';
import { LuxButton, LuxField } from './LuxUI';
import { luxAction } from './luxApi';
import type { LuxPalette } from './luxTheme';
import type { LuxCompanion } from './types';

/** Druga osoba: osobny link do panelu (ogląda i ocenia oferty, bez Twoich ustawień). */
export default function LuxPartnerSheet({
  open,
  onClose,
  token,
  companions,
  palette,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  token: string;
  companions: LuxCompanion[];
  palette: LuxPalette;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const share = (c: { name: string; url: string }) =>
    void Share.share({ message: `${c.name}, tu jest nasz panel z ofertami — możesz oglądać i oceniać razem ze mną: ${c.url}` });

  const create = async () => {
    setBusy(true);
    try {
      const res = await luxAction<{ companion?: { name: string; url: string } }>(token, 'create_partner_link', { name });
      setName('');
      onChanged();
      if (res.companion) share(res.companion);
    } catch (e) {
      Alert.alert('Druga osoba', e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Wybierajcie razem" title="Druga osoba w panelu" palette={palette}>
      <Text style={{ fontSize: 15, color: palette.muted, lineHeight: 21 }}>
        Partner, rodzina albo znajomy dostaje własny link: ogląda oferty i ocenia je osobno. Widzicie swoje oceny obok siebie.
      </Text>
      {companions.map((c) => (
        <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.ink }}>{c.name}</Text>
            <Text style={{ fontSize: 12, color: palette.muted }}>
              {c.lastSeenAt ? `Ostatnio: ${new Date(c.lastSeenAt).toLocaleDateString('pl-PL')}` : 'Jeszcze nie otworzył(a)'}
            </Text>
          </View>
          <Pressable onPress={() => share(c)} hitSlop={8}>
            <Text style={{ color: palette.accent, fontWeight: '800' }}>Wyślij</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('Odebrać dostęp?', `${c.name} straci dostęp do panelu.`, [
                { text: 'Anuluj', style: 'cancel' },
                {
                  text: 'Odbierz',
                  style: 'destructive',
                  onPress: () => void luxAction(token, 'revoke_partner_link', { companionId: c.id }).then(onChanged),
                },
              ])
            }
            hitSlop={8}
          >
            <Text style={{ color: palette.bad, fontWeight: '700' }}>Usuń</Text>
          </Pressable>
        </View>
      ))}
      <LuxField palette={palette} label="Imię drugiej osoby" value={name} onChangeText={setName} placeholder="np. Marek" />
      <LuxButton palette={palette} label="Utwórz link i wyślij" onPress={() => void create()} busy={busy} disabled={!name.trim()} style={{ marginTop: 16 }} />
    </LuxSheet>
  );
}
