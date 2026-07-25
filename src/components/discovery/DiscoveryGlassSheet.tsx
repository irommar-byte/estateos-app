import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DISCOVERY_COLORS } from './discoveryMotion';

type Props = {
  visible: boolean;
  children: React.ReactNode;
  onDismiss?: () => void;
  transparent?: boolean;
};

export default function DiscoveryGlassSheet({ visible, children, onDismiss, transparent = true }: Props) {
  if (!visible) return null;
  return (
    <Modal transparent={transparent} visible animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Zamknij" />
        <SafeAreaView edges={['bottom']} style={styles.safe}>
          <BlurView intensity={70} tint="dark" style={styles.sheet}>
            {children}
          </BlurView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  safe: {
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
  },
  sheet: {
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: DISCOVERY_COLORS.glassBorder,
    backgroundColor: DISCOVERY_COLORS.glassDark,
    padding: 20,
  },
});
