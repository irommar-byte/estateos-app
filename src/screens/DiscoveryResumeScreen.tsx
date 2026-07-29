import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

/** Ceremony demoted — resume means continue the swipe session. */
export default function DiscoveryResumeScreen({ navigation }: any) {
  useEffect(() => {
    navigation?.replace?.('EstateDiscovery');
  }, [navigation]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
