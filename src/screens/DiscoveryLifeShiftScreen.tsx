import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../components/ApplePressable';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryTheme } from '../components/discovery/discoveryTheme';
import { useIsDarkTheme } from '../store/useThemeStore';

const HINTS = ['Więcej spokoju', 'Bliżej miasta', 'Inny budżet', 'Wynajem', 'Kupno'];

export default function DiscoveryLifeShiftScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryLifeShiftInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryLifeShiftInner({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const [selected, setSelected] = useState<string[]>([]);
  const brand = isDark ? '#D4AF37' : '#B45309';
  const toggle = (hint: string) =>
    setSelected((prev) => (prev.includes(hint) ? prev.filter((value) => value !== hint) : [...prev, hint]));

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <DiscoveryScreenChrome theme={theme} onBack={goBack} />
      <Text style={[styles.kicker, { color: brand }]}>DISCOVERY™</Text>
      <Text style={[styles.title, { color: theme.text }]}>Życie mogło się przesunąć.</Text>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        To tylko hipotezy, nie nowy formularz. Najwięcej powiedzą nam Twoje kolejne wybory.
      </Text>
      <View style={styles.chips}>
        {HINTS.map((hint) => {
          const on = selected.includes(hint);
          return (
            <ApplePressable
              key={hint}
              onPress={() => toggle(hint)}
              style={[
                styles.chip,
                {
                  borderColor: on ? brand : theme.cardBorder,
                  backgroundColor: on
                    ? isDark
                      ? 'rgba(212,175,55,0.14)'
                      : 'rgba(245,158,11,0.12)'
                    : theme.card,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? brand : theme.textSecondary }]}>{hint}</Text>
            </ApplePressable>
          );
        })}
      </View>
      <ApplePressable
        style={[styles.primary, { backgroundColor: brand }]}
        onPress={() => {
          navigation.replace('EstateDiscovery');
        }}
      >
        <Text style={[styles.primaryText, { color: isDark ? '#080808' : '#FFFFFF' }]}>
          Ucz się z kolejnych wyborów
        </Text>
      </ApplePressable>
      <ApplePressable style={styles.cancel} haptic="none" onPress={goBack}>
        <Text style={[styles.cancelText, { color: theme.textMuted }]}>Anuluj</Text>
      </ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 14 },
  text: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 24 },
  chip: { borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 13 },
  chipText: { fontWeight: '700', fontSize: 13 },
  primary: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  primaryText: { fontSize: 14, fontWeight: '900' },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { fontWeight: '700', fontSize: 13 },
});
