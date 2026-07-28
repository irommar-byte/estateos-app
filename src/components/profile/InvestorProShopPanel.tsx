import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { profileShopLeatherBg, profileShopLeatherPressedBg } from './profileCardElevation';
import InvestorProHeroBrand from './InvestorProHeroBrand';

type Props = {
  isDark: boolean;
  title: string;
  statusLabel: string;
  metaLabel: string;
  expiryLabel: string | null;
  trialBadge?: string | null;
  priceLine?: string | null;
  billedHeadline?: string | null;
  legalLine?: string | null;
  buyLabel: string;
  buySubtitle: string;
  restoreLabel: string;
  restoreSubtitle: string;
  restoring: boolean;
  buying: boolean;
  isActive: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  embedded?: boolean;
  leatherSurface?: boolean;
  compactEmbedded?: boolean;
  showRestore?: boolean;
  footer?: React.ReactNode;
  onBuy: () => void;
  onRestore: () => void;
};

export default function InvestorProShopPanel({
  isDark,
  title,
  statusLabel,
  metaLabel,
  expiryLabel,
  trialBadge,
  priceLine,
  billedHeadline,
  buyLabel,
  buySubtitle,
  restoreLabel,
  restoreSubtitle,
  restoring,
  buying,
  isActive,
  embedded = false,
  leatherSurface = false,
  compactEmbedded = false,
  showRestore = true,
  footer,
  onBuy,
  onRestore,
}: Props) {
  const glow = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: isActive ? 1 : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [glow, isActive]);

  const panelBg = leatherSurface ? profileShopLeatherBg(isDark) : isDark ? '#1C1C1E' : '#FFFFFF';
  const pressedBg = leatherSurface
    ? profileShopLeatherPressedBg(isDark)
    : isDark
      ? 'rgba(255,255,255,0.06)'
      : 'rgba(0,0,0,0.04)';
  const divider = leatherSurface
    ? isDark
      ? 'rgba(210,180,140,0.16)'
      : 'rgba(139,115,85,0.12)'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.06)';

  const inactiveBorder = isDark ? 'rgba(120,120,128,0.28)' : 'rgba(142,142,147,0.32)';
  const activeBorder = isDark ? 'rgba(251,191,36,0.72)' : 'rgba(245,158,11,0.78)';
  const muted = isDark ? 'rgba(235,235,245,0.42)' : '#8E8E93';
  const live = isDark ? '#FFFFFF' : '#111111';

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveBorder, activeBorder],
  });
  const shadowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, embedded ? 0.22 : 0.48],
  });

  return (
    <Animated.View
      style={[
        styles.panel,
        embedded && styles.panelEmbedded,
        {
          backgroundColor: panelBg,
          borderColor,
          shadowOpacity,
          shadowColor: isActive ? '#F59E0B' : '#8E8E93',
        },
        isActive && styles.panelActiveGlow,
        !isActive && styles.panelInactive,
      ]}
    >
      <Pressable
        onPress={isActive ? undefined : onBuy}
        disabled={isActive || buying}
        style={({ pressed }) => [
          styles.unifiedCol,
          compactEmbedded && styles.unifiedColCompact,
          pressed && !isActive && { backgroundColor: pressedBg },
          buying && { opacity: 0.75 },
        ]}
      >
        <View style={styles.brandRow}>
          <InvestorProHeroBrand isDark={isDark} size="md" lit={isActive} />
          <View style={styles.brandTrailing}>
            {buying ? (
              <ActivityIndicator size="small" color={isActive ? '#F59E0B' : '#8E8E93'} />
            ) : isActive ? (
              <View style={[styles.check, { backgroundColor: '#F59E0B' }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
            )}
          </View>
        </View>

        {isActive ? (
          <View style={styles.copy}>
            <Text style={[styles.title, { color: live }]}>{title}</Text>
            <Text style={[styles.statusLive, { color: '#F59E0B' }]}>{statusLabel}</Text>
            {expiryLabel ? <Text style={[styles.meta, { color: muted }]}>{expiryLabel}</Text> : null}
            <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.45)' : '#AEAEB2' }]} numberOfLines={2}>
              {metaLabel}
            </Text>
          </View>
        ) : (
          <View style={styles.copy}>
            {(billedHeadline || priceLine) ? (
              <Text style={[styles.price, { color: live }]}>{billedHeadline || priceLine}</Text>
            ) : null}
            {trialBadge ? <Text style={[styles.trial, { color: muted }]}>{trialBadge}</Text> : null}
            <Text style={[styles.buyLine, { color: live }]}>{buyLabel}</Text>
            <Text style={styles.subtitle}>{buySubtitle}</Text>
            {priceLine && billedHeadline ? (
              <Text style={[styles.meta, { color: muted }]} numberOfLines={2}>
                {priceLine}
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>

      {showRestore ? (
        <>
          <View style={[styles.dividerThin, { backgroundColor: divider }]} />
          <Pressable
            onPress={onRestore}
            disabled={restoring}
            style={({ pressed }) => [
              styles.restoreRow,
              compactEmbedded && styles.restoreRowCompact,
              pressed && { backgroundColor: pressedBg },
              restoring && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.restoreIcon, { backgroundColor: '#0A84FF' }]}>
              {restoring ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="refresh-circle" size={22} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.copy}>
              <Text style={[styles.buyLine, { color: live, marginTop: 0 }]}>{restoreLabel}</Text>
              <Text style={styles.subtitle}>{restoreSubtitle}</Text>
            </View>
            {!restoring && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          </Pressable>
        </>
      ) : null}

      {footer ? <View style={[styles.footerWrap, compactEmbedded && styles.footerWrapCompact]}>{footer}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 4,
  },
  panelEmbedded: {
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
  },
  panelActiveGlow: {
    shadowRadius: 28,
    elevation: 12,
  },
  panelInactive: {
    opacity: 0.92,
  },
  unifiedCol: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  unifiedColCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTrailing: {
    marginLeft: 'auto',
    paddingLeft: 8,
  },
  copy: { minWidth: 0 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusLive: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  price: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  trial: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  buyLine: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 14,
  },
  meta: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 14,
    fontWeight: '500',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerThin: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  restoreRowCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  restoreIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
  footerWrapCompact: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 2,
  },
});
