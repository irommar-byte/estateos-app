import React from 'react';
import { StyleSheet, Text } from 'react-native';
import ProfileMembershipHub from './ProfileMembershipHub';
import type { ProfilePromoCardRecord } from '../../contracts/profilePromoContract';

type Props = {
  isDark: boolean;
  sectionTitle: string;
  hubTitle: string;
  hubSubtitle: string;
  proActiveShort: string;
  proInactiveShort: string;
  creditsShort: string;
  couponsShort: string;
  proShort: string;
  publicationCredits: number;
  couponCount: number;
  hasInvestorProActive: boolean;
  defaultHubExpanded?: boolean;
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
    onBuy: () => void;
  };
  restore: {
    label: string;
    subtitle: string;
    restoring: boolean;
    onRestore: () => void;
  };
};

export default function ProfileShopSection({
  isDark,
  sectionTitle,
  hubTitle,
  hubSubtitle,
  proActiveShort,
  proInactiveShort,
  creditsShort,
  couponsShort,
  proShort,
  publicationCredits,
  couponCount,
  hasInvestorProActive,
  defaultHubExpanded,
  bonusCoupons,
  plus,
  investorPro,
  restore,
}: Props) {
  return (
    <>
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>

      <ProfileMembershipHub
        isDark={isDark}
        hubTitle={hubTitle}
        hubSubtitle={hubSubtitle}
        proActiveShort={proActiveShort}
        proInactiveShort={proInactiveShort}
        creditsShort={creditsShort}
        couponsShort={couponsShort}
        proShort={proShort}
        publicationCredits={publicationCredits}
        couponCount={couponCount}
        hasInvestorProActive={hasInvestorProActive}
        defaultExpanded={defaultHubExpanded}
        bonusCoupons={bonusCoupons}
        plus={plus}
        investorPro={investorPro}
        restore={restore}
      />
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
});
