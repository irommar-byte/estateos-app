import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';
import BonusCouponsSection from './BonusCouponsSection';
import PlusPackageShopPanel from './PlusPackageShopPanel';
import InvestorProShopPanel from './InvestorProShopPanel';
import ProfileCardShell from './ProfileCardShell';

type Props = {
  isDark: boolean;
  sectionTitle: string;
  bonusCoupons: {
    cards: ProfilePromoCardRecord[];
    title: string;
    subtitle: string;
    swipeHint: string;
    dismissHint: string;
    emptyHint: string;
    onRequestDismiss?: (card: ProfilePromoCardRecord) => void;
  };
  plus: {
    title: string;
    plusSlots: number;
    hasPlusAvailable: boolean;
    counterLabel: string;
    expiryLabel: string | null;
    daysLabel: string;
    buyLabel: string;
    buySubtitle: string;
    footer: React.ReactNode;
    buying: boolean;
    defaultExpanded: boolean;
    onBuy: () => void;
  };
  investorPro: {
    title: string;
    statusLabel: string;
    metaLabel: string;
    expiryLabel: string | null;
    trialBadge: string | null;
    priceLine: string | null;
    buyLabel: string;
    buySubtitle: string;
    footer: React.ReactNode;
    buying: boolean;
    isActive: boolean;
    defaultExpanded: boolean;
    onBuy: () => void;
  };
  restore: {
    label: string;
    subtitle: string;
    restoring: boolean;
    onRestore: () => void;
  };
};

function ShopRestoreRow({
  isDark,
  restoreLabel,
  restoreSubtitle,
  restoring,
  onRestore,
}: {
  isDark: boolean;
  restoreLabel: string;
  restoreSubtitle: string;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <Pressable
      onPress={onRestore}
      disabled={restoring}
      style={({ pressed }) => [
        styles.restoreRow,
        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
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
      <View style={styles.restoreBody}>
        <Text style={[styles.restoreTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>{restoreLabel}</Text>
        <Text style={styles.restoreSubtitle}>{restoreSubtitle}</Text>
      </View>
      {!restoring && <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />}
    </Pressable>
  );
}

export default function ProfileShopSection({
  isDark,
  sectionTitle,
  bonusCoupons,
  plus,
  investorPro,
  restore,
}: Props) {
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>

      <ProfileCardShell isDark={isDark}>
        <BonusCouponsSection
          embedded
          cards={bonusCoupons.cards}
          isDark={isDark}
          title={bonusCoupons.title}
          subtitle={bonusCoupons.subtitle}
          swipeHint={bonusCoupons.swipeHint}
          dismissHint={bonusCoupons.dismissHint}
          emptyHint={bonusCoupons.emptyHint}
          onRequestDismiss={bonusCoupons.onRequestDismiss}
        />

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        <PlusPackageShopPanel
          embedded
          isDark={isDark}
          showRestore={false}
          title={plus.title}
          plusSlots={plus.plusSlots}
          hasPlusAvailable={plus.hasPlusAvailable}
          counterLabel={plus.counterLabel}
          expiryLabel={plus.expiryLabel}
          daysLabel={plus.daysLabel}
          buyLabel={plus.buyLabel}
          buySubtitle={plus.buySubtitle}
          restoreLabel={restore.label}
          restoreSubtitle={restore.subtitle}
          restoring={restore.restoring}
          buying={plus.buying}
          defaultExpanded={plus.defaultExpanded}
          footer={plus.footer}
          onBuy={plus.onBuy}
          onRestore={restore.onRestore}
        />

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        <InvestorProShopPanel
          embedded
          isDark={isDark}
          showRestore={false}
          title={investorPro.title}
          statusLabel={investorPro.statusLabel}
          metaLabel={investorPro.metaLabel}
          expiryLabel={investorPro.expiryLabel}
          trialBadge={investorPro.trialBadge}
          priceLine={investorPro.priceLine}
          buyLabel={investorPro.buyLabel}
          buySubtitle={investorPro.buySubtitle}
          restoreLabel={restore.label}
          restoreSubtitle={restore.subtitle}
          restoring={restore.restoring}
          buying={investorPro.buying}
          isActive={investorPro.isActive}
          defaultExpanded={investorPro.defaultExpanded}
          footer={investorPro.footer}
          onBuy={investorPro.onBuy}
          onRestore={restore.onRestore}
        />

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        <ShopRestoreRow
          isDark={isDark}
          restoreLabel={restore.label}
          restoreSubtitle={restore.subtitle}
          restoring={restore.restoring}
          onRestore={restore.onRestore}
        />
      </ProfileCardShell>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  restoreIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBody: { flex: 1, paddingRight: 4 },
  restoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  restoreSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    lineHeight: 16,
  },
});
