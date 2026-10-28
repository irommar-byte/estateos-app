import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import SellerClientPipelineBar from './SellerClientPipelineBar';
import PortalBrandMark from '../marketing/PortalBrandMark';
import { formatCurrencyPLN } from '../../utils/crmFormatters';
import type { SellerProjectSummary, SellerSummaryTone } from '../../lib/sellerProjectSummary';

const appleType = Platform.select({
  ios: { fontFamily: 'System' as const },
  android: { fontFamily: 'sans-serif' as const },
  default: {},
});

type Colors = { card: string; text: string; secondary: string; border: string; input: string };

const TONE: Record<SellerSummaryTone, { fg: string; bg: string; bgDark: string }> = {
  neutral: { fg: '#6C6C70', bg: 'rgba(118,118,128,0.12)', bgDark: 'rgba(142,142,147,0.22)' },
  progress: { fg: '#007AFF', bg: 'rgba(0,122,255,0.1)', bgDark: 'rgba(10,132,255,0.2)' },
  warning: { fg: '#C25E00', bg: 'rgba(255,149,0,0.14)', bgDark: 'rgba(255,159,10,0.22)' },
  success: { fg: '#1F8A44', bg: 'rgba(52,199,89,0.14)', bgDark: 'rgba(48,209,88,0.22)' },
  danger: { fg: '#D70015', bg: 'rgba(255,59,48,0.12)', bgDark: 'rgba(255,69,58,0.22)' },
};

function toneColors(tone: SellerSummaryTone, isDark: boolean) {
  const t = TONE[tone];
  return { fg: isDark && tone === 'neutral' ? '#AEAEB2' : t.fg, bg: isDark ? t.bgDark : t.bg };
}

