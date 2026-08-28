import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import ApplePressable from '../ApplePressable';
import EosSpotlightLensButton from './EosSpotlightLensButton';
import EosSpotlightModal from './EosSpotlightModal';

type Props = {
  isDark: boolean;
  lightChrome?: boolean;
  navigation: NavigationProp<Record<string, unknown>>;
};

export default function EosSpotlightHost({ isDark, lightChrome = false, navigation }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ApplePressable
        onPress={() => setOpen(true)}
        haptic="medium"
        pressScale={0.94}
        accessibilityRole="button"
        accessibilityLabel="Spotlight — szukaj ofert, agentów i biur"
        style={[
          styles.button,
          lightChrome && styles.buttonLight,
          { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)' },
        ]}
      >
        <View style={styles.lensWrap}>
          <EosSpotlightLensButton active={open} size={34} />
        </View>
      </ApplePressable>

      <EosSpotlightModal
        visible={open}
        onClose={() => setOpen(false)}
        isDark={isDark}
        navigation={navigation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonLight: {
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  lensWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
