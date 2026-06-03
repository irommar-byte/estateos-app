import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { profileShopLeatherBg, profileShopLeatherPressedBg } from './profileCardElevation';
import ProfileInvestorProVipBadge from './ProfileInvestorProVipBadge';
import ProfileGoldCrown from './ProfileGoldCrown';

type Props = {
  isDark: boolean;
  title: string;
  statusLabel: string;
  metaLabel: string;
  expiryLabel: string | null;
  trialBadge?: string | null;
  priceLine?: string | null;
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
  showRestore?: boolean;
  footer?: React.ReactNode;
  onBuy: () => void;
  onRestore: () => void;
};

function ActiveProVipBadge({ size = 36 }: { size?: number }) {
  return <ProfileInvestorProVipBadge size={size} />;
}

export default function InvestorProShopPanel({
  isDark,
  title,
  statusLabel,
  metaLabel,
  expiryLabel,
  trialBadge,
  priceLine,
  buyLabel,
  buySubtitle,
  restoreLabel,
  restoreSubtitle,
  restoring,
  buying,
  isActive,
  defaultExpanded = true,
  collapsible = true,
  embedded = false,
  leatherSurface = false,
  showRestore = true,
  footer,
  onBuy,
  onRestore,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isBodyVisible = collapsible ? expanded : true;
  const panelBg = leatherSurface ? profileShopLeatherBg(isDark) : isDark ? '#1C1C1E' : '#FFFFFF';
  const pressedBg = leatherSurface ? profileShopLeatherPressedBg(isDark) : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const panelBorder = leatherSurface
    ? isDark
      ? 'rgba(210,180,140,0.24)'
      : 'rgba(139,115,85,0.18)'
    : isActive
    ? isDark
      ? 'rgba(251,191,36,0.72)'
      : 'rgba(245,158,11,0.78)'
    : isDark
      ? 'rgba(245,158,11,0.32)'
      : 'rgba(245,158,11,0.42)';
  const divider = leatherSurface
    ? isDark
      ? 'rgba(210,180,140,0.16)'
      : 'rgba(139,115,85,0.12)'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.06)';
  const accent = isActive ? '#F59E0B' : '#0A84FF';

  return (
    <View
      style={[
        styles.panel,
        embedded && styles.panelEmbedded,
        { backgroundColor: panelBg, borderColor: panelBorder },
        isActive && !embedded && styles.panelActiveGlow,
      ]}
    >
      {!isActive && trialBadge ? (
        <Pressable
          onPress={onBuy}
          disabled={buying}
          style={({ pressed }) => [styles.trialBanner, pressed && { opacity: 0.92 }, buying && { opacity: 0.78 }]}
        >
          <Ionicons name="gift" size={18} color="#FFFFFF" />
          <View style={styles.trialCopy}>
            <Text style={styles.trialBadgeText}>{trialBadge}</Text>
            {priceLine ? <Text style={styles.trialPriceText}>{priceLine}</Text> : null}
          </View>
          {buying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.92)" />
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={collapsible ? () => setExpanded((v) => !v) : undefined}
        disabled={!collapsible}
        style={({ pressed }) => [styles.statusRow, pressed && collapsible && { opacity: 0.92 }]}
      >
        <View
          style={[
            styles.slotBadge,
            { backgroundColor: `${accent}18`, borderColor: `${accent}55` },
            isActive && styles.slotBadgeActive,
          ]}
        >
          {isActive ? (
            <ActiveProVipBadge size={40} />
          ) : (
            <ProfileGoldCrown size={36} />
          )}
        </View>
        <View style={styles.statusCopy}>
          <Text style={[styles.packageTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{title}</Text>
          <Text style={[styles.counter, { color: accent }]}>{statusLabel}</Text>
          {expiryLabel ? (
            <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}>
              {expiryLabel}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.45)' : '#AEAEB2' }]}>
            {metaLabel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {isActive ? (
            <View style={[styles.statusIcon, { backgroundColor: accent }]}>
              <Ionicons name="checkmark-circle" size={22} color="#FFFFFF" />
            </View>
          ) : (
            <View style={[styles.statusIcon, { backgroundColor: accent }]}>
              <Ionicons name="sparkles" size={22} color="#FFFFFF" />
            </View>
          )}
          {collapsible ? (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={isDark ? '#8E8E93' : '#C7C7CC'}
            />
          ) : null}
        </View>
      </Pressable>

      {isBodyVisible ? (
        <>
          {!isActive ? (
            <>
              <View style={[styles.divider, { backgroundColor: divider }]} />

              <Pressable
                onPress={onBuy}
                disabled={buying}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && { backgroundColor: pressedBg },
                  buying && { opacity: 0.7 },
                ]}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
                  {buying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="diamond" size={21} color="#FFFFFF" />
                  )}
                </View>
                <View style={styles.actionBody}>
                  <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{buyLabel}</Text>
                  <Text style={styles.actionSubtitle}>{buySubtitle}</Text>
                </View>
                {!buying && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
              </Pressable>

              <View style={[styles.dividerThin, { backgroundColor: divider }]} />
            </>
          ) : null}

          {showRestore && !isActive ? (
            <Pressable
              onPress={onRestore}
              disabled={restoring}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { backgroundColor: pressedBg },
                restoring && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#0A84FF' }]}>
                {restoring ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh-circle" size={22} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.actionBody}>
                <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{restoreLabel}</Text>
                <Text style={styles.actionSubtitle}>{restoreSubtitle}</Text>
              </View>
              {!restoring && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
            </Pressable>
          ) : null}

          {footer ? (
            <>
              <View style={[styles.divider, { backgroundColor: divider }]} />
              <View style={styles.footerWrap}>{footer}</View>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
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
    shadowColor: '#F59E0B',
    shadowOpacity: 0.48,
    shadowRadius: 28,
    elevation: 12,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
  },
  trialCopy: { flex: 1 },
  trialBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trialPriceText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  slotBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  slotBadgeActive: {
    borderColor: 'rgba(251,191,36,0.85)',
    backgroundColor: 'rgba(245,158,11,0.22)',
  },
  statusCopy: { flex: 1, minWidth: 0 },
  packageTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  counter: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
    fontWeight: '500',
  },
  headerActions: {
    alignItems: 'center',
    gap: 6,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  dividerThin: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, paddingRight: 4 },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 16,
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
  },
});
