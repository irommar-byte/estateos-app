import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Animated, Dimensions, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { height } = Dimensions.get('window');

interface Props {
  onAccept: () => Promise<boolean>;
}

export default function PushOnboardingSheet({ onAccept }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const isDark = useColorScheme() === 'dark';

  const translateY = useRef(new Animated.Value(height)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      const hasSeen = await AsyncStorage.getItem('hasSeenPushOnboarding');
      const { status } = await Notifications.getPermissionsAsync();

      // Pokaż, jeśli użytkownik nie widział modala i system nie ma jeszcze określonych uprawnień
      if (isMounted && !hasSeen && status === 'undetermined') {
        setIsVisible(true);

        setTimeout(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 300);

        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 40,
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

    // Opóźnienie 1.5 sekundy po zamontowaniu, aby nie "atakować" użytkownika od razu
    setTimeout(check, 1500);

    return () => { isMounted = false; };
  }, []);

  const handleClose = async (accepted: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem('hasSeenPushOnboarding', 'true');

    if (accepted) {
      await onAccept();
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
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => handleClose(false)} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }], backgroundColor: isDark ? '#1C1C1E' : '#ffffff' }]}>
        <View style={styles.dragHandle} />
        <View style={styles.iconContainer}>
          <Ionicons name="notifications-circle" size={80} color="#FF3B30" />
        </View>

        <Text style={[styles.title, { color: isDark ? '#FFF' : '#000' }]}>Sygnał z Radaru</Text>

        <Text style={[styles.subtitle, { color: isDark ? '#A1A1A6' : '#8E8E93' }]}>
          Włącz powiadomienia i pozwól AI czuwać za Ciebie. Natychmiast poinformujemy Cię o ofertach spełniających Twoje kryteria.
        </Text>

        <Pressable style={({pressed}) => [styles.primaryButton, pressed && { opacity: 0.8, transform: [{scale: 0.98}] }]} onPress={() => handleClose(true)}>
          <Text style={styles.primaryButtonText}>Włącz Powiadomienia</Text>
        </Pressable>

        <Pressable style={({pressed}) => [styles.secondaryButton, pressed && {opacity: 0.6}]} onPress={() => handleClose(false)}>
          <Text style={[styles.secondaryButtonText, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>Może później</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 99999 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 30, paddingBottom: Platform.OS === 'ios' ? 50 : 30, shadowColor: '#000', shadowOffset: {width: 0, height: -10}, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginBottom: 20, marginTop: -10 },
  iconContainer: { alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  primaryButton: { backgroundColor: '#FF3B30', paddingVertical: 18, borderRadius: 18, alignItems: 'center', marginBottom: 12, shadowColor: '#FF3B30', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.3, shadowRadius: 10 },
  primaryButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
});
