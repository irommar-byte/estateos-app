import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { height } = Dimensions.get('window');

/** Starszy klucz blokował ponowny onboarding przy statusie „jeszcze nie zapytano” — usuwamy przy starcie. */
const LEGACY_PUSH_ONBOARDING_SUPPRESS_KEY = 'hasSeenPushOnboarding';

interface Props {
  onAccept: () => Promise<boolean>;
}

export default function PushOnboardingSheet({ onAccept }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  /** „Może później” — tylko na czas jednej sesji; po ponownym uruchomieniu apki znów możemy zapytać (iOS: nadal undetermined). */
  const dismissedWithoutSystemPromptRef = useRef(false);

  /* Wyświetlamy przy pierwszym montowaniu przy statusie undetermined — bez cykli od Animated. */
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      await AsyncStorage.removeItem(LEGACY_PUSH_ONBOARDING_SUPPRESS_KEY);

      const { status } = await Notifications.getPermissionsAsync();

      if (
        isMounted &&
        status === 'undetermined' &&
        !dismissedWithoutSystemPromptRef.current
      ) {
        setIsVisible(true);

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    void check();

    return () => {
      isMounted = false;
    };
  }, []);
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleClose = async (accepted: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!accepted) {
      dismissedWithoutSystemPromptRef.current = true;
    }

    if (accepted) {
      await onAccept();
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'denied') {
        Alert.alert(
          'Powiadomienia',
          'Dostęp został odrzucony. Na iPhone możesz to zmienić tylko w Ustawieniach → Powiadomienia → EstateOS™.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Otwórz Ustawienia', onPress: () => void Linking.openSettings() },
          ]
        );
      }
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: height,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setIsVisible(false));
  };

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity }]} />

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications-circle" size={80} color="#10b981" />
        </View>

        <Text style={styles.title}>Bądź o krok przed rynkiem</Text>

        <Text style={styles.subtitle}>
          Włącz powiadomienia w EstateOS i zyskaj przewagę, której nie ma w żadnej innej aplikacji.
        </Text>

        <Pressable style={styles.primaryButton} onPress={() => void handleClose(true)}>
          <Text style={styles.primaryButtonText}>Włącz Powiadomienia</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={() => void handleClose(false)}>
          <Text style={styles.secondaryButtonText}>Może później</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 9999 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 30,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 30 },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { color: '#8E8E93' },
});
