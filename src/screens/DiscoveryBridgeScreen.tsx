import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../components/ApplePressable';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryTheme } from '../components/discovery/discoveryTheme';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';
import { API_URL } from '../config/network';
import { openDirectContactChat } from '../utils/openDirectContact';

export default function DiscoveryBridgeScreen({ navigation, route }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryBridgeInner navigation={navigation} route={route} />
    </IntelligenceRequired>
  );
}

function DiscoveryBridgeInner({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((s) => s.token);
  const myUserId = useAuthStore((s) => Number(s.user?.id) || 0);
  const offerId = Number(route?.params?.offerId || 0);
  const [busy, setBusy] = useState(false);
  const brand = isDark ? '#D4AF37' : '#B45309';

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
  };

  const startChat = async () => {
    if (!offerId) {
      Alert.alert('Rozmowa', 'Brak oferty do rozmowy. Wróć do tropów i wybierz kartę ponownie.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json().catch(() => ({}));
      const offer = json?.offer || json?.data || json;
      const ownerId = Number(offer?.userId || offer?.user?.id || 0);
      const ownerName = offer?.user?.name || offer?.ownerName || undefined;
      if (!ownerId) {
        Alert.alert('Rozmowa', 'Nie znaleziono właściciela. Otwórz ofertę i napisz stamtąd.', [
          { text: 'Anuluj', style: 'cancel' },
          {
            text: 'Otwórz ofertę',
            onPress: () => navigation.navigate('OfferDetail', { offerId }),
          },
        ]);
        return;
      }
      if (myUserId > 0 && ownerId === myUserId) {
        Alert.alert('Rozmowa', 'To Twoja własna oferta.');
        return;
      }
      await openDirectContactChat(navigation, token, ownerId, ownerName);
    } catch {
      Alert.alert('Rozmowa', 'Nie udało się otworzyć czatu. Spróbuj z poziomu oferty.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <DiscoveryScreenChrome theme={theme} onBack={goBack} />
      <Text style={[styles.kicker, { color: brand }]}>DISCOVERY™</Text>
      <Text style={[styles.title, { color: theme.text }]}>Napisz do właściciela</Text>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        To bezpośrednia rozmowa o tej ofercie — nie Dealroom i nie lista pustych wątków. Możesz
        zapytać o prezentację, warunki albo szczegóły mieszkania.
      </Text>
      <ApplePressable
        style={[styles.primary, { backgroundColor: brand, opacity: busy ? 0.7 : 1 }]}
        disabled={busy}
        onPress={() => void startChat()}
      >
        {busy ? (
          <ActivityIndicator color={isDark ? '#080808' : '#FFFFFF'} />
        ) : (
          <Text style={[styles.primaryText, { color: isDark ? '#080808' : '#FFFFFF' }]}>
            Otwórz czat
          </Text>
        )}
      </ApplePressable>
      {offerId > 0 ? (
        <ApplePressable
          style={styles.secondary}
          haptic="none"
          onPress={() => navigation.navigate('OfferDetail', { offerId })}
        >
          <Text style={[styles.secondaryText, { color: theme.textSecondary }]}>
            Najpierw zobacz ofertę
          </Text>
        </ApplePressable>
      ) : null}
      <ApplePressable haptic="none" style={styles.cancel} onPress={goBack}>
        <Text style={[styles.cancelText, { color: theme.textMuted }]}>Anuluj</Text>
      </ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  primary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  primaryText: { fontSize: 14, fontWeight: '900' },
  secondary: { alignItems: 'center', padding: 14, marginTop: 4 },
  secondaryText: { fontSize: 13, fontWeight: '700' },
  cancel: { alignItems: 'center', padding: 15 },
  cancelText: { fontSize: 13, fontWeight: '700' },
});
