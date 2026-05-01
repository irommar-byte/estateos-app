import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Colors = { primary: '#10b981' };

type Props = {
  theme: any;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
};

/** Jednolita podpowiedź na dole kroków 1–5 dodawania oferty (styl jak hintCard w lokalizacji). */
export default function AddOfferStepFooterHint({ theme, icon = 'information-circle-outline', text }: Props) {
  const isDark = theme?.glass === 'dark' || theme?.dark;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(16,185,129,0.08)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(16,185,129,0.25)',
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={Colors.primary} style={styles.icon} />
      <Text style={[styles.body, { color: theme.subtitle }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 28,
  },
  icon: { marginTop: 1, marginRight: 10 },
  body: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
