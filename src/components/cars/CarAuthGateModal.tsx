import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MessageCircle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCarScreenTheme, type CarScreenColors, carCardElevation } from '../../theme/carScreenTheme';

type CarAuthGateModalProps = {
  visible: boolean;
  onClose: () => void;
  onLoginPress: () => void;
  onRegisterPress: () => void;
};

export default function CarAuthGateModal({
  visible,
  onClose,
  onLoginPress,
  onRegisterPress,
}: CarAuthGateModalProps) {
  const { colors, isDark } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(lift, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
      ]).start();
    } else {
      fade.setValue(0);
      lift.setValue(24);
    }
  }, [visible, fade, lift]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <BlurView intensity={72} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.wrap, { opacity: fade, transform: [{ translateY: lift }] }]}>
          <View style={styles.card}>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <X color={colors.muted} size={18} />
            </Pressable>
            <View style={styles.iconWrap}>
              <MessageCircle color={colors.success} size={30} />
            </View>
            <Text style={styles.title}>Zaloguj się, by napisać</Text>
            <Text style={styles.sub}>
              Aby wysłać zapytanie o auto, utwórz konto lub zaloguj się. Twoja wiadomość trafi bezpośrednio do sprzedającego.
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.primaryBtn}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onRegisterPress();
              }}
            >
              <Text style={styles.primaryLabel}>Załóż konto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.secondaryBtn}
              onPress={() => {
                void Haptics.selectionAsync();
                onLoginPress();
              }}
            >
              <Text style={styles.secondaryLabel}>Mam już konto — zaloguj</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </BlurView>
    </Modal>
  );
}

function createStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
    wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.modalCard,
      paddingHorizontal: 22,
      paddingTop: 18,
      paddingBottom: 22,
      alignItems: 'center',
      ...carCardElevation(isDark, 'md'),
    },
    closeBtn: { position: 'absolute', top: 14, right: 14, padding: 4 },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successSurfaceBg,
      borderWidth: 1,
      borderColor: colors.successSurfaceBorder,
      marginBottom: 14,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
    sub: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      marginBottom: 18,
    },
    primaryBtn: {
      width: '100%',
      borderRadius: 999,
      backgroundColor: colors.successButtonBg,
      borderWidth: 1,
      borderColor: colors.successButtonBorder,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    primaryLabel: { color: colors.successButtonText, fontSize: 15, fontWeight: '800' },
    secondaryBtn: {
      width: '100%',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 13,
      alignItems: 'center',
    },
    secondaryLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
