import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/useAuthStore';
import { isAgencyAgentPendingApproval } from '../../utils/agencyMembershipAccess';

/**
 * Dawniej pełnoekranowy gate (tylko wylogowanie).
 * Teraz nie blokuje aplikacji — status i ograniczenia są w profilu / przy publikacji.
 */
export default function AgencyPendingGate() {
  return null;
}

/** Lekki banner w profilu (opcjonalnie poza kartą biura). */
export function AgencyPendingProfileBanner({ isDark }: { isDark: boolean }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const membership = useAuthStore((s) => s.agencyMembership);
  const logout = useAuthStore((s) => s.logout);

  if (!isAgencyAgentPendingApproval(user, membership)) return null;

  const company = membership?.companyName || user?.companyName || t('profile.agency.fallbackCompany');
  const bg = isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,159,10,0.12)';
  const border = isDark ? 'rgba(255,159,10,0.35)' : 'rgba(255,159,10,0.28)';
  const text = isDark ? '#FFFFFF' : '#1C1C1E';
  const muted = isDark ? 'rgba(255,255,255,0.65)' : '#6C6C70';

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.iconWrap}>
        <Building2 size={22} color="#FF9F0A" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.title, { color: text }]}>{t('profile.agency.pendingTitle')}</Text>
        <Text style={[styles.body, { color: muted }]}>
          {t('profile.agency.pendingBody', { company })}
        </Text>
        <Text style={[styles.hint, { color: muted }]}>{t('profile.agency.pendingBrowseHint')}</Text>
        <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
          <Text style={styles.logoutText}>{t('auth.agencyPendingLogout')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,159,10,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  body: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  logoutBtn: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 4 },
  logoutText: { color: '#FF9F0A', fontSize: 14, fontWeight: '700' },
});
