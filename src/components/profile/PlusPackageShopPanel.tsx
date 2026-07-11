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
  title,
  plusSlots,
  hasPlusAvailable,
  counterLabel,
  expiryLabel,
  daysLabel,
  buyLabel,
  buySubtitle,
  restoreLabel,
  restoreSubtitle,
  restoring,
  buying,
  defaultExpanded = true,
  collapsible = true,
  embedded = false,
  leatherSurface = false,
  compactEmbedded = false,
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
    : hasPlusAvailable
    ? isDark
      ? 'rgba(16,185,129,0.55)'
      : 'rgba(16,185,129,0.62)'
    : isDark
      ? 'rgba(16,185,129,0.28)'
      : 'rgba(16,185,129,0.35)';
  const divider = leatherSurface
    ? isDark
      ? 'rgba(210,180,140,0.16)'
      : 'rgba(139,115,85,0.12)'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.06)';
  const accent = hasPlusAvailable ? '#10B981' : '#0A84FF';
  const showCombinedMeta = compactEmbedded && hasPlusAvailable && expiryLabel;

  return (
    <View
      style={[
        styles.panel,
        embedded && styles.panelEmbedded,
        { backgroundColor: panelBg, borderColor: panelBorder },
        hasPlusAvailable && !embedded && styles.panelActiveGlow,
      ]}
    >
      <Pressable
        onPress={collapsible ? () => setExpanded((v) => !v) : undefined}
        disabled={!collapsible}
        style={({ pressed }) => [
          styles.statusRow,
          compactEmbedded && styles.statusRowCompact,
          pressed && collapsible && { opacity: 0.92 },
        ]}
      >
        <View
          style={[
            styles.slotBadge,
            compactEmbedded && styles.slotBadgeCompact,
            { backgroundColor: `${accent}18`, borderColor: `${accent}44` },
          ]}
        >
          <Text style={[styles.slotNumber, compactEmbedded && styles.slotNumberCompact, { color: accent }]}>
            {hasPlusAvailable ? plusSlots : '0'}
          </Text>
          <Text
            style={[
              styles.slotCaption,
              compactEmbedded && styles.slotCaptionCompact,
              { color: isDark ? 'rgba(235,235,245,0.5)' : '#8E8E93' },
            ]}
          >
            Plus
          </Text>
        </View>
        <View style={styles.statusCopy}>
          <Text
            style={[
              styles.packageTitle,
              compactEmbedded && styles.packageTitleCompact,
              { color: isDark ? '#FFFFFF' : '#000000' },
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.counter, compactEmbedded && styles.counterCompact, { color: accent }]}>
            {counterLabel}
          </Text>
          {showCombinedMeta ? (
            <Text
              style={[styles.meta, compactEmbedded && styles.metaCompact, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}
              numberOfLines={1}
            >
              {[expiryLabel, daysLabel].filter(Boolean).join(' · ')}
            </Text>
          ) : (
            <>
              {hasPlusAvailable && expiryLabel ? (
                <Text style={[styles.meta, compactEmbedded && styles.metaCompact, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}>
                  {expiryLabel}
                </Text>
              ) : null}
              <Text style={[styles.meta, compactEmbedded && styles.metaCompact, { color: isDark ? 'rgba(235,235,245,0.45)' : '#AEAEB2' }]}>
                {daysLabel}
              </Text>
            </>
          )}
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.statusIcon, compactEmbedded && styles.statusIconCompact, { backgroundColor: accent }]}>
            <Ionicons name={hasPlusAvailable ? 'checkmark-circle' : 'bag-add'} size={compactEmbedded ? 18 : 22} color="#FFFFFF" />
          </View>
          {collapsible ? (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={compactEmbedded ? 18 : 20}
              color={isDark ? '#8E8E93' : '#C7C7CC'}
            />
          ) : null}
        </View>
      </Pressable>

      {isBodyVisible ? (
        <>
          <View style={[styles.divider, { backgroundColor: divider }]} />

          <Pressable
            onPress={onBuy}
            disabled={buying}
            style={({ pressed }) => [
              styles.actionRow,
              compactEmbedded && styles.actionRowCompact,
              pressed && { backgroundColor: pressedBg },
              buying && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.actionIcon, compactEmbedded && styles.actionIconCompact, { backgroundColor: '#10B981' }]}>
              {buying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="bag-check" size={compactEmbedded ? 18 : 21} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, compactEmbedded && styles.actionTitleCompact, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                {buyLabel}
              </Text>
              <Text style={[styles.actionSubtitle, compactEmbedded && styles.actionSubtitleCompact]}>{buySubtitle}</Text>
            </View>
            {!buying && <Ionicons name="chevron-forward" size={compactEmbedded ? 18 : 20} color="#C7C7CC" />}
          </Pressable>

          <View style={[styles.dividerThin, { backgroundColor: divider }]} />

          {showRestore ? (
            <Pressable
              onPress={onRestore}
              disabled={restoring}
              style={({ pressed }) => [
                styles.actionRow,
                compactEmbedded && styles.actionRowCompact,
                pressed && { backgroundColor: pressedBg },
                restoring && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.actionIcon, compactEmbedded && styles.actionIconCompact, { backgroundColor: '#0A84FF' }]}>
                {restoring ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="refresh-circle" size={compactEmbedded ? 20 : 22} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.actionBody}>
                <Text style={[styles.actionTitle, compactEmbedded && styles.actionTitleCompact, { color: isDark ? '#FFFFFF' : '#000000' }]}>
                  {restoreLabel}
                </Text>
                <Text style={[styles.actionSubtitle, compactEmbedded && styles.actionSubtitleCompact]}>{restoreSubtitle}</Text>
              </View>
              {!restoring && <Ionicons name="chevron-forward" size={compactEmbedded ? 18 : 20} color="#C7C7CC" />}
            </Pressable>
          ) : null}

          {footer ? <View style={[styles.footerWrap, compactEmbedded && styles.footerWrapCompact]}>{footer}</View> : null}
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
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
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
    shadowColor: '#10B981',
    shadowOpacity: 0.32,
    shadowRadius: 22,
    elevation: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  statusRowCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  slotBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeCompact: {
    width: 48,
    height: 48,
    borderRadius: 13,
  },
  slotNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  slotNumberCompact: {
    fontSize: 22,
  },
  slotCaption: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  slotCaptionCompact: {
    fontSize: 9,
    marginTop: 1,
  },
  statusCopy: { flex: 1, minWidth: 0 },
  packageTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  packageTitleCompact: {
    fontSize: 15,
  },
  counter: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  counterCompact: {
    fontSize: 13,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
    fontWeight: '500',
  },
  metaCompact: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
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
  statusIconCompact: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
  actionRowCompact: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCompact: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  actionBody: { flex: 1, paddingRight: 4 },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  actionTitleCompact: {
    fontSize: 15,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 16,
  },
  actionSubtitleCompact: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
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
