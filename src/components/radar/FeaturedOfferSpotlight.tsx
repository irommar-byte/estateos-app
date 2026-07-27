import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { GalleryOffer } from './RadarOfferGallery';
import { formatLocationLabel } from '../../constants/locationEcosystem';

type Props = {
  offers: GalleryOffer[];
  isDark: boolean;
  title: string;
  lead: string;
  badgeLabel: string;
  formatPrice: (raw: Record<string, unknown>) => { primary: string };
  onPressOffer: (offer: GalleryOffer) => void;
  /** Auto-rotacja + wibracja tylko gdy sekcja jest widoczna na ekranie (np. nie przewinięta). */
  autoRotateEnabled?: boolean;
  /**
   * Zewnętrzny margines shella. Homes: 16 (pełna szerokość list).
   * Cars: 0 gdy parent już ma paddingHorizontal — inaczej wyróżnione jest za wąskie.
   */
  horizontalMargin?: number;
};

const ROTATE_MS = 20_000;
const PAGE_SIZE = 2;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out.length ? out : [[]];
}

type SpotlightCardProps = {
  item: GalleryOffer;
  width: number;
  isDark: boolean;
  badgeLabel: string;
  formatPrice: (raw: Record<string, unknown>) => { primary: string };
  onPressOffer: (offer: GalleryOffer) => void;
  enterDelay: number;
  pageKey: number;
};

