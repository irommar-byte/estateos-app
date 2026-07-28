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
import { useI18n } from '../../i18n';
import { profileShopLeatherBg, profileShopLeatherPressedBg } from './profileCardElevation';
import EosCreditCoin from './EosCreditCoin';

type Props = {
  isDark: boolean;
  title: string;
  plusSlots: number;
  hasPlusAvailable: boolean;
  counterLabel: string;
  expiryLabel: string | null;
  daysLabel: string;
  buyLabel: string;
  buySubtitle: string;
  restoreLabel: string;
  restoreSubtitle: string;
  restoring: boolean;
  buying: boolean;
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

export default function PlusPackageShopPanel({
  isDark,
  plusSlots,
  hasPlusAvailable,
  counterLabel,
  expiryLabel,
  buyLabel,
  buySubtitle,
  restoreLabel,
  restoreSubtitle,
  restoring,
  buying,
  embedded = false,
  leatherSurface = false,
  compactEmbedded = false,
  showRestore = true,
  footer,
  onBuy,
  onRestore,
}: Props) {
  const { t } = useI18n();
  const glow = useRef(new Animated.Value(hasPlusAvailable ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(glow, {
      toValue: hasPlusAvailable ? 1 : 0,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [glow, hasPlusAvailable]);

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
  const activeBorder = isDark ? 'rgba(16,185,129,0.55)' : 'rgba(16,185,129,0.62)';
  const mutedTitle = isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93';
  const liveTitle = isDark ? '#FFFFFF' : '#000000';
  const coinSize = compactEmbedded ? 34 : 40;

  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveBorder, activeBorder],
  });
  const shadowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, embedded ? 0.18 : 0.32],
  });

  const creditsTitle = t('profile.shop.creditsOnAccountTitle');
  const creditsLabel =
    plusSlots === 1
      ? t('profile.shop.creditsOnAccountCreditOne')
      : plusSlots >= 2 && plusSlots <= 4
        ? t('profile.shop.creditsOnAccountCreditFew')
        : t('profile.shop.creditsOnAccountCreditMany');
  const creditsMeta = hasPlusAvailable
    ? t('profile.shop.creditsOnAccountCount', { count: plusSlots, creditsLabel })
    : t('profile.shop.creditsOnAccountEmpty');

  return (
    <Animated.View
      style={[
        styles.panel,
        embedded && styles.panelEmbedded,
        {
          backgroundColor: panelBg,
          borderColor,
          shadowOpacity,
          shadowColor: hasPlusAvailable ? '#10B981' : '#8E8E93',
        },
        hasPlusAvailable && styles.panelActiveGlow,
      ]}
    >
      <Pressable
        onPress={onBuy}
        disabled={buying}
        style={({ pressed }) => [
          styles.unifiedRow,
          compactEmbedded && styles.unifiedRowCompact,
          pressed && { backgroundColor: pressedBg },
          buying && { opacity: 0.75 },
        ]}
      >
        <View style={[styles.coinWrap, !hasPlusAvailable && styles.coinWrapInactive]}>
          {buying ? (
            <ActivityIndicator size="small" color="#CA8A04" />
          ) : (
                <EosCreditCoin size={coinSize} autoSpin={hasPlusAvailable} lit={hasPlusAvailable} />
          )}
        </View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: hasPlusAvailable ? liveTitle : mutedTitle }]}>
            {creditsTitle}
          </Text>
          <Text
            style={[
              styles.countLine,
              { color: hasPlusAvailable ? '#10B981' : isDark ? 'rgba(235,235,245,0.4)' : '#AEAEB2' },
            ]}
          >
            {creditsMeta}
          </Text>
          {hasPlusAvailable && expiryLabel ? (
            <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.5)' : '#8E8E93' }]}>
              {expiryLabel}
            </Text>
          ) : null}
          {!hasPlusAvailable ? (
            <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.38)' : '#AEAEB2' }]}>
              {counterLabel}
            </Text>
          ) : null}
          {/* CTA zakupu zawsze aktywne wizualnie — brak kredytów nie oznacza disabled. */}
          <Text style={[styles.buyLine, { color: liveTitle }]}>
            {buyLabel}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? 'rgba(235,235,245,0.55)' : '#6C6C70' }]}>
            {buySubtitle}
          </Text>
        </View>

        {!buying ? (
          <Ionicons
            name="chevron-forward"
            size={compactEmbedded ? 18 : 20}
            color={hasPlusAvailable ? '#10B981' : isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93'}
          />
        ) : null}
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
                <Ionicons name="refresh-circle" size={compactEmbedded ? 20 : 22} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.copy}>
              <Text style={[styles.buyLine, { color: liveTitle }]}>{restoreLabel}</Text>
              <Text style={[styles.subtitle, { color: isDark ? 'rgba(235,235,245,0.55)' : '#6C6C70' }]}>
                {restoreSubtitle}
              </Text>
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
    shadowOpacity: 0,
    elevation: 0,
  },
  panelActiveGlow: {
    shadowRadius: 22,
    elevation: 8,
  },
  unifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  unifiedRowCompact: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  coinWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinWrapInactive: {
    opacity: 0.55,
  },
  copy: { flex: 1, minWidth: 0, paddingRight: 4 },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countLine: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: -0.2,
  },
  meta: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
    fontWeight: '500',
  },
  buyLine: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  dividerThin: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
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
