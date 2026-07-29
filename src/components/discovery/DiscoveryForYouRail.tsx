import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { ArrowRight, Brain } from 'lucide-react-native';
import OfferDiscoveryActions from './OfferDiscoveryActions';
import { subscribeDiscoveryUpdated } from '../../lib/discovery/clientEvents';
import { fetchDiscoveryForYou, type ForYouRailItem } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { useI18n } from '../../i18n';

type Props = {
  navigation: any;
  transactionMode?: 'all' | 'sale' | 'rent';
  formatPrice?: (item: ForYouRailItem) => string;
  isDark?: boolean;
};

const POLL_MS = 45_000;
const CARD_WIDTH = 272;
const CARD_GAP = 12;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const CARD_IMAGE_HEIGHT = 152;
const CARD_BODY_HEIGHT = 132;
const CARD_HEIGHT = CARD_IMAGE_HEIGHT + CARD_BODY_HEIGHT;
const MAX_RAIL_ITEMS = 36;
const INITIAL_LIMIT = 12;
const REFRESH_LIMIT = 24;

const SIRI_RAINBOW = [
  '#FF375F',
  '#FF9F0A',
  '#FFD60A',
  '#30D158',
  '#64D2FF',
  '#BF5AF2',
  '#FF375F',
] as const;

