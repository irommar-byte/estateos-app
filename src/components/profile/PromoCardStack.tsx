import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';
import {
  getCouponPurposeStripVisual,
  getCouponSurfaceStyle,
  getCouponUsedPurposeStripVisual,
} from '../../utils/profilePromoCouponUi';
import type { ProfilePromoCouponPurpose } from '../../contracts/profilePromoContract';
import BirthdayCouponBackdrop from './BirthdayCouponBackdrop';
import { safeIoniconName } from '../../utils/safeIoniconName';

const PURPOSE_STRIP_H = 26;
const PURPOSE_STRIP_H_COMPACT = 22;
const SWIPE_OUT = 280;
const SWIPE_THRESHOLD = 64;
const DEFAULT_SLOT_H = 118;
const DEFAULT_SLOT_H_COMPACT = 94;
/** Odsunięcie dolnej karty — widać „drugi kupon” pod spodem. */
const DECK_PEEK_Y = 12;
const DECK_PEEK_Y_COMPACT = 8;
const DECK_BACK_SCALE_REST = 0.98;
/** Miejsce na cień karty + dolną warstwę stosu — podpowiedzi są poniżej. */
const DECK_SHADOW_PAD = 28;
const DECK_SHADOW_PAD_COMPACT = 24;
const HINTS_GAP = 14;
const HINTS_GAP_COMPACT = 12;
/** Stała wysokość bloku tekstu — karty w talii mają ten sam rozmiar okna. */
const SUBTITLE_SLOT_H = 38;
const SUBTITLE_SLOT_H_COMPACT = 28;
const META_SLOT_H = 34;
const META_SLOT_H_COMPACT = 22;

function stackMetrics(compact?: boolean) {
  return {
    defaultSlotH: compact ? DEFAULT_SLOT_H_COMPACT : DEFAULT_SLOT_H,
    deckPeekY: compact ? DECK_PEEK_Y_COMPACT : DECK_PEEK_Y,
    deckShadowPad: compact ? DECK_SHADOW_PAD_COMPACT : DECK_SHADOW_PAD,
    hintsGap: compact ? HINTS_GAP_COMPACT : HINTS_GAP,
    subtitleSlotH: compact ? SUBTITLE_SLOT_H_COMPACT : SUBTITLE_SLOT_H,
    metaSlotH: compact ? META_SLOT_H_COMPACT : META_SLOT_H,
    purposeStripH: compact ? PURPOSE_STRIP_H_COMPACT : PURPOSE_STRIP_H,
  };
}

const SPRING_SNAP = { damping: 24, stiffness: 190, mass: 0.85 };
/** Domknięcie talii po puszczeniu — szybkie, bez „zatrzymania” na końcu. */
const SPRING_DECK_COMMIT = { damping: 32, stiffness: 320, mass: 0.75 };
const TIMING_DECK_CANCEL = { duration: 280, easing: Easing.out(Easing.cubic) };
/** Crossfade: dolna karta wjeżdża na wierzch bez migania warstw. */
const HANDOFF_INCOMING_START = 0.42;
const HANDOFF_INCOMING_END = 0.92;
const HANDOFF_BACK_PEEK_END = 0.48;

