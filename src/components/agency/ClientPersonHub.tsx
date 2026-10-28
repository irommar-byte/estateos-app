import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { ClientPersonProject } from '../../services/agencyClientService';
import { resolveMediaUrl } from '../../utils/userAvatar';
import type { SellerProjectSummary } from '../../lib/sellerProjectSummary';
import ClientSellingOverview from './ClientSellingOverview';

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
  onOpenOffer,
  coverOverrides,
  sellingSummaries,
  isDark,
}: {
  selling: ClientPersonProject[];
  buying: ClientPersonProject[];
  view: 'person' | 'lane';
  lane: 'SELL' | 'BUY' | null;
  busy?: boolean;
  colors: { card: string; text: string; secondary: string; border: string; accent: string; input: string };
  onOpenLane: (next: 'SELL' | 'BUY') => void;
  onBackToPerson: () => void;
  onOpenProject: (projectId: number) => void;
  onAddProject: (type: 'BUYER' | 'SELLER') => void;
  onSchedulePresentation: () => void;
  onOpenOffer: (offerId: number) => void;
  coverOverrides?: Record<number, string>;
  sellingSummaries: SellerProjectSummary[];
  isDark: boolean;
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

  const emptyRow = (
    kind: 'SELL' | 'BUY',
    actions: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }>,
  ) => {
    const isSell = kind === 'SELL';
    const tint = isSell ? '#34C759' : '#FF9500';
    return (
      <View style={[styles.emptyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.emptyIcon, { backgroundColor: isSell ? 'rgba(52,199,89,0.14)' : 'rgba(255,149,0,0.14)' }]}>
          <Ionicons name={isSell ? 'home-outline' : 'search-outline'} size={17} color={tint} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text style={{ color: isSell ? '#34C759' : '#C47A12', fontSize: 11, fontWeight: '600', letterSpacing: 0.6 }}>
            {isSell ? 'Sprzedaje' : 'Kupuje'}
          </Text>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 1 }}>
            {isSell ? 'Brak pozysku' : 'Brak poszukiwania'}
          </Text>
        </View>
        <View style={styles.emptyActions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              disabled={busy}
              onPress={action.onPress}
              hitSlop={6}
              style={({ pressed }) => [
                styles.emptyBtn,
                { borderColor: colors.border, opacity: busy ? 0.5 : pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name={action.icon} size={14} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  const sellBlock = selling.length ? (
    <ClientSellingOverview
      items={sellingSummaries}
      colors={colors}
      isDark={isDark}
      busy={busy}
      onOpenProject={onOpenProject}
      onOpenOffer={onOpenOffer}
      onAddProject={() => onAddProject('SELLER')}
    />
  ) : (
    emptyRow('SELL', [{ label: 'Nowy pozysk', icon: 'add', onPress: () => onAddProject('SELLER') }])
  );

  const buyBlock = buying.length ? (
    <View>
      <Pressable
        onPress={() => setBuyActionsOpen((open) => !open)}
        style={[styles.lane, { backgroundColor: colors.card, borderColor: buyActionsOpen ? '#FF9500' : colors.border }]}
      >
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,149,0,0.14)' }]}>
          <Ionicons name="search-outline" size={22} color="#FF9500" />
        </View>
        <Text style={{ color: '#C47A12', fontSize: 11, fontWeight: '500', letterSpacing: 0.8, marginTop: 14 }}>Kupuje</Text>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '600', letterSpacing: -0.4, marginTop: 4 }}>
          {`${buying.length} ${buying.length === 1 ? 'poszukiwanie' : 'poszukiwania'}`}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>{buying[0]?.title}</Text>
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
          <Pressable onPress={() => onOpenLane('BUY')} style={styles.buyLink}>
            <Text style={styles.buyLinkText}>Zobacz poszukiwania</Text>
            <Ionicons name="chevron-forward" size={14} color="#FF9500" />
          </Pressable>
        </View>
      ) : null}
    </View>
  ) : (
    emptyRow('BUY', [
      { label: 'Poszukiwanie', icon: 'add', onPress: () => onAddProject('BUYER') },
      { label: 'Prezentacja', icon: 'calendar-outline', onPress: onSchedulePresentation },
    ])
  );

  return (
    <View style={{ gap: 12 }}>
      {selling.length || !buying.length ? (
        <>
          {sellBlock}
          {buyBlock}
        </>
      ) : (
        <>
          {buyBlock}
          {sellBlock}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lane: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
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
  emptyRow: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
