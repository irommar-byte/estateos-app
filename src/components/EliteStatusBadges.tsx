import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Crown, Flame, ShieldCheck } from 'lucide-react-native';
import { isAgentRoleIdentity, isInvestorProIdentity, isPartnerIdentity } from '../utils/partnerIdentity';

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

/** Jednolita czerwień, biały napis i ikona — bez animacji (rola `ADMIN`). */
const ADMIN_BADGE_RED = '#DC2626';

function AdminBadge({ compact }: { compact: boolean }) {
  return (
    <View
      style={[
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: ADMIN_BADGE_RED, borderColor: ADMIN_BADGE_RED },
      ]}
    >
      <Flame size={compact ? 12 : 13} color="#FFFFFF" strokeWidth={2.6} />
      <Text style={[styles.text, compact ? styles.textCompact : null, styles.adminText, { color: '#FFFFFF' }]}>
        ADMINISTRATOR
      </Text>
    </View>
  );
}

export default function EliteStatusBadges({ subject, isDark = false, compact = false }: Props) {
  const role = String(subject?.role || subject?.user?.role || '').trim().toUpperCase();
  const isAdmin = role === 'ADMIN';

  /* Administrator dostaje WSZYSTKIE plakietki które przysługują (Partner,
     Investor Pro) plus DODATKOWO czerwoną „ADMINISTRATOR". Pozostali widzą tylko Partner/Pro. */
  const showPartner = isAdmin || isPartnerIdentity(subject);
  const showPro = isAdmin || isInvestorProIdentity(subject);
  if (!isAdmin && !showPartner && !showPro) return null;

  // Nowa rola AGENT (mobile) → plakietka „Agent EstateOS".
  // Legacy (Partner/Agency/Broker, planType=AGENCY) → „Partner EstateOS".
  const partnerLabel = isAgentRoleIdentity(subject) ? 'Agent EstateOS' : 'Partner EstateOS';

  const partnerColors = isDark
    ? { bg: 'rgba(255,149,0,0.2)', border: 'rgba(255,159,10,0.7)', text: '#FFB340' }
    : { bg: 'rgba(255,149,0,0.12)', border: 'rgba(255,149,0,0.5)', text: '#C96C00' };
  const proTitaniumColors = isDark
    ? { bg: 'rgba(184,189,199,0.2)', border: 'rgba(202,208,219,0.72)', text: '#E4E9F2' }
    : { bg: 'rgba(124,136,152,0.12)', border: 'rgba(124,136,152,0.45)', text: '#5D6A7D' };

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      {isAdmin ? <AdminBadge compact={compact} /> : null}
      {showPartner ? (
        <Badge
          compact={compact}
          label={partnerLabel}
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

  adminText: {
    letterSpacing: 0.6,
    fontWeight: '900',
  },
});
