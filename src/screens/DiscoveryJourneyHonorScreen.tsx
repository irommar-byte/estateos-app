import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Ceremony demoted — honor goes to the offer or Kierunek. */
export default function DiscoveryJourneyHonorScreen({ navigation, route }: any) {
  useEffect(() => {
    const offerId = Number(route?.params?.offerId);
    if (Number.isFinite(offerId) && offerId > 0) {
      navigation?.replace?.('OfferDetail', { offerId });
      return;
    }
    navigation?.replace?.('DiscoveryDirection');
  }, [navigation, route?.params?.offerId]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
