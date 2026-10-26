import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  AppState,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { navigate } from '../../../navigationRef';
import { useAuthStore } from '../../store/useAuthStore';
import {
  reconcileKeiExportAfterForeground,
  useKeiAmerExportStore,
  type KeiExportItemProgress,
} from '../../store/useKeiAmerExportStore';
import { LUX_SERIF } from '../clientPortal/lux/luxTheme';
import {
  KEI_STEP_ORDER,
  KEI_STEP_TITLES,
  formatEta,
  formatPricePl,
  keiItemPercent,
  summarizeKeiJob,
} from '../../utils/keiImportProgressModel';

import { useKeiPalette, type KeiPalette as Palette } from './keiPalette';

function absoluteUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => alive && setReduce(Boolean(value)));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduce(Boolean(value)));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** Cienki pasek z płynnym wypełnieniem; po końcu zielony. */
function ProgressBar({ percent, done, palette, thin }: { percent: number; done?: boolean; palette: Palette; thin?: boolean }) {
  const width = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  const target = Math.max(done ? 100 : 2, Math.min(100, percent));
  useEffect(() => {
    if (reduce) {
      width.setValue(target);
      return;
    }
    Animated.timing(width, {
      toValue: target,
      duration: 520,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [target, reduce, width]);
  return (
    <View
      style={[styles.track, thin && styles.trackThin, { backgroundColor: palette.well }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target) }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: done ? palette.good : palette.gold,
            width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

function ProgressRing({ percent, palette, size = 34 }: { percent: number; palette: Palette; size?: number }) {
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={palette.lineStrong} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={palette.gold}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - Math.min(100, Math.max(0, percent)) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Aktywna kropka „oddycha” — spokojny rytm 2,4 s zamiast mrugania. */
function BreathingDot({ palette }: { palette: Palette }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  return (
    <View style={[styles.dot, { borderColor: palette.gold, backgroundColor: palette.goldSoft }]}>
      {!reduce ? (
        <Animated.View
          style={[
            styles.dotRing,
            {
              borderColor: palette.gold,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.6] }) }],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function StepTimeline({ item, palette }: { item: KeiExportItemProgress; palette: Palette }) {
  const isDone = item.status === 'done';
  return (
    <View style={styles.steps}>
      {KEI_STEP_ORDER.map((step, idx) => {
        const done = isDone || item.completedSteps.includes(step);
        const active = item.status === 'active' && item.currentStep === step;
        const lineOn = done || active;
        const label =
          step === 'images' && item.imageProgress?.asFloorPlan && (active || done)
            ? 'Rzut'
            : step === 'activate' && item.publishState === 'review'
              ? 'Szkic'
              : KEI_STEP_TITLES[step];
        return (
          <View key={step} style={styles.step}>
            {idx > 0 ? <View style={[styles.stepLine, { backgroundColor: lineOn ? palette.gold : palette.lineStrong }]} /> : null}
            {active ? (
              <BreathingDot palette={palette} />
            ) : (
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: done ? palette.gold : palette.lineStrong,
                    backgroundColor: done ? palette.gold : palette.card,
                  },
                ]}
              />
            )}
            <Text numberOfLines={1} style={[styles.stepLabel, { color: done || active ? palette.ink2 : palette.ink3 }]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function chipFor(item: KeiExportItemProgress, palette: Palette): { label: string; bg: string; fg: string } {
  if (item.status === 'done') {
    return item.publishState === 'review'
      ? { label: 'Szkic do przejrzenia', bg: palette.goldSoft, fg: palette.goldInk }
      : { label: 'Opublikowano', bg: palette.goodSoft, fg: palette.good };
  }
  if (item.status === 'skipped') {
    switch (item.skipKind) {
      case 'duplicate':
        return { label: 'Już w bazie', bg: palette.neutralSoft, fg: palette.ink2 };
      case 'inactive':
        return { label: 'Nieaktualne', bg: palette.neutralSoft, fg: palette.ink2 };
      case 'quality':
        return { label: 'Za słabe dane', bg: palette.goldSoft, fg: palette.warn };
      case 'blocked':
        return { label: 'Zablokowane', bg: palette.neutralSoft, fg: palette.ink2 };
      case 'cancelled':
        return { label: 'Anulowano', bg: palette.neutralSoft, fg: palette.ink2 };
      default:
        return { label: 'Błąd', bg: palette.dangerSoft, fg: palette.danger };
    }
  }
  if (item.status === 'active') return { label: `${keiItemPercent(item)}%`, bg: palette.goldSoft, fg: palette.goldInk };
  return { label: 'W kolejce', bg: palette.neutralSoft, fg: palette.ink2 };
}

function portalLabel(url: string) {
  if (/otodom/i.test(url)) return 'Otodom';
  if (/olx/i.test(url)) return 'OLX';
  if (/nieruchomosci-online/i.test(url)) return 'Nieruchomosci-Online';
  return 'Portal';
}

function ItemCard({
  item,
  palette,
  highlight,
  onOpenOffer,
}: {
  item: KeiExportItemProgress;
  palette: Palette;
  highlight: boolean;
  onOpenOffer: (offerId: number) => void;
}) {
  const chip = chipFor(item, palette);
  const price = formatPricePl(item.price);
  const area = item.area ? `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(item.area)} m²` : null;
  const facts = [price, area, item.district].filter(Boolean).join(' · ');
  const heading = item.title || item.address || item.portalUrl;
  const secondary =
    facts || (item.title && item.address ? item.address : item.status === 'pending' ? `${portalLabel(item.portalUrl)} · czeka na swoją kolej` : portalLabel(item.portalUrl));
  const imageShare =
    item.status === 'active' && item.currentStep === 'images' && item.imageProgress && item.imageProgress.total > 0
      ? Math.round((item.imageProgress.index / item.imageProgress.total) * 100)
      : null;
  const publicUrl = absoluteUrl(item.publicUrl);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: highlight ? palette.gold : palette.line,
          opacity: item.status === 'pending' ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.cardRow}>
        {item.thumbUrl ? (
          <Image source={{ uri: item.thumbUrl }} style={[styles.thumb, { backgroundColor: palette.well }]} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: palette.well }]}>
            <Ionicons name="image-outline" size={20} color={palette.ink3} />
          </View>
        )}
        <View style={styles.cardBody}>
          <View style={styles.cardHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={2} style={[styles.cardTitle, { color: palette.ink }]}>
                {heading}
              </Text>
              <Text numberOfLines={1} style={[styles.cardFacts, { color: palette.ink3 }]}>
                {secondary}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              {item.status === 'done' && item.publishState !== 'review' ? (
                <Ionicons name="checkmark" size={12} color={chip.fg} />
              ) : null}
              <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
            </View>
          </View>

          {item.status === 'active' || item.status === 'done' ? (
            <View style={{ marginTop: 14 }}>
              <StepTimeline item={item} palette={palette} />
            </View>
          ) : null}

          {item.status === 'active' ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={[styles.stepText, { color: palette.ink2 }]}>
                {item.stepLabel}
                {item.stepDetail && item.stepDetail !== item.stepLabel ? (
                  <Text style={{ color: palette.ink3 }}> · {item.stepDetail}</Text>
                ) : null}
              </Text>
              {imageShare != null ? <ProgressBar percent={imageShare} palette={palette} thin /> : null}
            </View>
          ) : null}

          {item.status === 'done' ? (
            <View style={styles.doneRow}>
              <Text style={[styles.doneMeta, { color: item.aiRewritten ? palette.goldInk : palette.ink3 }]}>
                {item.aiRewritten ? '✦ Opis napisany przez AI' : 'Opis z szablonu'}
                {item.imageCount != null ? `  ·  ${item.imageCount} zdjęć` : ''}
              </Text>
              {item.offerId || publicUrl ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    item.offerId ? onOpenOffer(item.offerId) : publicUrl ? void Linking.openURL(publicUrl).catch(() => undefined) : undefined
                  }
                  style={({ pressed }) => [styles.linkBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={[styles.linkText, { color: palette.ink }]}>Zobacz ofertę</Text>
                  <Ionicons name="open-outline" size={13} color={palette.ink} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {item.status === 'done' && item.publishState === 'review' && item.stepDetail ? (
            <Text style={[styles.note, { color: palette.goldInk }]}>{item.stepDetail}</Text>
          ) : null}
          {item.status === 'skipped' && item.reason ? (
            <Text
              style={[
                styles.note,
                { color: item.skipKind === 'error' || !item.skipKind ? palette.danger : palette.ink3 },
              ]}
            >
              {item.reason}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Szklana kapsuła nad paskiem kart — widoczna w całej aplikacji, gdy import trwa w tle. */
function KeiBackgroundPill({
  percent,
  title,
  subtitle,
  palette,
  onPress,
}: {
  percent: number;
  title: string;
  subtitle: string;
  palette: Palette;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(80)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.pillHost, { bottom: Math.max(insets.bottom, 10) + 62, transform: [{ translateY: slide }] }]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${percent} procent. Pokaż postęp.`}
        style={({ pressed }) => [styles.pillShadow, pressed && { transform: [{ scale: 0.985 }] }]}
      >
        <View style={[styles.pill, { borderColor: palette.line }]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={palette.isDark ? 50 : 70} tint={palette.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.isDark ? 'rgba(23,21,19,0.72)' : 'rgba(255,255,255,0.72)' }]} />
          <View style={styles.pillRing}>
            <ProgressRing percent={percent} palette={palette} />
            <Text style={[styles.pillPct, { color: palette.ink }]}>{percent}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.pillTitle, { color: palette.ink }]}>
              {title}
            </Text>
            <Text numberOfLines={1} style={[styles.pillSub, { color: palette.ink3 }]}>
              {subtitle}
            </Text>
          </View>
          <Ionicons name="chevron-up" size={16} color={palette.ink3} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Globalny host importu KEI — postęp żyje w store poza ekranem KEI.
 * Kapsuła jest widoczna w całej aplikacji, okno pokazuje każdą ofertę na żywo.
 */
export default function KeiImportProgressHost() {
  const insets = useSafeAreaInsets();
  const palette = useKeiPalette();
  const token = useAuthStore((s) => s.token);
  const getAdminToken = useAuthStore((s) => s.getAdminToken);
  const running = useKeiAmerExportStore((s) => s.running);
  const stopping = useKeiAmerExportStore((s) => s.stopping);
  const jobStatus = useKeiAmerExportStore((s) => s.jobStatus);
  const modalVisible = useKeiAmerExportStore((s) => s.modalVisible);
  const message = useKeiAmerExportStore((s) => s.message);
  const source = useKeiAmerExportStore((s) => s.source);
  const items = useKeiAmerExportStore((s) => s.items);
  const targetCount = useKeiAmerExportStore((s) => s.targetCount);
  const setModalVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const cancelExport = useKeiAmerExportStore((s) => s.cancelExport);
  const clearSession = useKeiAmerExportStore((s) => s.clearSession);
  const hydrateFromServer = useKeiAmerExportStore((s) => s.hydrateFromServer);

  const [showSkipped, setShowSkipped] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const offsets = useRef<Record<number, number>>({});

  const summary = useMemo(() => summarizeKeiJob({ items, running, source, targetCount }), [items, running, source, targetCount]);
  const active = items.find((item) => item.status === 'active');
  const eta = formatEta(summary.etaSeconds);

  useEffect(() => {
    const privileged = getAdminToken() || token;
    if (privileged) void hydrateFromServer(privileged);
  }, [token, getAdminToken, hydrateFromServer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') reconcileKeiExportAfterForeground();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!modalVisible || active?.index == null) return;
    const y = offsets.current[active.index];
    if (typeof y === 'number') scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  }, [modalVisible, active?.index]);

  const openSheet = useCallback(() => {
    void Haptics.selectionAsync();
    setModalVisible(true);
  }, [setModalVisible]);

  const closeSheet = useCallback(() => {
    setModalVisible(false);
    if (!running) clearSession();
  }, [running, setModalVisible, clearSession]);

  // Oferta otwiera się w aplikacji (ekran oferty), a nie w przeglądarce.
  const openOffer = useCallback(
    (offerId: number) => {
      setModalVisible(false);
      setTimeout(() => navigate('OfferDetail', { offerId: String(offerId) }), 350);
    },
    [setModalVisible],
  );

  const confirmStop = useCallback(() => {
    Alert.alert('Zatrzymać import?', 'Bieżąca oferta zostanie dokończona, kolejne nie wystartują. Gotowe oferty zostają.', [
      { text: 'Wróć', style: 'cancel' },
      { text: 'Zatrzymaj', style: 'destructive', onPress: () => cancelExport() },
    ]);
  }, [cancelExport]);

  const showPill = running && !modalVisible;
  const showModal = modalVisible && items.length > 0;
  if (!showPill && !showModal) return null;

  const visibleItems = items.filter((item) => showSkipped || item.status !== 'skipped' || item.skipKind === 'error');
  const hiddenSkipped = items.length - visibleItems.length;
  const title =
    jobStatus === 'error' ? 'Import zatrzymany błędem' : running ? (source === 'auto' ? 'Automatyczny import' : 'Import ofert') : 'Import zakończony';
  const doneItems = items.filter((item) => item.status === 'done');

  return (
    <>
      {showPill ? (
        <KeiBackgroundPill
          percent={summary.percent}
          palette={palette}
          title={`${stopping ? 'Zatrzymuję import' : title} · ${summary.headline.split(' · ')[0] || ''}`}
          subtitle={`${active?.stepLabel || 'Na serwerze'}${eta ? ` · ${eta}` : ''}`}
          onPress={openSheet}
        />
      ) : null}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={running ? () => setModalVisible(false) : closeSheet}>
        <View style={[styles.sheet, { backgroundColor: palette.bg }]}>
          <View style={[styles.header, { borderBottomColor: palette.line }]}>
            <View style={styles.headerTop}>
              <Text style={[styles.kicker, { color: palette.goldInk }]}>ESTATEOS · KEI</Text>
              <Pressable hitSlop={10} onPress={running ? () => setModalVisible(false) : closeSheet}>
                <Text style={[styles.headerAction, { color: palette.ink2 }]}>{running ? 'Zwiń' : 'Gotowe'}</Text>
              </Pressable>
            </View>
            <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>
            <Text style={[styles.headline, { color: palette.ink2 }]} accessibilityLiveRegion="polite">
              {items.length ? summary.headline : message}
              {running && eta ? <Text style={{ color: palette.ink3 }}> · zostało {eta}</Text> : null}
            </Text>
            <View style={styles.overallRow}>
              <View style={{ flex: 1 }}>
                <ProgressBar percent={summary.percent} done={!running && jobStatus === 'done'} palette={palette} />
              </View>
              <Text style={[styles.overallPct, { color: palette.ink }]}>{summary.percent}%</Text>
            </View>
            {stopping ? (
              <Text style={[styles.stopping, { color: palette.warn }]}>
                Zatrzymuję — bieżąca oferta zostanie dokończona.
              </Text>
            ) : null}
          </View>

          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110, gap: 12 }}>
            {!running && doneItems.length > 0 ? (
              <View style={[styles.summary, { backgroundColor: palette.card, borderColor: palette.line }]}>
                <View style={styles.summaryThumbs}>
                  {doneItems
                    .map((item) => item.thumbUrl)
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((uri, idx) => (
                      <Image
                        key={`${uri}-${idx}`}
                        source={{ uri: uri as string }}
                        style={[styles.summaryThumb, { borderColor: palette.card, marginLeft: idx ? -12 : 0 }]}
                      />
                    ))}
                </View>
                <Text style={[styles.summaryTitle, { color: palette.ink }]}>
                  {doneItems.length === 1 ? 'Nowa oferta jest gotowa' : `${doneItems.length} nowe oferty są gotowe`}
                </Text>
                <Text style={[styles.summaryText, { color: palette.ink3 }]}>
                  Każdą możesz od razu otworzyć lub poprawić w edycji oferty.
                </Text>
              </View>
            ) : null}
            {visibleItems.map((item) => (
              <View
                key={`${item.portalUrl}-${item.index}`}
                onLayout={(event) => {
                  offsets.current[item.index] = event.nativeEvent.layout.y;
                }}
              >
                <ItemCard item={item} palette={palette} highlight={item.index === active?.index} onOpenOffer={openOffer} />
              </View>
            ))}
            {hiddenSkipped > 0 ? (
              <Pressable onPress={() => setShowSkipped((value) => !value)} style={styles.toggleSkipped} hitSlop={6}>
                <Text style={[styles.toggleSkippedText, { color: palette.ink2 }]}>
                  {showSkipped ? 'Ukryj pominięte' : `Pokaż pominięte (${hiddenSkipped}) — duplikaty i nieaktualne`}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          {running ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: palette.line, backgroundColor: palette.bg, paddingBottom: insets.bottom + 14 },
              ]}
            >
              <Text style={[styles.footerHint, { color: palette.ink3 }]}>
                Import działa na serwerze — telefon możesz zablokować.
              </Text>
              <Pressable
                disabled={stopping}
                onPress={confirmStop}
                style={({ pressed }) => [
                  styles.stopBtn,
                  { borderColor: palette.line, backgroundColor: palette.card, opacity: stopping ? 0.45 : pressed ? 0.75 : 1 },
                ]}
              >
                <Text style={[styles.stopText, { color: palette.ink }]}>Zatrzymaj</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  track: { height: 4, borderRadius: 99, overflow: 'hidden' },
  trackThin: { height: 3 },
  fill: { height: '100%', borderRadius: 99 },
  steps: { flexDirection: 'row' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepLine: { position: 'absolute', top: 5, right: '50%', left: '-50%', height: StyleSheet.hairlineWidth * 2, marginHorizontal: 8 },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dotRing: { position: 'absolute', width: 21, height: 21, borderRadius: 11, borderWidth: 1 },
  stepLabel: { fontSize: 10.5, maxWidth: '100%' },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, padding: 14 },
  cardRow: { flexDirection: 'row', gap: 13 },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { fontSize: 14.5, fontWeight: '600', lineHeight: 19 },
  cardFacts: { fontSize: 12.5, marginTop: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 9, height: 24 },
  chipText: { fontSize: 11.5, fontWeight: '600' },
  stepText: { fontSize: 12.5 },
  doneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  doneMeta: { fontSize: 12.5, flexShrink: 1 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkText: { fontSize: 12.5, fontWeight: '600' },
  note: { fontSize: 12.5, marginTop: 8, lineHeight: 17 },
  pillHost: { position: 'absolute', left: 16, right: 16, zIndex: 80, elevation: 80 },
  pillShadow: {
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 16,
    overflow: 'hidden',
  },
  pillRing: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pillPct: { position: 'absolute', fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillTitle: { fontSize: 13.5, fontWeight: '600' },
  pillSub: { fontSize: 12, marginTop: 1 },
  sheet: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontSize: 10.5, fontWeight: '700', letterSpacing: 1.6 },
  headerAction: { fontSize: 15, fontWeight: '600' },
  title: { fontFamily: LUX_SERIF, fontSize: 27, marginTop: 8 },
  headline: { fontSize: 13.5, marginTop: 6, lineHeight: 19 },
  overallRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  overallPct: { width: 46, textAlign: 'right', fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  stopping: { fontSize: 12.5, marginTop: 10 },
  summary: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, padding: 18 },
  summaryThumbs: { flexDirection: 'row', marginBottom: 12 },
  summaryThumb: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  summaryTitle: { fontFamily: LUX_SERIF, fontSize: 19 },
  summaryText: { fontSize: 12.5, marginTop: 4 },
  toggleSkipped: { alignItems: 'center', paddingVertical: 12 },
  toggleSkippedText: { fontSize: 13, fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerHint: { flex: 1, fontSize: 12 },
  stopBtn: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 18, height: 40, justifyContent: 'center' },
  stopText: { fontSize: 14, fontWeight: '600' },
});
