import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { CreatePublicationRedemption } from '../../contracts/offerPublicationContract';
import type { PublicationBonusCouponOption } from '../../services/publicationBonusCoupons';
import { getCouponPurposeStripVisual } from '../../utils/profilePromoCouponUi';
import { safeIoniconName } from '../../utils/safeIoniconName';

export type PublicationChoiceConfirm =
  | { action: 'publish'; redemption: CreatePublicationRedemption }
  | { action: 'buy_plus' }
  | { action: 'cancel' };

type Props = {
  visible: boolean;
  isDark: boolean;
  title: string;
  subtitle: string;
  couponsSectionTitle: string;
  couponsEmptyHint: string;
  plusSectionTitle: string;
  plusCreditLabel: string;
  plusCreditSubtitle: string;
  buyPlusLabel: string;
  buyPlusSubtitle: string;
  publishLabel: string;
  cancelLabel: string;
  /** Gdy są kupony — krótka wskazówka nad listą (np. „najpierw kupon”). */
  couponPriorityHint?: string;
  coupons: PublicationBonusCouponOption[];
  plusSlots: number;
  hasPlusCredit: boolean;
  onConfirm: (result: PublicationChoiceConfirm) => void;
  onClose: () => void;
  /** Wewnątrz innego Modal — bez drugiego RN Modal (iOS: niewidoczna warstwa + zablokowany Profil). */
  variant?: 'modal' | 'overlay';
};

type SelectionId = `coupon:${string}` | 'plus_credit' | 'buy_plus';