function CouponPurposeStrip({
  purpose,
  label,
  iconName,
  isDark,
  stripUsed,
  compact,
}: {
  purpose: ProfilePromoCouponPurpose;
  label: string;
  iconName: string;
  isDark: boolean;
  stripUsed?: boolean;
  compact?: boolean;
}) {
  const metrics = stackMetrics(compact);
  const visual = stripUsed
    ? getCouponUsedPurposeStripVisual(isDark)
    : getCouponPurposeStripVisual(purpose, isDark);
  return (
    <View
      style={[stripStyles.strip, compact && stripStyles.stripCompact, { backgroundColor: visual.stripBg, height: metrics.purposeStripH }]}
      pointerEvents="none"
    >
      <View style={[stripStyles.iconWrap, compact && stripStyles.iconWrapCompact, { backgroundColor: visual.iconBg }]}>
        <Ionicons name={safeIoniconName(iconName, 'pricetag')} size={compact ? 12 : 14} color={visual.iconColor} />
      </View>
      <Text style={[stripStyles.label, compact && stripStyles.labelCompact, { color: visual.textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PromoCardFace({
  card,
  isDark,
  elevated,
  softShadow,
  compact,
}: {
  card: ProfilePromoCardRecord;
  isDark: boolean;
  elevated?: boolean;
  /** Karta w tle stosu — mniejszy cień, żeby nie nachodził na podpowiedzi. */
  softShadow?: boolean;
  compact?: boolean;
}) {
  const metrics = stackMetrics(compact);
  const theme = card.visualTheme ?? 'default';
  const isUsed = card.couponUsed === true;
  const surface = getCouponSurfaceStyle(theme, isDark);
  const isBirthday = theme === 'birthday';
  const borderColor = isBirthday ? card.borderColor : card.borderColor;
  const purposeLabel = card.purposeLabel;
  const purposeIcon = card.purposeIcon ?? 'pricetag';
  const purpose = card.purpose ?? 'generic';
  const hasStrip = Boolean(purposeLabel);

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        elevated && styles.cardElevated3d,
        softShadow && styles.cardSoft3d,
        !elevated && !softShadow && styles.cardRest3d,
        {
          backgroundColor: surface.backgroundColor,
          borderColor,
          overflow: 'hidden',
          paddingBottom: hasStrip ? metrics.purposeStripH + (compact ? 8 : 10) : compact ? 10 : 14,
        },
      ]}
    >
      {/* Highlight + głęboki cień = „plastikowa” karta 3D */}
      <View style={styles.cardTopSheen} pointerEvents="none" />
      <View style={styles.cardInnerRim} pointerEvents="none" />

      {isBirthday ? <BirthdayCouponBackdrop isDark={isDark} /> : null}

      {elevated ? (
        <View style={styles.peelCorner} pointerEvents="none">
          <View style={[styles.peelFold, { backgroundColor: isDark ? '#2C2C2E' : '#E8E8ED' }]} />
        </View>
      ) : null}
      <View style={styles.contentRow}>
        <View
          style={[
            styles.icon,
            compact && styles.iconCompact,
            styles.contentRaised,
            styles.icon3d,
            { backgroundColor: card.iconBg },
          ]}
        >
          <Ionicons name={safeIoniconName(card.iconName, 'sparkles')} size={compact ? 18 : 22} color="#FFFFFF" />
        </View>
        <View style={[styles.body, styles.contentRaised]}>
          <View style={styles.headerRow}>
            <Text
              style={[styles.title, compact && styles.titleCompact, { color: isDark ? '#FFFFFF' : '#000000' }]}
              numberOfLines={1}
            >
              {card.title}
            </Text>
            <View
              style={[
                styles.pill,
                compact && styles.pillCompact,
                styles.pill3d,
                { backgroundColor: card.pillBg, borderColor: card.pillBorder },
              ]}
            >
              <Text style={[styles.pillText, compact && styles.pillTextCompact, { color: card.pillColor }]}>
                {card.pillLabel}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.subtitle,
              { minHeight: metrics.subtitleSlotH },
              isBirthday && styles.subtitleFestive,
              compact && styles.subtitleCompact,
            ]}
            numberOfLines={compact ? 1 : 2}
          >
            {card.subtitle}
          </Text>
          <Text
            style={[styles.meta, { minHeight: metrics.metaSlotH }, compact && styles.metaCompact]}
            numberOfLines={compact ? 1 : 2}
          >
            {card.meta}
          </Text>
        </View>
      </View>
      {hasStrip ? (
        <CouponPurposeStrip
          purpose={purpose}
          label={purposeLabel!}
          iconName={purposeIcon}
          isDark={isDark}
          stripUsed={isUsed}
          compact={compact}
        />
      ) : null}
    </View>
  );
}

type Props = {
  cards: ProfilePromoCardRecord[];
  isDark: boolean;
  swipeHint?: string;
  dismissHint?: string;
  compact?: boolean;
  onRequestDismiss?: (card: ProfilePromoCardRecord) => void;
};

