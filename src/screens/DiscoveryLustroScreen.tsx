import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * Lustro folded into one Kierunek surface (DiscoveryDirection).
 * Screen kept registered for old deep links.
 */
export default function DiscoveryLustroScreen({ navigation }: any) {
  useEffect(() => {
    navigation?.replace?.('DiscoveryDirection');
  }, [navigation]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
