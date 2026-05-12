import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** Czy zweryfikowany numer telefonu (SMS). */
  phoneVerified?: boolean;
  /** Czy zweryfikowany adres e-mail. */
  emailVerified?: boolean;
  /** @deprecated użyj `phoneVerified` + `emailVerified`. */
  isVerified?: boolean;
  isDark?: boolean;
  /** CTA gdy user chce dokończyć weryfikację (otwiera odpowiedni ekran). */
  onPress?: () => void;
};

export const VerificationBadge = ({ phoneVerified, emailVerified, isVerified, onPress, isDark }: Props) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Gdy nie podano nowych propsów, używamy starej ścieżki (back-compat) — ale tylko telefon.
  const phoneOk = phoneVerified ?? Boolean(isVerified);
  const emailOk = emailVerified ?? Boolean(isVerified);
  const fullyVerified = phoneOk && emailOk;
  const missingCount = (phoneOk ? 0 : 1) + (emailOk ? 0 : 1);

  useEffect(() => {
    if (!fullyVerified) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [fullyVerified]);

  if (fullyVerified) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'stretch', maxWidth: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.3)',
            flexShrink: 1,
            maxWidth: '100%',
          }}
        >
          <Ionicons name="shield-checkmark" size={16} color="#10b981" style={{ marginRight: 6 }} />
          <Text
            style={{ color: '#10b981', fontSize: 12, fontWeight: '800', letterSpacing: 0.5, flexShrink: 1 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            allowFontScaling={false}
          >
            PROFIL ZWERYFIKOWANY
          </Text>
        </View>
      </View>
    );
  }

  // Tryb pośredni — coś jest zweryfikowane, ale nie wszystko.
  if (missingCount === 1) {
    const what = !phoneOk ? 'telefon' : 'e-mail';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'stretch', maxWidth: '100%' }}>
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, flexShrink: 1, maxWidth: '100%' }]}
        >
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 159, 10, 0.12)',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(255, 159, 10, 0.4)',
              flexShrink: 1,
              maxWidth: '100%',
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9F0A', marginRight: 6 }} />
            <Text
              style={{ color: '#b25b00', fontSize: 11, fontWeight: '800', flexShrink: 1 }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              allowFontScaling={false}
            >
              WERYFIKACJA NIEPEŁNA · brak {what}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    );
  }

  // Nic nie zweryfikowane.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'stretch', maxWidth: '100%' }}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, flexShrink: 1, maxWidth: '100%' }]}
      >
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            flexShrink: 1,
            maxWidth: '100%',
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 }} />
          <Text
            style={{ color: '#ef4444', fontSize: 11, fontWeight: '800', flexShrink: 1 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            allowFontScaling={false}
          >
            NIEZWERYFIKOWANY
          </Text>
        </Animated.View>
      </Pressable>
    </View>
  );
};
