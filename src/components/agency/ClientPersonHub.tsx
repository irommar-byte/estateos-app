import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { ClientPersonProject } from '../../services/agencyClientService';
import { resolveMediaUrl } from '../../utils/userAvatar';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

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
  onSchedulePresentation,
  coverOverrides,
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
  onSchedulePresentation: () => void;
  coverOverrides?: Record<number, string>;
}) {
  const [buyActionsOpen, setBuyActionsOpen] = useState(false);

  if (view === 'lane' && lane) {
    const isSell = lane === 'SELL';
    const items = isSell ? selling : buying;
    return (
      <View style={{ gap: 12 }}>
        <Pressable onPress={onBackToPerson} hitSlop={10}>
          <Text style={{ color: '#34C759', fontWeight: '800', fontSize: 13 }}>← Karty klienta</Text>
        </Pressable>
        <Text style={{ color: isSell ? '#34C759' : '#FF9500', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }}>
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
        {items.map((item) => {
          const cover =
            resolveMediaUrl(item.coverImageUrl) ||
            (item.linkedOfferId ? coverOverrides?.[item.linkedOfferId] : null);
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpenProject(item.id)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={styles.thumbnail}
                    contentFit="cover"
                    recyclingKey={`hub-${item.id}`}
                  />
                ) : (
                  <View style={[styles.thumbnail, styles.placeholderThumb, { backgroundColor: colors.border }]}>
                    <Ionicons name={isSell ? 'home-outline' : 'search-outline'} size={20} color={colors.secondary} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 3 }} numberOfLines={1}>{item.subtitle}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <Text style={{ color: colors.accent, fontSize: 10, fontWeight: '900' }}>
                      {item.statusLabel.toUpperCase()}
                      {item.portalUnreadCount ? ` · CZAT ${item.portalUnreadCount}` : ''}
                    </Text>
                    {item.eventStage ? (
                      <Text style={{ color: '#FF9500', fontSize: 10, fontWeight: '900' }}>
                        {(item.eventStage.kind === 'auction'
                          ? 'LICYTACJA'
                          : item.eventStage.kind === 'open_house'
                            ? 'DZIEŃ OTWARTY'
                            : 'WYDARZENIE') + ` · ${item.eventStage.label.toUpperCase()}`}
                      </Text>
                    ) : null}
                    {item.createdAt ? (
                      <Text style={{ color: colors.secondary, fontSize: 10, fontWeight: '600' }}>
                        {formatDate(item.createdAt)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ justifyContent: 'center' }}>
                  <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
                </View>
              </View>
            </Pressable>
          );
        })}
        {!items.length ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderStyle: 'dashed' }]}>
            <Text style={{ color: colors.secondary }}>{isSell ? 'Brak pozysku sprzedaży.' : 'Brak aktywnego poszukiwania.'}</Text>
          </View>
        ) : null}
        {isSell ? (
          <Pressable
            disabled={busy}
            onPress={() => onAddProject('SELLER')}
            style={[styles.add, { opacity: busy ? 0.5 : 1 }]}
          >
            <Ionicons name="add" size={18} color="#052e16" />
            <Text style={{ color: '#052e16', fontWeight: '900' }}>Nowy pozysk</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              disabled={busy}
              onPress={() => onAddProject('BUYER')}
              style={[styles.add, { opacity: busy ? 0.5 : 1 }]}
            >
              <Ionicons name="add" size={18} color="#052e16" />
              <Text style={{ color: '#052e16', fontWeight: '900' }}>Nowe poszukiwanie</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onSchedulePresentation}
              style={[styles.addGhost, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: '900' }}>Nowa prezentacja</Text>
            </Pressable>
          </View>
        )}
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
      <View>
        <Pressable
          onPress={() => setBuyActionsOpen((open) => !open)}
          style={[styles.lane, { backgroundColor: colors.card, borderColor: buyActionsOpen ? '#FF9500' : colors.border }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,149,0,0.14)' }]}>
            <Ionicons name="search-outline" size={22} color="#FF9500" />
          </View>
          <Text style={{ color: '#FF9500', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }}>KUPUJE</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 4 }}>
            {buying.length ? `${buying.length} ${buying.length === 1 ? 'poszukiwanie' : 'poszukiwania'}` : 'Brak poszukiwania'}
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>
            {buying[0]?.title || 'Kryteria, radar i live chat jako osobny projekt.'}
          </Text>
          {!buyActionsOpen ? (
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 10 }}>
              Dotknij, żeby dodać poszukiwanie albo umówić prezentację.
            </Text>
          ) : null}
        </Pressable>
        {buyActionsOpen ? (
          <View style={styles.buyActions}>
            <Pressable
              disabled={busy}
              onPress={() => onAddProject('BUYER')}
              style={[styles.buyBtn, { opacity: busy ? 0.5 : 1 }]}
            >
              <Text style={styles.buyBtnText}>Nowe poszukiwanie</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onSchedulePresentation}
              style={[styles.buyBtnGhost, { borderColor: colors.border, opacity: busy ? 0.5 : 1 }]}
            >
              <Text style={[styles.buyBtnGhostText, { color: colors.text }]}>Nowa prezentacja</Text>
            </Pressable>
            {buying.length ? (
              <Pressable onPress={() => onOpenLane('BUY')} style={styles.buyLink}>
                <Text style={styles.buyLinkText}>Zobacz poszukiwania</Text>
                <Ionicons name="chevron-forward" size={14} color="#FF9500" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
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
    padding: 14,
  },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 14,
  },
  placeholderThumb: {
    alignItems: 'center',
    justifyContent: 'center',
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
  addGhost: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  buyActions: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  buyBtn: {
    flexGrow: 1,
    minWidth: '46%',
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buyBtnText: {
    color: '#3b2200',
    fontWeight: '900',
    fontSize: 13,
  },
  buyBtnGhost: {
    flexGrow: 1,
    minWidth: '46%',
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  buyBtnGhostText: {
    fontWeight: '900',
    fontSize: 13,
  },
  buyLink: {
    width: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buyLinkText: {
    color: '#FF9500',
    fontWeight: '800',
    fontSize: 12,
  },
});
