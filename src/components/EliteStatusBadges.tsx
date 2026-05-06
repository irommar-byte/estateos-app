import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Crown, ShieldCheck } from 'lucide-react-native';
import { isInvestorProIdentity, isPartnerIdentity } from '../utils/partnerIdentity';

type Props = {
  subject: any;
  isDark?: boolean;
  compact?: boolean;
};

function Badge({
  icon,
  label,
  colors,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  compact: boolean;
  colors: { bg: string; border: string; text: string };
}) {
  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      {icon}
      <Text style={[styles.text, compact ? styles.textCompact : null, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export default function EliteStatusBadges({ subject, isDark = false, compact = false }: Props) {
  const showPartner = isPartnerIdentity(subject);
  const showPro = isInvestorProIdentity(subject);
  if (!showPartner && !showPro) return null;

  const partnerColors = isDark
    ? { bg: 'rgba(255,149,0,0.2)', border: 'rgba(255,159,10,0.7)', text: '#FFB340' }
    : { bg: 'rgba(255,149,0,0.12)', border: 'rgba(255,149,0,0.5)', text: '#C96C00' };
  const proTitaniumColors = isDark
    ? { bg: 'rgba(184,189,199,0.2)', border: 'rgba(202,208,219,0.72)', text: '#E4E9F2' }
    : { bg: 'rgba(124,136,152,0.12)', border: 'rgba(124,136,152,0.45)', text: '#5D6A7D' };

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      {showPartner ? (
        <Badge
          compact={compact}
          label="Partner EstateOS"
          colors={partnerColors}
          icon={<ShieldCheck size={compact ? 11 : 12} color={partnerColors.text} />}
        />
      ) : null}
      {showPro ? (
        <Badge
          compact={compact}
          label="Investor Pro"
          colors={proTitaniumColors}
          icon={<Crown size={compact ? 11 : 12} color={proTitaniumColors.text} />}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  rowCompact: {
    marginBottom: 5,
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  textCompact: {
    fontSize: 10,
  },
});
