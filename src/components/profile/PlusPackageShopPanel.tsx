import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  embedded?: boolean;
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
  embedded = false,
  showRestore = true,
  footer,
  onBuy,
  onRestore,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const panelBorder = hasPlusAvailable
    ? isDark
      ? 'rgba(16,185,129,0.55)'
      : 'rgba(16,185,129,0.62)'
    : isDark
      ? 'rgba(16,185,129,0.28)'
      : 'rgba(16,185,129,0.35)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const accent = hasPlusAvailable ? '#10B981' : '#0A84FF';

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
        onPress={() => setExpanded((v) => !v)}
        style={({ pressed }) => [styles.statusRow, pressed && { opacity: 0.92 }]}
      >
        <View style={[styles.slotBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          <Text style={[styles.slotNumber, { color: accent }]}>{hasPlusAvailable ? plusSlots : '0'}</Text>
          <Text style={[styles.slotCaption, { color: isDark ? 'rgba(235,235,245,0.5)' : '#8E8E93' }]}>
            Plus
          </Text>
        </View>
        <View style={styles.statusCopy}>
          <Text style={[styles.packageTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{title}</Text>
          <Text style={[styles.counter, { color: accent }]}>{counterLabel}</Text>
          {hasPlusAvailable && expiryLabel ? (
            <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.55)' : '#8E8E93' }]}>
              {expiryLabel}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: isDark ? 'rgba(235,235,245,0.45)' : '#AEAEB2' }]}>
            {daysLabel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <View style={[styles.statusIcon, { backgroundColor: accent }]}>
            <Ionicons name={hasPlusAvailable ? 'checkmark-circle' : 'bag-add'} size={22} color="#FFFFFF" />
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={isDark ? '#8E8E93' : '#C7C7CC'}
          />
        </View>
      </Pressable>

      {expanded ? (
        <>
          <View style={[styles.divider, { backgroundColor: divider }]} />

          <Pressable
            onPress={onBuy}
            disabled={buying}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
              buying && { opacity: 0.7 },
            ]}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#10B981' }]}>
              {buying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="bag-check" size={21} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.actionBody}>
              <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{buyLabel}</Text>
              <Text style={styles.actionSubtitle}>{buySubtitle}</Text>
            </View>
            {!buying && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
          </Pressable>

          <View style={[styles.dividerThin, { backgroundColor: divider }]} />

          {showRestore ? (
            <Pressable
              onPress={onRestore}
              disabled={restoring}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
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

          {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
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
  slotBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  slotCaption: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.4,
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
