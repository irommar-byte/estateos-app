import React from 'react';
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
  statusLabel: string;
  metaLabel: string;
  expiryLabel: string | null;
  buyLabel: string;
  buySubtitle: string;
  restoreLabel: string;
  restoreSubtitle: string;
  restoring: boolean;
  buying: boolean;
  isActive: boolean;
  onBuy: () => void;
  onRestore: () => void;
};

export default function InvestorProShopPanel({
  isDark,
  title,
  statusLabel,
  metaLabel,
  expiryLabel,
  buyLabel,
  buySubtitle,
  restoreLabel,
  restoreSubtitle,
  restoring,
  buying,
  isActive,
  onBuy,
  onRestore,
}: Props) {
  const panelBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const panelBorder = isDark ? 'rgba(245,158,11,0.32)' : 'rgba(245,158,11,0.42)';
  const divider = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const accent = isActive ? '#F59E0B' : '#0A84FF';

  return (
    <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
      <View style={styles.statusRow}>
        <View style={[styles.slotBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
          <Ionicons name="diamond" size={28} color={accent} />
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
        <View style={[styles.statusIcon, { backgroundColor: accent }]}>
          <Ionicons name={isActive ? 'checkmark-circle' : 'sparkles'} size={22} color="#FFFFFF" />
        </View>
      </View>

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
});
