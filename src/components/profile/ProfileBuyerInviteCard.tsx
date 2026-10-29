import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { SvgUri } from 'react-native-svg';
import ProfileCardShell from './ProfileCardShell';
import { SITE_ORIGIN } from '../../utils/offerShareLinks';

/**
 * Osobisty link agenta do formularza „Szukam nieruchomości”. Kupujący sam opisuje, czego szuka,
 * a po wysłaniu zostaje klientem tego agenta — agent dostaje powiadomienie z dopasowanymi ofertami.
 */
export default function ProfileBuyerInviteCard({ userId, isDark }: { userId: number; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const link = `${SITE_ORIGIN}/szukam/a/${userId}`;
  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? '#8E8E93' : '#6C6C70';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  const share = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Szukasz nieruchomości? Opisz w minutę, czego szukasz — poprowadzę wyszukiwanie, a dla kupującego jest to bezpłatne: ${link}`,
    }).catch(() => null);
  };

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.wrap}>
      <ProfileCardShell isDark={isDark} faceStyle={{ padding: 16 }}>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="person-add-outline" size={18} color="#34C759" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Link dla kupującego</Text>
            <Text style={[styles.sub, { color: muted }]}>
              Klient sam opisze, czego szuka, i trafi do Twojego CRM z gotowymi dopasowaniami.
            </Text>
          </View>
        </View>
        <Text style={[styles.link, { color: muted, backgroundColor: chipBg }]} numberOfLines={1}>
          {link.replace(/^https?:\/\//, '')}
        </Text>
        <View style={styles.actions}>
          <Pressable onPress={() => void share()} style={[styles.btn, styles.btnPrimary]} accessibilityRole="button">
            <Ionicons name="share-outline" size={16} color="#000" />
            <Text style={styles.btnPrimaryText}>Udostępnij</Text>
          </Pressable>
          <Pressable onPress={() => void copy()} style={[styles.btn, { backgroundColor: chipBg }]} accessibilityRole="button">
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={text} />
            <Text style={[styles.btnText, { color: text }]}>{copied ? 'Skopiowano' : 'Kopiuj'}</Text>
          </Pressable>
          <Pressable
            onPress={() => setQrOpen((v) => !v)}
            style={[styles.btn, { backgroundColor: chipBg }]}
            accessibilityRole="button"
            accessibilityLabel="Pokaż kod QR"
          >
            <Ionicons name="qr-code-outline" size={16} color={text} />
            <Text style={[styles.btnText, { color: text }]}>QR</Text>
          </Pressable>
        </View>
        {qrOpen ? (
          <View style={styles.qrWrap}>
            <View style={styles.qrFace}>
              <SvgUri uri={`${link}/qr`} width={188} height={188} />
            </View>
            <Text style={[styles.qrHint, { color: muted }]}>Kupujący skanuje aparatem i od razu wypełnia formularz.</Text>
          </View>
        ) : null}
      </ProfileCardShell>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', fontSize: 15 },
  sub: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  link: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, fontSize: 12, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
  },
  btnPrimary: { flex: 1, backgroundColor: '#34C759' },
  btnPrimaryText: { color: '#000', fontWeight: '700', fontSize: 14 },
  btnText: { fontWeight: '600', fontSize: 14 },
  qrWrap: { alignItems: 'center', marginTop: 14 },
  qrFace: { padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF' },
  qrHint: { marginTop: 8, fontSize: 12, textAlign: 'center' },
});
