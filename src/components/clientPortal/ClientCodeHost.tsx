import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EntryGateScreen from '../../screens/EntryGateScreen';
import { useClientCodeEntry } from '../../lib/clientCodeEntry';

const WELCOME_SEEN_KEY = '@estateos_client_code_welcome_seen_v1';

/**
 * Okno „Mam kod od agenta” (pełny ekran w modalu) + jednorazowa, dyskretna karta powitalna
 * dla osób bez konta. Nic nie blokuje — mapa, oferty, logowanie i rejestracja działają jak dawniej.
 */
export default function ClientCodeHost({
  onClientToken,
  showWelcome,
}: {
  onClientToken: (portalToken: string) => void;
  /** pierwsze uruchomienie bez konta i bez zapamiętanego panelu */
  showWelcome: boolean;
}) {
  const visible = useClientCodeEntry((s) => s.visible);
  const open = useClientCodeEntry((s) => s.open);
  const close = useClientCodeEntry((s) => s.close);
  const insets = useSafeAreaInsets();
  const [welcome, setWelcome] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showWelcome) {
      setWelcome(false);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void AsyncStorage.getItem(WELCOME_SEEN_KEY).then((seen) => {
        if (!alive || seen) return;
        setWelcome(true);
        Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160 }).start();
      });
    }, 1600);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [showWelcome, slide]);

  const dismissWelcome = () => {
    void AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
    Animated.timing(slide, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setWelcome(false));
  };

  return (
    <>
      {welcome && !visible ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.welcomeWrap,
            {
              bottom: insets.bottom + 92,
              opacity: slide,
              transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
            },
          ]}
        >
          <View style={styles.welcome}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="key-outline" size={20} color="#D8C3A0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>Masz link albo kod od agenta?</Text>
              <Text style={styles.welcomeSub}>Otwórz swój panel klienta — bez zakładania konta.</Text>
            </View>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                dismissWelcome();
                open();
              }}
              style={styles.welcomeBtn}
            >
              <Text style={styles.welcomeBtnText}>Mam kod</Text>
            </Pressable>
            <Pressable onPress={dismissWelcome} hitSlop={12} accessibilityLabel="Nie teraz">
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.55)" />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <EntryGateScreen
            startMode="client"
            onClose={close}
            onClientToken={(token) => {
              close();
              void AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
              // Modal musi się zamknąć, zanim nawigacja pokaże panel.
              setTimeout(() => onClientToken(token), 350);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  welcomeWrap: { position: 'absolute', left: 12, right: 12, zIndex: 900, elevation: 900 },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#111214',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(216,195,160,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  welcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(216,195,160,0.12)',
  },
  welcomeTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  welcomeSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  welcomeBtn: { backgroundColor: '#D8C3A0', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  welcomeBtnText: { color: '#000', fontSize: 13, fontWeight: '800' },
});
