import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Building2 } from 'lucide-react-native';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/useAuthStore';

export default function AgencyPendingGate() {
  const { t } = useI18n();
  const membership = useAuthStore((s) => s.agencyMembership);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user || user.role !== 'AGENT' || !membership?.pendingApproval) return null;

  return (
    <Modal visible transparent animationType="fade">
      <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill}>
        <View style={styles.wrap}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Building2 size={28} color="#FF9F0A" />
            </View>
            <Text style={styles.title}>{t('auth.agencyPendingTitle')}</Text>
            <Text style={styles.body}>
              {t('auth.agencyPendingBody', { company: membership.companyName || user.companyName || 'biuro' })}
            </Text>
            <Text style={styles.hint}>{t('auth.agencyPendingHint')}</Text>
            <Pressable style={styles.logoutBtn} onPress={() => void logout()}>
              <Text style={styles.logoutText}>{t('auth.agencyPendingLogout')}</Text>
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,159,10,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  logoutText: {
    color: '#FF9F0A',
    fontSize: 15,
    fontWeight: '700',
  },
});