export default function PromoCardStack({
  cards,
  isDark,
  swipeHint,
  dismissHint,
  compact = false,
  onRequestDismiss,
}: Props) {
  const metrics = stackMetrics(compact);
  const [topIndex, setTopIndex] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  /** 0 = wierzch w spoczynku, 1 = kolejna karta przejęła miejsce (jak Wallet). */
  const deckProgress = useSharedValue(0);
  const dismissX = useSharedValue(0);
  const rotateDeg = useSharedValue(0);
  const peelWiggle = useSharedValue(0);
  const isDragging = useSharedValue(0);
  const slotHeightSv = useSharedValue(metrics.defaultSlotH);
  const dragHapticFired = useRef(false);
  const advanceAfterLayout = useRef(false);
  /** Karta widoczna w crossfade do momentu resetu progress — bez błysku po zmianie indeksu. */
  const frozenIncomingRef = useRef<ProfilePromoCardRecord | null>(null);

  const safeCards = cards.length > 0 ? cards : [];
  const count = safeCards.length;
  const topCard = count > 0 ? safeCards[topIndex % count] : undefined;
  const backIndex = count > 1 ? (topIndex + 1) % count : -1;
  const backCard = backIndex >= 0 ? safeCards[backIndex] : undefined;
  const canSwipeNext = count > 1;
  const canDismiss = Boolean(topCard?.dismissible && onRequestDismiss);
  const topPeelHint = Boolean(topCard?.peelHint);

  const maxMeasuredHeight = useMemo(() => {
    const heights = safeCards.map((c) => measuredHeights[c.id] ?? 0);
    return Math.max(metrics.defaultSlotH, ...heights, 0);
  }, [safeCards, measuredHeights, metrics.defaultSlotH]);

  useEffect(() => {
    slotHeightSv.value = withSpring(maxMeasuredHeight, SPRING_SNAP);
  }, [maxMeasuredHeight, slotHeightSv]);

  useEffect(() => {
    setTopIndex(0);
    setMeasuredHeights({});
    deckProgress.value = 0;
    dismissX.value = 0;
    rotateDeg.value = 0;
    isDragging.value = 0;
    slotHeightSv.value = metrics.defaultSlotH;
  }, [cards, deckProgress, dismissX, rotateDeg, isDragging, slotHeightSv, metrics.defaultSlotH]);

  useEffect(() => {
    if (topIndex >= count && count > 0) {
      setTopIndex(0);
    }
  }, [count, topIndex]);

  useEffect(() => {
    rotateDeg.value = 0;
  }, [topCard?.id, rotateDeg]);

  useEffect(() => {
    peelWiggle.value = 0;
    if (!topPeelHint) return;
    peelWiggle.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400 }),
        withTiming(0, { duration: 1400 }),
      ),
      -1,
      true,
    );
  }, [topCard?.id, topPeelHint, peelWiggle]);

  const triggerDragHaptic = useCallback(() => {
    if (dragHapticFired.current) return;
    dragHapticFired.current = true;
    void Haptics.selectionAsync();
  }, []);

  const finishDeckAdvance = useCallback(() => {
    if (count < 2 || !backCard) return;
    frozenIncomingRef.current = backCard;
    advanceAfterLayout.current = true;
    setTopIndex((i) => (i + 1) % count);
    dismissX.value = 0;
    rotateDeg.value = 0;
    isDragging.value = 0;
  }, [count, backCard, dismissX, isDragging, rotateDeg]);

  useLayoutEffect(() => {
    if (!advanceAfterLayout.current) return;
    advanceAfterLayout.current = false;
    deckProgress.value = 0;
    frozenIncomingRef.current = null;
  }, [topIndex, deckProgress]);

  const resetDragHaptic = useCallback(() => {
    dragHapticFired.current = false;
  }, []);

  const triggerCommitHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const requestDismiss = () => {
    if (!topCard || !onRequestDismiss) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onRequestDismiss(topCard);
    deckProgress.value = 0;
    dismissX.value = 0;
    rotateDeg.value = 0;
    isDragging.value = 0;
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwipeNext || canDismiss)
        .activeOffsetX([-12, 12])
        .onBegin(() => {
          isDragging.value = 1;
          runOnJS(triggerDragHaptic)();
        })
        .onUpdate((e) => {
          const dx = e.translationX;
          if (dx > 0 && canSwipeNext) {
            dismissX.value = 0;
            deckProgress.value = interpolate(dx, [0, SWIPE_OUT], [0, 1], Extrapolation.CLAMP);
            rotateDeg.value = interpolate(deckProgress.value, [0, 1], [0, 4.5], Extrapolation.CLAMP);
          } else if (dx < 0 && canDismiss) {
            deckProgress.value = 0;
            dismissX.value = dx;
            rotateDeg.value = interpolate(dx, [-SWIPE_OUT, 0], [-4.5, 0], Extrapolation.CLAMP);
          }
        })
        .onEnd((e) => {
          isDragging.value = 0;
          runOnJS(resetDragHaptic)();
          const dx = e.translationX;
          const velocityP = e.velocityX / SWIPE_OUT;

          if (dx > SWIPE_THRESHOLD && canSwipeNext) {
            runOnJS(triggerCommitHaptic)();
            deckProgress.value = withSpring(
              1,
              { ...SPRING_DECK_COMMIT, velocity: velocityP },
              (finished) => {
                if (finished) runOnJS(finishDeckAdvance)();
              },
            );
            return;
          }

          if (dx < -SWIPE_THRESHOLD && canDismiss) {
            dismissX.value = withSpring(-SWIPE_OUT, SPRING_DECK_COMMIT, (finished) => {
              if (finished) runOnJS(requestDismiss)();
            });
            return;
          }

          deckProgress.value = withTiming(0, TIMING_DECK_CANCEL);
          dismissX.value = withSpring(0, SPRING_SNAP);
          rotateDeg.value = withSpring(0, SPRING_SNAP);
        }),
    [
      canSwipeNext,
      canDismiss,
      topCard?.id,
      count,
      isDragging,
      triggerDragHaptic,
      resetDragHaptic,
      finishDeckAdvance,
      triggerCommitHaptic,
      requestDismiss,
    ],
  );

  const frontDeckStyle = useAnimatedStyle(() => {
    const progress = deckProgress.value;
    const slideX = progress * SWIPE_OUT + dismissX.value;
    const wiggleActive =
      topPeelHint && isDragging.value === 0 && progress < 0.02 && Math.abs(dismissX.value) < 4;
    const wiggleRot = wiggleActive ? interpolate(peelWiggle.value, [0, 1], [-0.5, 0.5]) : 0;
    const wiggleX = wiggleActive ? interpolate(peelWiggle.value, [0, 1], [-2, 2]) : 0;
    return {
      zIndex: 3,
      transform: [
        { translateX: slideX + wiggleX },
        { translateY: interpolate(progress, [0, 1], [0, -4], Extrapolation.CLAMP) },
        { rotate: `${rotateDeg.value + wiggleRot}deg` },
        {
          scale: interpolate(progress, [0, 1], [1, 0.97], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const outgoingFaceStyle = useAnimatedStyle(() => {
    const progress = deckProgress.value;
    return {
      opacity: interpolate(
        progress,
        [0, HANDOFF_INCOMING_START, HANDOFF_INCOMING_END],
        [1, 0.35, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  const incomingFaceStyle = useAnimatedStyle(() => {
    const progress = deckProgress.value;
    return {
      opacity: interpolate(
        progress,
        [HANDOFF_INCOMING_START, HANDOFF_INCOMING_END, 1],
        [0, 1, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const progress = deckProgress.value;
    return {
      zIndex: 2,
      opacity: interpolate(
        progress,
        [0, 0.12, HANDOFF_BACK_PEEK_END, HANDOFF_INCOMING_START],
        [0.9, 1, 0.55, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(progress, [0, HANDOFF_INCOMING_START], [metrics.deckPeekY, 0], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(
            progress,
            [0, HANDOFF_INCOMING_START],
            [DECK_BACK_SCALE_REST, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const peekExtra = count > 1 ? metrics.deckPeekY : 0;

  const slotStyle = useAnimatedStyle(() => ({
    height: slotHeightSv.value + peekExtra,
  }));

  const cardSlotStyle = useAnimatedStyle(() => ({
    height: slotHeightSv.value,
  }));

  const recordCardHeight = (cardId: string, height: number) => {
    if (!height || height < 1) return;
    setMeasuredHeights((prev) => {
      if (prev[cardId] === height) return prev;
      return { ...prev, [cardId]: height };
    });
  };

  if (!topCard) return null;

  const deckPosition = count > 0 ? (topIndex % count) + 1 : 1;
  const incomingDisplayCard = frozenIncomingRef.current ?? backCard;
  const showHints = Boolean((canSwipeNext && swipeHint) || (canDismiss && dismissHint));
  const hintDivider = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const hintWellBg = isDark ? 'rgba(28,28,30,0.55)' : 'rgba(242,242,247,0.9)';

  return (
    <View style={styles.stackWrap}>
      <View style={styles.measureHost} pointerEvents="none">
        {safeCards.map((card) => (
          <View
            key={`measure-${card.id}`}
            style={styles.measureCell}
            onLayout={(e) => recordCardHeight(card.id, e.nativeEvent.layout.height)}
          >
            <PromoCardFace card={card} isDark={isDark} compact={compact} />
          </View>
        ))}
      </View>

      <View style={[styles.deckStage, { paddingBottom: metrics.deckShadowPad }]}>
        <Animated.View style={[styles.stack, slotStyle]}>
          {backCard ? (
            <Animated.View
              style={[styles.deckLayer, cardSlotStyle, styles.deckBackLayer, backStyle]}
              pointerEvents="none"
            >
              <PromoCardFace card={backCard} isDark={isDark} softShadow compact={compact} />
            </Animated.View>
          ) : null}

          <GestureDetector gesture={pan}>
            <Animated.View
              style={[styles.deckLayer, cardSlotStyle, styles.deckFrontLayer, frontDeckStyle]}
            >
              <Animated.View style={[styles.deckFaceLayer, outgoingFaceStyle]}>
                <PromoCardFace card={topCard} isDark={isDark} elevated={canSwipeNext} compact={compact} />
              </Animated.View>
              {incomingDisplayCard ? (
                <Animated.View style={[styles.deckFaceLayer, incomingFaceStyle]} pointerEvents="none">
                  <PromoCardFace card={incomingDisplayCard} isDark={isDark} compact={compact} />
                </Animated.View>
              ) : null}
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </View>

      {showHints ? (
        <View
          style={[
            styles.hintsZone,
            compact && styles.hintsZoneCompact,
            {
              marginTop: metrics.hintsGap,
              backgroundColor: hintWellBg,
              borderColor: hintDivider,
            },
          ]}
          pointerEvents="none"
        >
          {count > 1 ? (
            <Text
              style={[
                styles.deckCounterHint,
                compact && styles.deckCounterHintCompact,
                { color: isDark ? 'rgba(235,235,245,0.5)' : '#8E8E93' },
              ]}
            >
              {deckPosition}/{count}
            </Text>
          ) : null}
          {canSwipeNext && swipeHint ? (
            <Text style={[styles.hint, compact && styles.hintCompact, { color: isDark ? 'rgba(235,235,245,0.7)' : '#636366' }]}>
              {swipeHint}
            </Text>
          ) : null}
          {canDismiss && dismissHint ? (
            <View style={[styles.dismissChip, { borderColor: hintDivider, backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.95)' }]}>
              <Ionicons name="arrow-back" size={compact ? 11 : 12} color={isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93'} />
              <Text
                style={[
                  styles.dismissChipText,
                  compact && styles.dismissChipTextCompact,
                  { color: isDark ? 'rgba(235,235,245,0.62)' : '#636366' },
                ]}
              >
                {dismissHint}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  measureHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  },
  measureCell: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  deckStage: {
    width: '100%',
    zIndex: 1,
    overflow: 'hidden',
  },
  stack: {
    position: 'relative',
    width: '100%',
    overflow: 'visible',
  },
  hintsZone: {
    width: '100%',
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    zIndex: 0,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  hintsZoneCompact: {
    paddingTop: 8,
    paddingBottom: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 5,
  },
  deckLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    width: '100%',
  },
  deckBackLayer: {
    zIndex: 2,
  },
  deckFrontLayer: {
    zIndex: 3,
  },
  deckFaceLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    shadowColor: '#1A1A1A',
  },
  cardCompact: {
    borderRadius: 14,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  cardElevated3d: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  cardSoft3d: {
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  cardRest3d: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  cardTopSheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '42%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardInnerRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peelCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    overflow: 'hidden',
    borderTopRightRadius: 16,
    zIndex: 4,
  },
  peelFold: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 28,
    height: 28,
    borderRadius: 4,
    opacity: 0.9,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
    marginRight: 8,
  },
  icon3d: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 4,
  },
  body: { flex: 1, minWidth: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  deckCounterHint: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginLeft: 2,
    fontVariant: ['tabular-nums'],
  },
  deckCounterHintCompact: {
    fontSize: 10,
  },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flex: 1 },
  titleCompact: { fontSize: 15 },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  pillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pill3d: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  pillTextCompact: { fontSize: 9, letterSpacing: 0.35 },
  subtitle: { color: '#8E8E93', fontSize: 13, fontWeight: '700', marginTop: 3 },
  subtitleCompact: { fontSize: 12, marginTop: 2 },
  subtitleFestive: { color: '#B35C1E' },
  meta: { color: '#8E8E93', fontSize: 12, marginTop: 4 },
  metaCompact: { fontSize: 11, marginTop: 2 },
  contentRaised: {
    zIndex: 3,
  },
  hint: {
    marginTop: 0,
    marginLeft: 2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 17,
  },
  hintCompact: {
    fontSize: 11,
    lineHeight: 15,
  },
  dismissChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dismissChipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 16,
  },
  dismissChipTextCompact: {
    fontSize: 11,
    lineHeight: 14,
  },
});

const stripStyles = StyleSheet.create({
  strip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PURPOSE_STRIP_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 7,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  stripCompact: {
    paddingHorizontal: 8,
    gap: 5,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCompact: {
    width: 18,
    height: 18,
    borderRadius: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  labelCompact: {
    fontSize: 10,
    letterSpacing: 0.45,
  },
});