function SpotlightCard({
  item,
  width,
  isDark,
  badgeLabel,
  formatPrice,
  onPressOffer,
  enterDelay,
  pageKey,
}: SpotlightCardProps) {
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    cardOpacity.setValue(0);
    cardScale.setValue(0.94);
    cardTranslateY.setValue(18);
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 420,
        delay: enterDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 5,
        tension: 168,
        delay: enterDelay,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 140,
        delay: enterDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pageKey, enterDelay, cardOpacity, cardScale, cardTranslateY]);

  const typeOnly = String(item.type || '').split('•')[0].trim();
  const location = formatLocationLabel(item.raw?.city, item.raw?.district, '');
  const subtitle = [typeOnly, location].filter(Boolean).join(' · ');

  return (
    <Animated.View
      style={{
        width,
        opacity: cardOpacity,
        transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
      }}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPressOffer(item);
        }}
        style={({ pressed }) => [
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={styles.imageWrap}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]}>
              <Ionicons name="home-outline" size={24} color="#94A3B8" />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.imageFade} />
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={10} color="#000" />
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text style={[styles.cardTitle, { color: isDark ? '#FFF' : '#0F172A' }]} numberOfLines={2}>
            {String(item.raw?.title || subtitle)}
          </Text>
          {subtitle ? (
            <Text style={[styles.cardSub, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          <Text style={styles.cardPrice}>{formatPrice(item.raw).primary}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function FeaturedOfferSpotlight({
  offers,
  isDark,
  title,
  lead,
  badgeLabel,
  formatPrice,
  onPressOffer,
  autoRotateEnabled = true,
  horizontalMargin = 16,
}: Props) {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(() => AppState.currentState === 'active');
  const canAutoRotate = autoRotateEnabled && isFocused && appActive;

  const { width: windowWidth } = useWindowDimensions();
  const pages = useMemo(() => chunk(offers, PAGE_SIZE), [offers]);
  const [page, setPage] = useState(0);
  const pageRef = useRef(0);
  const transitioningRef = useRef(false);
  const [gridWidth, setGridWidth] = useState(0);
  const GRID_GAP = 12;
  const cardWidth = useMemo(() => {
    const usable = gridWidth > 0 ? gridWidth : Math.max(0, windowWidth - 72);
    return Math.max(120, (usable - GRID_GAP) / 2);
  }, [gridWidth, windowWidth]);

  const gridOpacity = useRef(new Animated.Value(1)).current;
  const gridTranslateY = useRef(new Animated.Value(0)).current;
  const gridScale = useRef(new Animated.Value(1)).current;
  const gridRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.45)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    setPage(0);
    pageRef.current = 0;
  }, [offers.length]);

  const runEnterAnimation = useCallback(() => {
    gridOpacity.setValue(0);
    gridTranslateY.setValue(20);
    gridScale.setValue(0.96);
    gridRotate.setValue(-1);

    Animated.parallel([
      Animated.spring(gridOpacity, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(gridTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 132,
        useNativeDriver: true,
      }),
      Animated.spring(gridScale, {
        toValue: 1,
        friction: 5,
        tension: 176,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(gridRotate, {
          toValue: 1,
          friction: 4,
          tension: 210,
          useNativeDriver: true,
        }),
        Animated.spring(gridRotate, {
          toValue: 0,
          friction: 5,
          tension: 138,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.45,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      transitioningRef.current = false;
    });
  }, [glowPulse, gridOpacity, gridRotate, gridScale, gridTranslateY]);

  const goToPage = useCallback(
    (nextPage: number, options?: { haptic?: boolean }) => {
      if (pages.length <= 1) {
        setPage(nextPage);
        return;
      }
      const normalized = ((nextPage % pages.length) + pages.length) % pages.length;
      if (transitioningRef.current || normalized === pageRef.current) return;

      transitioningRef.current = true;
      if (options?.haptic) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      progressAnimRef.current?.stop();
      progress.setValue(0);

      Animated.parallel([
        Animated.timing(gridOpacity, {
          toValue: 0,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(gridTranslateY, {
          toValue: -14,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(gridScale, {
          toValue: 0.94,
          duration: 280,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          transitioningRef.current = false;
          return;
        }
        setPage(normalized);
        pageRef.current = normalized;
        runEnterAnimation();
      });
    },
    [gridOpacity, gridScale, gridTranslateY, pages.length, progress, runEnterAnimation],
  );

  const startProgress = useCallback(() => {
    progressAnimRef.current?.stop();
    progress.setValue(0);
    if (pages.length <= 1) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: ROTATE_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnimRef.current = anim;
    anim.start();
  }, [pages.length, progress]);

  useEffect(() => {
    if (!canAutoRotate || pages.length <= 1) return;
    const timer = setInterval(() => {
      goToPage(pageRef.current + 1, { haptic: true });
    }, ROTATE_MS);
    return () => {
      clearInterval(timer);
      progressAnimRef.current?.stop();
    };
  }, [canAutoRotate, goToPage, pages.length]);

  useEffect(() => {
    if (!canAutoRotate) {
      progressAnimRef.current?.stop();
      return;
    }
    startProgress();
    return () => progressAnimRef.current?.stop();
  }, [canAutoRotate, page, pages.length, startProgress]);

  if (!offers.length) return null;

  const current = pages[page] ?? [];
  // Lekki ruch bez dużego rotate — obrót wycinał karty przy overflow:hidden.
  const rotateZ = gridRotate.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: ['0deg', '-0.6deg', '0.5deg'],
  });
  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.shell, { marginHorizontal: horizontalMargin }, isDark ? styles.shellDark : styles.shellLight]}>
      <LinearGradient
        colors={
          isDark
            ? ['rgba(251,191,36,0.18)', 'rgba(16,185,129,0.08)', 'transparent']
            : ['rgba(251,191,36,0.14)', 'rgba(16,185,129,0.06)', 'transparent']
        }
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glowPulse }]}
      >
        <LinearGradient
          colors={['rgba(251,191,36,0.35)', 'rgba(245,158,11,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="ribbon" size={14} color="#FBBF24" />
            <Text style={[styles.title, { color: isDark ? '#FDE68A' : '#B45309' }]}>{title}</Text>
          </View>
          <Text style={[styles.lead, { color: isDark ? 'rgba(255,255,255,0.62)' : '#64748B' }]}>{lead}</Text>
          {pages.length > 1 ? (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
          ) : null}
        </View>
        {pages.length > 1 ? (
          <View style={styles.dots}>
            {pages.map((_, idx) => (
              <Pressable
                key={idx}
                accessibilityRole="button"
                onPress={() => {
                  goToPage(idx, { haptic: true });
                }}
                style={[styles.dot, idx === page ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <Animated.View
        onLayout={(event) => {
          const next = Math.floor(event.nativeEvent.layout.width);
          if (next > 0 && next !== gridWidth) setGridWidth(next);
        }}
        style={[
          styles.grid,
          {
            opacity: gridOpacity,
            transform: [{ translateY: gridTranslateY }, { scale: gridScale }, { rotateZ }],
          },
        ]}
      >
        {current.map((item, index) => (
          <SpotlightCard
            key={`spotlight-${item.id}-${page}`}
            item={item}
            width={cardWidth}
            isDark={isDark}
            badgeLabel={badgeLabel}
            formatPrice={formatPrice}
            onPressOffer={onPressOffer}
            enterDelay={index * 90}
            pageKey={page}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    overflow: 'hidden',
    gap: 12,
  },
  shellDark: {
    borderColor: 'rgba(251,191,36,0.22)',
    backgroundColor: 'rgba(28,25,23,0.92)',
  },
  shellLight: {
    borderColor: 'rgba(251,191,36,0.22)',
    backgroundColor: '#FFFCF5',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  lead: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  progressTrack: {
    marginTop: 10,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FBBF24',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  dotIdle: {
    width: 6,
    backgroundColor: 'rgba(148,163,184,0.45)',
  },
  dotActive: {
    width: 22,
    backgroundColor: '#FBBF24',
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    overflow: 'hidden',
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardDark: {
    borderColor: 'rgba(251,191,36,0.18)',
    backgroundColor: 'rgba(15,23,42,0.72)',
  },
  cardLight: {
    borderColor: 'rgba(15,23,42,0.06)',
    backgroundColor: '#FFFFFF',
  },
  imageWrap: {
    position: 'relative',
    aspectRatio: 16 / 10,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FBBF24',
  },
  badgeText: {
    color: '#000',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardPrice: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: -0.3,
  },
});
