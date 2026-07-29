import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Thin bridge demoted — open the offer directly. */
export default function DiscoveryBridgeScreen({ navigation, route }: any) {
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
