import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home } from 'lucide-react-native';
import ApplePressable from '../components/ApplePressable';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryCard, discoveryTheme } from '../components/discovery/discoveryTheme';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import {
  fetchDiscoveryTropes,
  mutateDiscoveryTrope,
  resolveTropeOfferImage,
  submitDiscoveryVisitFeedback,
  type DiscoveryTrope,
} from '../services/discoveryService';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';
import { openDirectContactChat } from '../utils/openDirectContact';

export default function DiscoveryTropesScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryTropesInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryTropesInner({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((state) => state.token);
  const myUserId = useAuthStore((state) => Number(state.user?.id) || 0);
  const [items, setItems] = useState<DiscoveryTrope[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactOfferId, setContactOfferId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchDiscoveryTropes(token));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
  };

  const openOffer = (offerId: number) => {
    navigation.navigate('OfferDetail', { offerId });
  };

  const startOwnerChat = async (item: DiscoveryTrope) => {
    const ownerId = Number(item.offer?.userId || 0);
    if (!ownerId) {
      Alert.alert(
        'Rozmowa',
        'Nie udało się znaleźć właściciela tej oferty. Otwórz ofertę i napisz z poziomu szczegółów.',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Otwórz ofertę', onPress: () => openOffer(item.offerId) },
        ],
      );
      return;
    }
    if (myUserId > 0 && ownerId === myUserId) {
      Alert.alert('Rozmowa', 'To Twoja własna oferta — nie możesz napisać do siebie.');
      return;
    }
    setContactOfferId(item.offerId);
    try {
      await openDirectContactChat(
        navigation,
        token,
        ownerId,
        item.offer?.ownerName || undefined,
      );
    } finally {
      setContactOfferId(null);
    }
  };

  const markVisit = (item: DiscoveryTrope) => {
    Alert.alert(
      'Wizyta',
      'Czy byłeś już na miejscu przy tej ofercie?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Otwórz ofertę',
          onPress: () => openOffer(item.offerId),
        },
        {
          text: 'Tak, byłem',
          onPress: () => {
            void submitDiscoveryVisitFeedback(token, {
              offerId: item.offerId,
              visitOutcome: 'YES',
            }).then(() => reload());
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 10 }]}>
      <View style={{ paddingHorizontal: 18 }}>
        <DiscoveryScreenChrome theme={theme} onBack={goBack} />
        <Text style={[styles.kicker, { color: theme.eyebrow }]}>ESTATEOS™ INTELLIGENCE</Text>
        <Text style={[styles.title, { color: theme.text }]}>Na poważnie</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          Oferty oznaczone „na poważnie” trafiają też do ulubionych — jedna shortlista, nie drugi
          słownik tropów. Wracasz spokojnie: otwierasz, piszesz albo oznaczasz wizytę.
        </Text>
        <View
          style={[
            styles.explainCard,
            { backgroundColor: theme.accentSoft, borderColor: theme.cardAccentBorder },
          ]}
        >
          <Text style={[styles.explainTitle, { color: theme.accentText }]}>O co tu chodzi?</Text>
          <Text style={[styles.explainBody, { color: theme.textSecondary }]}>
            „Rozmowa” otwiera czat bezpośredni z właścicielem oferty. „Wizyta” zapisuje, że byłeś na
            miejscu albo prowadzi do oferty. To nie jest Dealroom negocjacji ceny.
          </Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void reload()}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            Nie ma jeszcze zapisanych tropów. Gdy oznaczysz ofertę „na poważnie”, pojawi się tutaj ze
            zdjęciem.
          </Text>
        }
        renderItem={({ item }) => {
          const offer = item.offer;
          const image = resolveTropeOfferImage(offer) || offer?.imageUrl || null;
          const chatting = contactOfferId === item.offerId;
          return (
            <ApplePressable
              style={[styles.card, discoveryCard(theme)]}
              haptic="none"
              onPress={() => openOffer(item.offerId)}
            >
              <View style={[styles.imageWrap, { backgroundColor: theme.track }]}>
                {image ? (
                  <Image source={{ uri: String(image) }} style={styles.image} contentFit="cover" />
                ) : (
                  <Home size={28} color={theme.textMuted} strokeWidth={1.8} />
                )}
              </View>
              <View style={styles.meta}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                  {offer?.title || 'Oferta niedostępna'}
                </Text>
                <Text style={[styles.location, { color: theme.textMuted }]} numberOfLines={1}>
                  {[offer?.district, offer?.city].filter(Boolean).join(' · ') || 'Polska'}
                </Text>
                {offer?.ownerName ? (
                  <Text style={[styles.owner, { color: theme.textMuted }]} numberOfLines={1}>
                    Właściciel: {offer.ownerName}
                  </Text>
                ) : null}
                <Text style={[styles.status, { color: theme.accent }]}>
                  {item.status === 'SERIOUS' || item.priority
                    ? 'WAŻNY TROP'
                    : item.visitOutcome
                      ? `WIZYTA: ${item.visitOutcome}`
                      : 'ZAPISANY TROP'}
                </Text>
                <View style={styles.actions}>
                  <ApplePressable
                    onPress={() => openOffer(item.offerId)}
                    style={[styles.action, { backgroundColor: theme.accentSoft }]}
                  >
                    <Text style={[styles.actionText, { color: theme.accentText }]}>Otwórz</Text>
                  </ApplePressable>
                  <ApplePressable
                    onPress={() => void startOwnerChat(item)}
                    disabled={chatting}
                    style={[styles.action, { backgroundColor: theme.pillBg, opacity: chatting ? 0.6 : 1 }]}
                  >
                    {chatting ? (
                      <ActivityIndicator size="small" color={theme.textSecondary} />
                    ) : (
                      <Text style={[styles.actionText, { color: theme.textSecondary }]}>Rozmowa</Text>
                    )}
                  </ApplePressable>
                  <ApplePressable
                    onPress={() => markVisit(item)}
                    style={[styles.action, { backgroundColor: theme.pillBg }]}
                  >
                    <Text style={[styles.actionText, { color: theme.textSecondary }]}>Wizyta</Text>
                  </ApplePressable>
                  {!(item.status === 'SERIOUS' || item.priority) ? (
                    <ApplePressable
                      onPress={async () => {
                        await mutateDiscoveryTrope(token, { offerId: item.offerId, action: 'SERIOUS' });
                        await reload();
                      }}
                      style={[styles.action, { backgroundColor: theme.pillBg }]}
                    >
                      <Text style={[styles.actionText, { color: theme.textSecondary }]}>Ważny</Text>
                    </ApplePressable>
                  ) : (
                    <ApplePressable
                      onPress={() =>
                        navigation.navigate('OfferDetail', { offerId: item.offerId })
                      }
                      style={[styles.action, { backgroundColor: theme.pillBg }]}
                    >
                      <Text style={[styles.actionText, { color: theme.textSecondary }]}>
                        Szczegóły
                      </Text>
                    </ApplePressable>
                  )}
                </View>
              </View>
            </ApplePressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3 },
  title: { fontSize: 30, fontWeight: '800', marginTop: 8 },
  lead: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  explainCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  explainTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  explainBody: { marginTop: 4, fontSize: 13, lineHeight: 19 },
  list: { paddingVertical: 18, gap: 12, paddingHorizontal: 18 },
  empty: { textAlign: 'center', marginTop: 40, paddingHorizontal: 12, lineHeight: 20 },
  card: {
    minHeight: 128,
    borderRadius: 22,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  imageWrap: {
    width: 112,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: 112, height: 128 },
  meta: { flex: 1, padding: 13 },
  name: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  location: { fontSize: 12, marginTop: 3 },
  owner: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: {
    minHeight: 28,
    minWidth: 64,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 11, fontWeight: '800' },
});
