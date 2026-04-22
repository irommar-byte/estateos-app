import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Linking, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function RadarStatus({ isDark }: { isDark: boolean }) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  // Sprawdzanie uprawnień
  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    const isGranted = status === 'granted';
    setHasPermission(isGranted);

    if (isGranted) {
      // Pigułka Sukcesu (pojawia się i znika)
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
        ]),
        Animated.delay(3500),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.spring(translateY, { toValue: -10, friction: 6, useNativeDriver: true }),
        ]),
      ]).start();
    } else {
      // Pigułka Alarmu (zostaje na ekranie)
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
      ]).start();
    }
  };

  // Nasłuchiwanie na powrót do aplikacji (np. po zmianie ustawień)
  useEffect(() => {
    checkPermissions();
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });
    return () => subscription.remove();
  }, []);

  const handleFixPermissions = () => {
    if (!hasPermission) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Linking.openSettings();
    }
  };

  // Zabezpieczenie przed miganiem podczas sprawdzania
  if (hasPermission === null) return null;

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
      <Pressable onPress={handleFixPermissions} disabled={hasPermission}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.pill, { borderColor: hasPermission ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 69, 58, 0.4)' }]}
        >
          {hasPermission ? (
            <>
              <View style={[styles.dot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.text, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}>Radar aktywny: Śledzę rynek</Text>
            </>
          ) : (
            <>
              <Ionicons name="notifications-off-outline" size={14} color="#FF453A" style={{ marginRight: 6 }} />
              <Text style={[styles.text, { color: '#FF453A' }]}>Radar uśpiony: Brak powiadomień</Text>
              <Ionicons name="chevron-forward" size={12} color="#FF453A" style={{ marginLeft: 4 }} />
            </>
          )}
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 10, // Odstęp od głównego paska nawigacji
    zIndex: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