function CouponRow({
  coupon,
  selected,
  isDark,
  onPress,
}: {
  coupon: PublicationBonusCouponOption;
  selected: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const isBirthday = coupon.visualTheme === 'birthday';
  const strip =
    coupon.purpose === 'publication' || coupon.purpose === 'off_market_preview' || coupon.purpose === 'generic'
      ? getCouponPurposeStripVisual(coupon.purpose ?? 'publication', isDark)
      : getCouponPurposeStripVisual('publication', isDark);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.couponRow,
        {
          backgroundColor: isBirthday
            ? isDark
              ? '#2E2234'
              : '#FFF8F2'
            : isDark
              ? '#2C2C2E'
              : '#F9F9FB',
          borderColor: selected ? '#0A84FF' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={[styles.couponIcon, { backgroundColor: coupon.iconBg }]}>
        <Ionicons name={safeIoniconName(coupon.iconName, 'sparkles')} size={20} color="#FFFFFF" />
      </View>
      <View style={styles.couponBody}>
        <Text style={[styles.couponTitle, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
          {coupon.title}
        </Text>
        <Text style={styles.couponSubtitle} numberOfLines={1}>
          {coupon.subtitle}
        </Text>
        <View style={[styles.purposeMini, { backgroundColor: strip.stripBg }]}>
          <Ionicons name={safeIoniconName(coupon.purposeIcon || strip.iconName, 'pricetag')} size={10} color="#FFF" />
          <Text style={styles.purposeMiniText}>{coupon.purposeLabel || '—'}</Text>
        </View>
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

export default function PublicationChoiceModal({
  visible,
  isDark,
  title,
  subtitle,
  couponsSectionTitle,
  couponsEmptyHint,
  plusSectionTitle,
  plusCreditLabel,
  plusCreditSubtitle,
  buyPlusLabel,
  buyPlusSubtitle,
  publishLabel,
  cancelLabel,
  couponPriorityHint,
  coupons,
  plusSlots,
  hasPlusCredit,
  onConfirm,
  onClose,
  variant = 'modal',
}: Props) {
  const defaultSelection = useMemo((): SelectionId => {
    if (coupons.length > 0) return `coupon:${coupons[0].id}`;
    if (hasPlusCredit) return 'plus_credit';
    return 'buy_plus';
  }, [coupons, hasPlusCredit]);

  const [selected, setSelected] = useState<SelectionId>(defaultSelection);

  useEffect(() => {
    if (visible) setSelected(defaultSelection);
  }, [visible, defaultSelection]);

  const panelBg = isDark ? '#1C1C1E' : '#F2F2F7';
  const cardBg = isDark ? '#2C2C2E' : '#FFFFFF';

  const handlePublish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selected.startsWith('coupon:')) {
      const id = selected.slice('coupon:'.length);
      const coupon = coupons.find((c) => c.id === id);
      if (!coupon) return;
      onConfirm({
        action: 'publish',
        redemption: {
          source: 'bonus_coupon',
          couponId: coupon.id,
          couponKind: coupon.kind,
        },
      });
      return;
    }
    if (selected === 'plus_credit' && hasPlusCredit) {
      onConfirm({ action: 'publish', redemption: { source: 'plus_credit' } });
      return;
    }
    onConfirm({ action: 'buy_plus' });
  };

  const preferCoupon = coupons.length > 0;
  const publishEnabled =
    selected.startsWith('coupon:') ||
    (selected === 'plus_credit' && hasPlusCredit) ||
    selected === 'buy_plus';

  const sheet = (
      <View style={[styles.root, { backgroundColor: panelBg }]}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
        </View>

        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cancelTop}>{cancelLabel}</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#000' }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.lead, { color: isDark ? 'rgba(235,235,245,0.6)' : '#636366' }]}>{subtitle}</Text>
          {preferCoupon && couponPriorityHint ? (
            <Text style={[styles.leadHint, { color: isDark ? '#FF9F0A' : '#C93400' }]}>
              {couponPriorityHint}
            </Text>
          ) : null}

          <Text style={styles.sectionLabel}>{couponsSectionTitle}</Text>
          {coupons.length > 0 ? (
            coupons.map((coupon) => (
              <CouponRow
                key={coupon.id}
                coupon={coupon}
                selected={selected === `coupon:${coupon.id}`}
                isDark={isDark}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelected(`coupon:${coupon.id}`);
                }}
              />
            ))
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: cardBg }]}>
              <Text style={[styles.emptyText, { color: isDark ? 'rgba(235,235,245,0.45)' : '#8E8E93' }]}>
                {couponsEmptyHint}
              </Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{plusSectionTitle}</Text>
          <View style={[styles.plusCard, { backgroundColor: cardBg, borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.28)' }]}>
            <Pressable
              disabled={!hasPlusCredit}
              onPress={() => {
                Haptics.selectionAsync();
                setSelected('plus_credit');
              }}
              style={({ pressed }) => [
                styles.plusRow,
                !hasPlusCredit && styles.plusRowDisabled,
                pressed && hasPlusCredit && { opacity: 0.85 },
              ]}
            >
              <View style={[styles.plusBadge, { backgroundColor: 'rgba(16,185,129,0.14)' }]}>
                <Text style={styles.plusBadgeNum}>{hasPlusCredit ? plusSlots : 0}</Text>
              </View>
              <View style={styles.plusRowBody}>
                <Text style={[styles.plusRowTitle, { color: isDark ? '#FFF' : '#000' }]}>{plusCreditLabel}</Text>
                <Text style={styles.plusRowSub}>{plusCreditSubtitle}</Text>
              </View>
              <View style={[styles.radio, selected === 'plus_credit' && hasPlusCredit && styles.radioOn]}>
                {selected === 'plus_credit' && hasPlusCredit ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>

            <View style={[styles.plusDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSelected('buy_plus');
              }}
              style={({ pressed }) => [styles.plusRow, pressed && { opacity: 0.88 }]}
            >
              <View style={[styles.plusBadge, { backgroundColor: 'rgba(10,132,255,0.14)' }]}>
                <Ionicons name="bag-add" size={22} color="#0A84FF" />
              </View>
              <View style={styles.plusRowBody}>
                <Text style={[styles.plusRowTitle, { color: isDark ? '#FFF' : '#000' }]}>{buyPlusLabel}</Text>
                <Text style={styles.plusRowSub}>{buyPlusSubtitle}</Text>
              </View>
              <View style={[styles.radio, selected === 'buy_plus' && styles.radioOn]}>
                {selected === 'buy_plus' ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: panelBg, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
          <Pressable
            onPress={handlePublish}
            disabled={!publishEnabled}
            style={({ pressed }) => [
              styles.publishBtn,
              { opacity: !publishEnabled ? 0.5 : pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={styles.publishBtnText}>
              {selected === 'buy_plus' ? buyPlusLabel : publishLabel}
            </Text>
          </Pressable>
        </View>
      </View>
  );

  if (!visible) return null;

  if (variant === 'overlay') {
    return (
      <View style={styles.overlayHost} pointerEvents="box-none">
        <Pressable style={styles.overlayBackdrop} onPress={onClose} accessibilityRole="button" />
        <View style={styles.overlaySheet} pointerEvents="box-none">
          {sheet}
        </View>
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlaySheet: {
    flex: 1,
  },
  root: { flex: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  handleWrap: { alignItems: 'center', paddingTop: 10 },
  handle: { width: 36, height: 5, borderRadius: 3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  cancelTop: { fontSize: 17, color: '#0A84FF', fontWeight: '600', width: 64 },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  lead: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  leadHint: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 2,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  couponIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponBody: { flex: 1, minWidth: 0 },
  couponTitle: { fontSize: 16, fontWeight: '700' },
  couponSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  purposeMini: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  purposeMiniText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: '#0A84FF' },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0A84FF' },
  emptyBox: { borderRadius: 14, padding: 16 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  plusCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  plusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  plusRowDisabled: { opacity: 0.45 },
  plusBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBadgeNum: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  plusRowBody: { flex: 1 },
  plusRowTitle: { fontSize: 16, fontWeight: '600' },
  plusRowSub: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  plusDivider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  publishBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  publishBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
