import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ClientPersonProject } from '../../services/agencyClientService';

export default function ClientPersonHub({
  selling,
  buying,
  view,
  lane,
  busy,
  colors,
  onOpenLane,
  onBackToPerson,
  onOpenProject,
  onAddProject,
}: {
  selling: ClientPersonProject[];
  buying: ClientPersonProject[];
  view: 'person' | 'lane';
  lane: 'SELL' | 'BUY' | null;
  busy?: boolean;
  colors: { card: string; text: string; secondary: string; border: string; accent: string };
  onOpenLane: (next: 'SELL' | 'BUY') => void;
  onBackToPerson: () => void;
  onOpenProject: (projectId: number) => void;
  onAddProject: (type: 'BUYER' | 'SELLER') => void;
}) {
  if (view === 'lane' && lane) {
    const isSell = lane === 'SELL';
    const items = isSell ? selling : buying;
    return (
      <View style={{ gap: 12 }}>
        <Pressable onPress={onBackToPerson} hitSlop={10}>
          <Text style={{ color: '#34C759', fontWeight: '800', fontSize: 13 }}>← Karty klienta</Text>
        </Pressable>
        <Text style={{ color: isSell ? '#34C759' : '#5AC8FA', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
          {isSell ? 'SPRZEDAJE' : 'KUPUJE'}
        </Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>
          {isSell ? 'Wybierz pozysk' : 'Wybierz poszukiwanie'}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 18 }}>
          {isSell
            ? 'Każda nieruchomość to osobny projekt: umowa, ogłoszenie, promocje i live chat.'
            : 'Każde poszukiwanie ma własne kryteria, radar i live chat.'}
        </Text>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpenProject(item.id)}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{item.title}</Text>
            <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>{item.subtitle}</Text>
            <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900', marginTop: 8 }}>
              {item.statusLabel.toUpperCase()}
              {item.portalUnreadCount ? ` · CZAT ${item.portalUnreadCount}` : ''}
            </Text>
          </Pressable>
        ))}
        {!items.length ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderStyle: 'dashed' }]}>
            <Text style={{ color: colors.secondary }}>{isSell ? 'Brak pozysku sprzedaży.' : 'Brak aktywnego poszukiwania.'}</Text>
          </View>
        ) : null}
        <Pressable
          disabled={busy}
          onPress={() => onAddProject(isSell ? 'SELLER' : 'BUYER')}
          style={[styles.add, { opacity: busy ? 0.5 : 1 }]}
        >
          <Ionicons name="add" size={18} color="#052e16" />
          <Text style={{ color: '#052e16', fontWeight: '900' }}>{isSell ? 'Nowy pozysk' : 'Nowe poszukiwanie'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={() => onOpenLane('SELL')} style={[styles.lane, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="home-outline" size={22} color="#34C759" />
        </View>
        <Text style={{ color: '#34C759', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }}>SPRZEDAJE</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>
          {selling.length ? `${selling.length} ${selling.length === 1 ? 'pozysk' : 'pozyski'}` : 'Brak pozysku'}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>
          {selling[0]?.title || 'Umowa, ogłoszenie, promocje i czat w jednym projekcie.'}
        </Text>
      </Pressable>
      <Pressable onPress={() => onOpenLane('BUY')} style={[styles.lane, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(90,200,250,0.14)' }]}>
          <Ionicons name="search-outline" size={22} color="#5AC8FA" />
        </View>
        <Text style={{ color: '#5AC8FA', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }}>KUPUJE</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>
          {buying.length ? `${buying.length} ${buying.length === 1 ? 'poszukiwanie' : 'poszukiwania'}` : 'Brak poszukiwania'}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>
          {buying[0]?.title || 'Kryteria, radar i live chat jako osobny projekt.'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,199,89,0.14)',
  },
  add: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#34C759',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