function dueLabel(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return `do ${date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;
}

function ProjectCard({
  item,
  colors,
  isDark,
  onOpen,
  onOpenOffer,
}: {
  item: SellerProjectSummary;
  colors: Colors;
  isDark: boolean;
  onOpen: () => void;
  onOpenOffer?: () => void;
}) {
  const status = toneColors(item.status.tone, isDark);
  const due = dueLabel(item.nextStep?.dueAt || null);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : 'rgba(60,60,67,0.08)',
          shadowOpacity: isDark ? 0.4 : 0.06,
        },
      ]}
    >
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.head, { opacity: pressed ? 0.7 : 1 }]}>
        {item.coverUrl ? (
          <Image source={{ uri: item.coverUrl }} style={styles.cover} contentFit="cover" recyclingKey={`sell-${item.id}`} />
        ) : (
          <View style={[styles.cover, styles.coverEmpty, { backgroundColor: isDark ? 'rgba(48,209,88,0.12)' : 'rgba(52,199,89,0.09)' }]}>
            <Ionicons name="home-outline" size={30} color="#34C759" />
          </View>
        )}
        <View style={styles.headCopy}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.fg }]} />
              <Text style={[styles.statusText, appleType, { color: status.fg }]}>{item.status.label}</Text>
            </View>
            {item.linkedOfferId ? (
              <Text style={[styles.offerId, appleType, { color: colors.secondary }]}>Oferta #{item.linkedOfferId}</Text>
            ) : null}
          </View>
          <Text style={[styles.title, appleType, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.details ? (
            <Text style={[styles.details, appleType, { color: colors.secondary }]} numberOfLines={2}>
              {item.details}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {item.location ? (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={13} color={colors.secondary} />
                <Text style={[styles.metaText, appleType, { color: colors.secondary }]} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
            ) : null}
            {item.price ? (
              <Text style={[styles.price, appleType, { color: colors.text }]}>{formatCurrencyPLN(item.price)}</Text>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.secondary} style={styles.chevron} />
      </Pressable>

      {item.loading ? (
        <View style={[styles.loading, { backgroundColor: colors.input }]}>
          <ActivityIndicator size="small" color="#34C759" />
          <Text style={[styles.loadingText, appleType, { color: colors.secondary }]}>Wczytuję etap sprzedaży…</Text>
        </View>
      ) : (
        <>
          {item.stages?.length ? <SellerClientPipelineBar stages={item.stages} isDark={isDark} /> : null}

          <View style={[styles.nowBox, { borderColor: colors.border }]}>
            <View style={styles.nowCol}>
              <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>ETAP</Text>
              <Text style={[styles.nowValue, appleType, { color: colors.text }]} numberOfLines={1}>
                {item.stageLabel || '—'}
              </Text>
            </View>
            <View style={[styles.nowRule, { backgroundColor: colors.border }]} />
            <View style={[styles.nowCol, { flex: 2.4 }]}>
              <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>
                NASTĘPNY KROK{due ? ` · ${due.toUpperCase()}` : ''}
              </Text>
              <Text style={[styles.nowValue, appleType, { color: item.nextStep ? colors.text : colors.secondary }]} numberOfLines={2}>
                {item.nextStep?.text || 'Nie ustalono — dodaj plan w pozysku'}
              </Text>
            </View>
          </View>

          {item.facts.length ? (
            <View style={styles.facts}>
              {item.facts.map((fact) => {
                const tone = toneColors(fact.tone, isDark);
                return (
                  <View key={fact.key} style={[styles.fact, { backgroundColor: colors.input }]}>
                    <View style={[styles.factIcon, { backgroundColor: tone.bg }]}>
                      <Ionicons name={fact.icon} size={14} color={tone.fg} />
                    </View>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={[styles.factLabel, appleType, { color: colors.secondary }]}>{fact.label}</Text>
                      <Text style={[styles.factValue, appleType, { color: colors.text }]} numberOfLines={1}>
                        {fact.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={[styles.channels, { borderTopColor: colors.border }]}>
            <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>PUBLIKACJA</Text>
            {item.channels.length ? (
              <View style={styles.channelList}>
                {item.channels.map((channel) => (
                  <View key={channel.id} style={styles.channel}>
                    <PortalBrandMark id={channel.id} size={22} />
                    <Text style={[styles.channelText, appleType, { color: colors.text }]}>{channel.label}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.channelEmpty, appleType, { color: colors.secondary }]}>Jeszcze nigdzie nie opublikowano</Text>
            )}
          </View>
        </>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onOpen} style={({ pressed }) => [styles.primaryBtn, { opacity: pressed ? 0.75 : 1 }]}>
          <Text style={[styles.primaryText, appleType]}>Otwórz pozysk</Text>
        </Pressable>
        {onOpenOffer ? (
          <Pressable
            onPress={onOpenOffer}
            style={({ pressed }) => [styles.ghostBtn, { borderColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="open-outline" size={15} color={colors.text} />
            <Text style={[styles.ghostText, appleType, { color: colors.text }]}>Ogłoszenie</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function ClientSellingOverview({
  items,
  colors,
  isDark,
  busy,
  onOpenProject,
  onOpenOffer,
  onAddProject,
}: {
  items: SellerProjectSummary[];
  colors: Colors;
  isDark: boolean;
  busy?: boolean;
  onOpenProject: (projectId: number) => void;
  onOpenOffer: (offerId: number) => void;
  onAddProject: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionKicker, appleType]}>SPRZEDAJE · {items.length}</Text>
          <Text style={[styles.sectionTitle, appleType, { color: colors.text }]}>
            {items.length === 1 ? 'Nieruchomość na sprzedaż' : 'Nieruchomości na sprzedaż'}
          </Text>
        </View>
        <Pressable
          disabled={busy}
          onPress={onAddProject}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, { opacity: busy ? 0.5 : pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="add" size={16} color="#1F8A44" />
          <Text style={[styles.addText, appleType]}>Nowy pozysk</Text>
        </Pressable>
      </View>
      {items.map((item) => (
        <ProjectCard
          key={item.id}
          item={item}
          colors={colors}
          isDark={isDark}
          onOpen={() => onOpenProject(item.id)}
          onOpenOffer={item.linkedOfferId ? () => onOpenOffer(item.linkedOfferId as number) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginBottom: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4 },
  sectionKicker: { color: '#34C759', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: 'rgba(52,199,89,0.14)',
  },
  addText: { color: '#1F8A44', fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowColor: '#1C1917',
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
  },
  head: { flexDirection: 'row', gap: 14 },
  cover: { width: 108, height: 108, borderRadius: 16 },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  headCopy: { flex: 1, minWidth: 0 },
  chevron: { alignSelf: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: -0.1 },
  offerId: { fontSize: 12, fontWeight: '500', fontVariant: ['tabular-nums'] },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.4, lineHeight: 23, marginTop: 8 },
  details: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  metaText: { fontSize: 13 },
  price: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  loading: {
    marginTop: 14,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: { fontSize: 13 },
  nowBox: {
    marginTop: 12,
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  nowCol: { flex: 1, minWidth: 0 },
  nowRule: { width: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  kicker: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  nowValue: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2, marginTop: 4, lineHeight: 20 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  fact: {
    flexGrow: 1,
    flexBasis: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  factIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  factLabel: { fontSize: 11, fontWeight: '500' },
  factValue: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2, marginTop: 1 },
  channels: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  channelList: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  channelText: { fontSize: 13, fontWeight: '600' },
  channelEmpty: { fontSize: 13, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostText: { fontSize: 15, fontWeight: '600' },
});
