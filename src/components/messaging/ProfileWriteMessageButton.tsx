import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../../i18n';

type Props = {
  peerName?: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'dark' | 'light';
};

export default function ProfileWriteMessageButton({
  peerName,
  onPress,
  loading = false,
  variant = 'dark',
}: Props) {
  const { t } = useI18n();
  const isDark = variant === 'dark';

  return (
    <Pressable
      onPress={() => {
        if (loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        isDark ? styles.btnDark : styles.btnLight,
        pressed && !loading && { opacity: 0.9, transform: [{ scale: 0.98 }] },
        loading && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('contact.writeA11y', { name: peerName || t('contact.peerFallback', { id: '?' }) })}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? '#000' : '#fff'} />
      ) : (
        <>
          <MessageCircle size={18} color={isDark ? '#000' : '#fff'} strokeWidth={2.2} />
          <Text style={[styles.text, { color: isDark ? '#000' : '#fff' }]}>{t('contact.write')}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  btnDark: { backgroundColor: '#34C759' },
  btnLight: { backgroundColor: '#007AFF' },
  text: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});