function SiriRainbowOrb({
  size,
  style,
  rotate,
  opacity,
  scale,
  translateX,
  translateY,
  isDark,
}: {
  size: number;
  style?: object;
  rotate: Animated.AnimatedInterpolation<string>;
  opacity: Animated.AnimatedInterpolation<number>;
  scale: Animated.AnimatedInterpolation<number>;
  translateX: Animated.AnimatedInterpolation<number>;
  translateY: Animated.AnimatedInterpolation<number>;
  isDark: boolean;
}) {
  const bleed = size * 0.42;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
          shadowColor: isDark ? '#64D2FF' : '#BF5AF2',
          shadowOpacity: isDark ? 0.28 : 0.16,
          shadowRadius: size * 0.28,
          shadowOffset: { width: 0, height: 6 },
          elevation: 0,
        },
      ]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Animated.View
          style={{
            width: size + bleed * 2,
            height: size + bleed * 2,
            marginLeft: -bleed,
            marginTop: -bleed,
            transform: [{ rotate }],
          }}
        >
          <LinearGradient
            colors={[...SIRI_RAINBOW]}
            start={{ x: 0, y: 0.15 }}
            end={{ x: 1, y: 0.85 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <LinearGradient
          colors={['rgba(255,255,255,0.38)', 'transparent', 'rgba(0,0,0,0.18)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </Animated.View>
  );
}

function IntelligenceRailShell({
  children,
  glowOpacity,
  siriRotateA,
  siriRotateB,
  orbMotionA,
  orbMotionB,
  shellLift,
  shimmerX,
  isDark,
}: {
  children: React.ReactNode;
  glowOpacity: Animated.AnimatedInterpolation<number>;
  siriRotateA: Animated.AnimatedInterpolation<string>;
  siriRotateB: Animated.AnimatedInterpolation<string>;
  orbMotionA: {
    scale: Animated.AnimatedInterpolation<number>;
    translateX: Animated.AnimatedInterpolation<number>;
    translateY: Animated.AnimatedInterpolation<number>;
  };
  orbMotionB: {
    scale: Animated.AnimatedInterpolation<number>;
    translateX: Animated.AnimatedInterpolation<number>;
    translateY: Animated.AnimatedInterpolation<number>;
  };
  shellLift: Animated.AnimatedInterpolation<number>;
  shimmerX: Animated.AnimatedInterpolation<number>;
  isDark: boolean;
}) {
  return (
    <Animated.View
      style={[
        styles.shellStage,
        isDark ? styles.shellStageDark : styles.shellStageLight,
        { transform: [{ translateY: shellLift }] },
      ]}
    >
      <View style={[styles.rainbowFrame, isDark ? styles.rainbowFrameDark : styles.rainbowFrameLight]}>
        <LinearGradient
          colors={[...SIRI_RAINBOW]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.borderShimmer, { transform: [{ translateX: shimmerX }] }]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.borderShimmerBar}
          />
        </Animated.View>
        <View style={[styles.rainbowInner, isDark ? styles.rainbowInnerDark : styles.rainbowInnerLight]}>
          <LinearGradient
            pointerEvents="none"
            colors={
              isDark
                ? ['rgba(255,255,255,0.1)', 'transparent', 'rgba(0,0,0,0.16)']
                : ['rgba(255,255,255,0.65)', 'transparent', 'rgba(15,23,42,0.04)']
            }
            locations={[0, 0.5, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.innerShade}
          />
          <SiriRainbowOrb
            size={168}
            style={styles.siriOrbPrimary}
            rotate={siriRotateA}
            opacity={glowOpacity}
            scale={orbMotionA.scale}
            translateX={orbMotionA.translateX}
            translateY={orbMotionA.translateY}
            isDark={isDark}
          />
          <SiriRainbowOrb
            size={118}
            style={styles.siriOrbSecondary}
            rotate={siriRotateB}
            opacity={glowOpacity}
            scale={orbMotionB.scale}
            translateX={orbMotionB.translateX}
            translateY={orbMotionB.translateY}
            isDark={isDark}
          />
          <View style={styles.shellContent}>{children}</View>
        </View>
      </View>
    </Animated.View>
  );
}

function defaultFormatPrice(item: ForYouRailItem): string {
  const amount = item.pricePln ?? item.price;
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${Math.round(amount).toLocaleString('pl-PL')} zł`;
}

function mergeForYouItems(prev: ForYouRailItem[], incoming: ForYouRailItem[]): ForYouRailItem[] {
  if (!incoming.length) return prev;
  const seen = new Set(prev.map((item) => item.offerId));
  const merged = [...prev];
  for (const item of incoming) {
    if (seen.has(item.offerId)) continue;
    seen.add(item.offerId);
    merged.push(item);
  }
  return merged.slice(0, MAX_RAIL_ITEMS);
}

/**
 * Living Intelligence rail for the signed-in client profile — brain-led, not sparkles.
 */
export default function DiscoveryForYouRail({
  navigation,
  transactionMode = 'all',
  formatPrice = defaultFormatPrice,
  isDark = true,
}: Props) {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const isFocused = useIsFocused();
  const [items, setItems] = useState<ForYouRailItem[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [auth, setAuth] = useState<'unknown' | 'guest' | 'user'>('unknown');
  const [loading, setLoading] = useState(true);
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');
  const livePulse = useRef(new Animated.Value(0)).current;
  const siriSpin = useRef(new Animated.Value(0)).current;
  const orbDriftA = useRef(new Animated.Value(0)).current;
  const orbDriftB = useRef(new Animated.Value(0)).current;
  const shellFloat = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollIndexRef = useRef(0);
  const loadingRef = useRef(false);
  const itemsRef = useRef<ForYouRailItem[]>([]);
  itemsRef.current = items;

  const tx = useMemo(
    () => (transactionMode === 'sale' ? 'SALE' : transactionMode === 'rent' ? 'RENT' : '') as
      | 'SALE'
      | 'RENT'
      | '',
    [transactionMode],
  );

  const canLiveUpdate = isFocused && appActive && Boolean(token) && enabled && hydrated;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [livePulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(siriSpin, {
        toValue: 1,
        duration: 14_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [siriSpin]);

  useEffect(() => {
    const breathe = (val: Animated.Value, duration: number, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

    const loopA = breathe(orbDriftA, 3600);
    const loopB = breathe(orbDriftB, 4200, 700);
    const floatLoop = breathe(shellFloat, 5200, 200);
    loopA.start();
    loopB.start();
    floatLoop.start();
    return () => {
      loopA.stop();
      loopB.stop();
      floatLoop.stop();
    };
  }, [orbDriftA, orbDriftB, shellFloat]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  const load = useCallback(
    async (opts?: { append?: boolean; limit?: number }) => {
      if (!token) {
        setAuth('guest');
        setItems([]);
        setReady(false);
        setLoadError(false);
        setLoading(false);
        return;
      }
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const limit = opts?.limit ?? (opts?.append ? REFRESH_LIMIT : INITIAL_LIMIT);
        const data = await fetchDiscoveryForYou(token, { limit, transaction: tx });
        if (data.auth === 'guest') {
          setAuth('guest');
          setItems([]);
          setReady(false);
          setLoadError(false);
          return;
        }
        setAuth('user');
        if (data.error) {
          setLoadError(true);
          if (!opts?.append) setItems([]);
          return;
        }
        setLoadError(false);
        setReady(Boolean(data.profile?.ready));
        const incoming = Array.isArray(data.items) ? data.items : [];
        if (opts?.append) {
          setItems((prev) => mergeForYouItems(prev, incoming));
        } else {
          setItems(incoming);
          scrollIndexRef.current = 0;
          scrollRef.current?.scrollTo({ x: 0, animated: false });
        }
      } catch {
        setLoadError(true);
        if (!opts?.append) setItems([]);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [token, tx],
  );

  useEffect(() => {
    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => unsub();
  }, [load]);

  useEffect(() => {
    if (!canLiveUpdate || auth !== 'user' || !ready) return;
    const id = setInterval(() => {
      void load({ append: true, limit: REFRESH_LIMIT });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [auth, canLiveUpdate, load, ready]);

  useEffect(() => {
    scrollIndexRef.current = 0;
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [tx]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const index = Math.max(0, Math.round(x / CARD_STEP));
      scrollIndexRef.current = index;
      if (index >= itemsRef.current.length - 2 && itemsRef.current.length < MAX_RAIL_ITEMS) {
        void load({ append: true, limit: REFRESH_LIMIT });
      }
    },
    [load],
  );

  const glowOpacity = livePulse.interpolate({
    inputRange: [0, 1],
    outputRange: isDark ? [0.2, 0.42] : [0.12, 0.28],
  });
  const brainGlow = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const siriRotateA = siriSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const siriRotateB = siriSpin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const shellLift = shellFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-140, 360] });
  const orbMotionA = useMemo(
    () => ({
      scale: orbDriftA.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }),
      translateX: orbDriftA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-8, 6, -4] }),
      translateY: orbDriftA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-6, 4, 8] }),
    }),
    [orbDriftA],
  );
  const orbMotionB = useMemo(
    () => ({
      scale: orbDriftB.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1.14] }),
      translateX: orbDriftB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [5, -7, 4] }),
      translateY: orbDriftB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [6, -3, -5] }),
    }),
    [orbDriftB],
  );
  const shellProps = useMemo(
    () => ({
      glowOpacity,
      siriRotateA,
      siriRotateB,
      orbMotionA,
      orbMotionB,
      shellLift,
      shimmerX,
      isDark,
    }),
    [glowOpacity, isDark, orbMotionA, orbMotionB, shellLift, shimmerX, siriRotateA, siriRotateB],
  );

  if (!hydrated || !enabled) return null;
  if (auth === 'guest' || auth === 'unknown') return null;
  if (loading) return null;

  const theme = isDark ? darkTheme : lightTheme;

  const eyebrow = (
    <View style={styles.eyebrowRow}>
      <Animated.View style={[styles.brainBadge, theme.brainBadge, { opacity: brainGlow }]}>
        <Brain size={13} color={theme.accent} strokeWidth={2.2} />
      </Animated.View>
      <Text style={[styles.eyebrow, { color: theme.accent }]}>{t('discovery.brand')}</Text>
      <View style={styles.liveDotWrap}>
        <Animated.View style={[styles.liveDotPulse, theme.liveDotPulse, { opacity: glowOpacity }]} />
        <View style={[styles.liveDot, theme.liveDot]} />
      </View>
      <Text style={[styles.liveLabel, { color: theme.muted }]}>{t('discovery.forYou.liveLabel')}</Text>
    </View>
  );

  if (loadError && items.length === 0) {
    return (
      <View style={styles.section}>
        <IntelligenceRailShell {...shellProps}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {eyebrow}
              <Text style={[styles.h2, { color: theme.title }]}>{t('discovery.forYou.title')}</Text>
            </View>
          </View>
          <View style={[styles.emptyReadyCard, theme.card]}>
            <Text style={[styles.emptyReadyTitle, { color: theme.title }]}>
              {t('discovery.forYou.loadErrorTitle')}
            </Text>
            <Text style={[styles.emptyReadyBody, { color: theme.body }]}>
              {t('discovery.forYou.loadErrorBody')}
            </Text>
            <Pressable
              style={[styles.directionChip, theme.chip, { marginHorizontal: 0, marginTop: 8 }]}
              onPress={() => void load()}
            >
              <Text style={[styles.directionChipText, { color: theme.accent }]}>
                {t('discovery.forYou.retry')}
              </Text>
              <ArrowRight size={14} color={theme.accent} />
            </Pressable>
          </View>
        </IntelligenceRailShell>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.section}>
        <IntelligenceRailShell {...shellProps}>
          <View style={styles.coldCopy}>
            {eyebrow}
            <Text style={[styles.h2, { color: theme.title }]}>{t('discovery.forYou.title')}</Text>
            <Text style={[styles.coldBody, { color: theme.body }]}>{t('discovery.forYou.coldBody')}</Text>
          </View>
          <Pressable
            style={[styles.directionChip, theme.chip]}
            onPress={() => navigation?.navigate?.('DiscoveryDirection')}
          >
            <Text style={[styles.directionChipText, { color: theme.accent }]}>{t('discovery.forYou.myDirection')}</Text>
            <ArrowRight size={14} color={theme.accent} />
          </Pressable>
        </IntelligenceRailShell>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.section}>
        <IntelligenceRailShell {...shellProps}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {eyebrow}
              <Text style={[styles.h2, { color: theme.title }]}>{t('discovery.forYou.title')}</Text>
            </View>
            <Pressable
              style={styles.linkRow}
              onPress={() => navigation?.navigate?.('DiscoveryDirection')}
            >
              <Text style={[styles.link, { color: theme.link }]}>{t('discovery.forYou.myDirection')}</Text>
              <ArrowRight size={13} color={theme.link} />
            </Pressable>
          </View>
          <View style={[styles.emptyReadyCard, theme.card]}>
            <Text style={[styles.emptyReadyTitle, { color: theme.title }]}>
              {t('discovery.forYou.emptyReadyTitle')}
            </Text>
            <Text style={[styles.emptyReadyBody, { color: theme.body }]}>
              {t('discovery.forYou.emptyReadyBody')}
            </Text>
            <Pressable
              style={[styles.directionChip, theme.chip, { marginHorizontal: 0, marginTop: 8 }]}
              onPress={() => navigation?.navigate?.('DiscoveryDirection')}
            >
              <Text style={[styles.directionChipText, { color: theme.accent }]}>
                {t('discovery.forYou.myDirection')}
              </Text>
              <ArrowRight size={14} color={theme.accent} />
            </Pressable>
          </View>
        </IntelligenceRailShell>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <IntelligenceRailShell {...shellProps}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow}
            <Text style={[styles.h2, { color: theme.title }]}>{t('discovery.forYou.title')}</Text>
          </View>
          <Pressable
            style={styles.linkRow}
            onPress={() => navigation?.navigate?.('DiscoveryDirection')}
          >
            <Text style={[styles.link, { color: theme.link }]}>{t('discovery.forYou.myDirection')}</Text>
            <ArrowRight size={13} color={theme.link} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_STEP}
          snapToAlignment="start"
          contentContainerStyle={styles.rail}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
        >
          {items.map((item) => (
            <View key={item.offerId} style={[styles.cardLift, theme.cardLift]}>
              <Pressable
                style={[styles.card, theme.card]}
                onPress={() =>
                  navigation?.navigate?.('OfferDetail', { offerId: Number(item.offerId) })
                }
              >
                <View style={[styles.imageWrap, theme.imageWrap]}>
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.image}
                      contentFit="cover"
                      transition={180}
                    />
                  ) : (
                    <View style={[styles.image, theme.imageFallback]} />
                  )}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['transparent', 'rgba(0,0,0,0.28)']}
                    style={styles.imageShade}
                  />
                  <View style={styles.actionsOverlay} pointerEvents="box-none">
                    <OfferDiscoveryActions
                      offerId={item.offerId}
                      variant="compact"
                      source="mobile_catalog_for_you"
                      promptDislikeViaBrain
                      onRequireAuth={() => navigation?.navigate?.('Login')}
                    />
                  </View>
                </View>
                <View style={[styles.cardBody, theme.cardBody]}>
                  <Text style={[styles.meta, { color: theme.meta }]} numberOfLines={1}>
                    {[item.city, item.district].filter(Boolean).join(' · ') || 'Polska'}
                    {item.area > 0 ? ` · ${Math.round(item.area)} m²` : ''}
                  </Text>
                  <Text style={[styles.title, { color: theme.title }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={[styles.price, { color: theme.title }]}>{formatPrice(item)}</Text>
                  <Text style={[styles.reason, { color: theme.body }]} numberOfLines={2}>
                    {item.reason ? (
                      <>
                        <Text style={[styles.reasonLead, { color: theme.accent }]}>
                          Intelligence ·{' '}
                        </Text>
                        {item.reason}
                      </>
                    ) : (
                      t('discovery.forYou.matchHint')
                    )}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </IntelligenceRailShell>
    </View>
  );
}

const darkTheme = {
  accent: '#7DD3FC',
  title: '#FFFFFF',
  body: 'rgba(255,255,255,0.55)',
  muted: 'rgba(186,230,253,0.55)',
  link: 'rgba(186,230,253,0.7)',
  meta: 'rgba(186,230,253,0.55)',
  brainBadge: {
    backgroundColor: 'rgba(56,189,248,0.16)',
    borderColor: 'rgba(125,211,252,0.45)',
  },
  liveDotPulse: { backgroundColor: 'rgba(56,189,248,0.45)' },
  liveDot: { backgroundColor: '#38BDF8' },
  chip: {
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(56,189,248,0.1)',
  },
  card: {
    borderColor: 'rgba(56,189,248,0.2)',
    backgroundColor: 'rgba(12,16,24,0.98)',
  },
  cardLift: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  cardBody: {
    backgroundColor: 'rgba(10,14,22,0.96)',
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  imageWrap: { backgroundColor: 'rgba(0,0,0,0.35)' },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.06)' },
} as const;

const lightTheme = {
  accent: '#0284C7',
  title: '#0F172A',
  body: 'rgba(15,23,42,0.58)',
  muted: 'rgba(2,132,199,0.62)',
  link: 'rgba(2,132,199,0.78)',
  meta: 'rgba(71,85,105,0.78)',
  brainBadge: {
    backgroundColor: 'rgba(14,165,233,0.14)',
    borderColor: 'rgba(14,165,233,0.35)',
  },
  liveDotPulse: { backgroundColor: 'rgba(14,165,233,0.35)' },
  liveDot: { backgroundColor: '#0EA5E9' },
  chip: {
    borderColor: 'rgba(14,165,233,0.28)',
    backgroundColor: 'rgba(14,165,233,0.1)',
  },
  card: {
    borderColor: 'rgba(14,165,233,0.16)',
    backgroundColor: '#FFFFFF',
  },
  cardLift: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardBody: {
    backgroundColor: '#FFFFFF',
    borderTopColor: 'rgba(15,23,42,0.05)',
  },
  imageWrap: { backgroundColor: 'rgba(148,163,184,0.18)' },
  imageFallback: { backgroundColor: 'rgba(15,23,42,0.06)' },
} as const;

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 14 },
  shellStage: {
    borderRadius: 30,
    backgroundColor: 'transparent',
  },
  shellStageDark: {
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  shellStageLight: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  rainbowFrame: {
    borderRadius: 29,
    padding: 2,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  rainbowFrameDark: {},
  rainbowFrameLight: {},
  borderShimmer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
  },
  borderShimmerBar: {
    width: 72,
    height: '140%',
  },
  rainbowInner: {
    borderRadius: 27,
    overflow: 'hidden',
  },
  rainbowInnerDark: {
    backgroundColor: 'rgba(6,12,22,0.94)',
  },
  rainbowInnerLight: {
    backgroundColor: 'rgba(248,250,252,0.97)',
  },
  innerShade: {
    ...StyleSheet.absoluteFillObject,
  },
  shellContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
  },
  siriOrbPrimary: {
    position: 'absolute',
    top: -58,
    right: -40,
  },
  siriOrbSecondary: {
    position: 'absolute',
    bottom: -44,
    left: -32,
  },
  coldCopy: { gap: 6, paddingHorizontal: 4, marginBottom: 12 },
  coldBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  directionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  directionChipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  brainBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  liveDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  liveLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  h2: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontSize: 12, fontWeight: '700' },
  rail: {
    gap: CARD_GAP,
    paddingRight: 6,
    paddingBottom: 10,
    paddingTop: 4,
    alignItems: 'stretch',
  },
  cardLift: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    overflow: 'hidden',
  },
  imageShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
  },
  image: { width: '100%', height: '100%' },
  actionsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    zIndex: 3,
  },
  cardBody: {
    height: CARD_BODY_HEIGHT,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-start',
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    minHeight: 40,
  },
  price: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reason: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
  },
  reasonLead: { fontWeight: '700' },
  emptyReadyCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginHorizontal: 4,
  },
  emptyReadyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyReadyBody: {
    fontSize: 12,
    lineHeight: 18,
  },
});
