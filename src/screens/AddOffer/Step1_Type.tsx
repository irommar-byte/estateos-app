import React, { useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, Animated, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };

const InteractiveProgressBar = ({ step, total, theme, navigation }: any) => (
  <View style={styles.progressContainer}>
    <Text style={[styles.progressText, { color: theme.subtitle }]}>KROK {step} Z {total}</Text>
    <View style={{ flexDirection: 'row', gap: 6, height: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <Pressable 
          key={i} 
          onPress={() => { 
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
            navigation.navigate(`Step${i + 1}`); 
          }} 
          style={{ flex: 1, borderRadius: 2, backgroundColor: i + 1 <= step ? Colors.primary : 'rgba(255,255,255,0.1)' }} 
        />
      ))}
    </View>
  </View>
);

export default function Step1_Type({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  
  useFocusEffect(useCallback(() => { setCurrentStep(1); }, []));

  const handleSelect = (key: string, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateDraft({ [key]: value });
  };

  // TWARDA BLOKADA LOGICZNA (Strict Check)
  // Sprawdzamy, czy w pamięci jest DOKŁADNIE ten konkretny string, a nie "cokolwiek"
  const isStep2Unlocked = draft.transactionType === 'SELL' || draft.transactionType === 'RENT';
  const isStep3Unlocked = isStep2Unlocked && (draft.propertyType === 'FLAT' || draft.propertyType === 'HOUSE' || draft.propertyType === 'PREMISES' || draft.propertyType === 'PLOT');

  // Animowane wartości przezroczystości (0.3 = wyszarzone, 1 = aktywne)
  const typeOpacity = useRef(new Animated.Value(isStep2Unlocked ? 1 : 0.3)).current;
  const conditionOpacity = useRef(new Animated.Value(isStep3Unlocked ? 1 : 0.3)).current;

  // Efekt Premium Apple: Płynne rozświetlenie po spełnieniu twardego warunku
  useEffect(() => {
    Animated.timing(typeOpacity, {
      toValue: isStep2Unlocked ? 1 : 0.3,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isStep2Unlocked]);

  useEffect(() => {
    Animated.timing(conditionOpacity, {
      toValue: isStep3Unlocked ? 1 : 0.3,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isStep3Unlocked]);

  const OptionCard = ({ icon, label, selected, onPress }: any) => (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.optionCard, 
        { 
          backgroundColor: selected ? Colors.primary : 'rgba(255,255,255,0.05)', 
          borderColor: selected ? Colors.primary : 'rgba(255,255,255,0.1)',
          ...(selected ? {
            shadowColor: Colors.primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 8,
            transform: [{ translateY: -2 }]
          } : {})
        }
      ]}
    >
      <Ionicons name={icon} size={26} color={selected ? '#ffffff' : theme.text} style={{ marginBottom: 10 }} />
      <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 50 }} />
        <InteractiveProgressBar step={1} total={6} theme={theme} navigation={navigation} />
        
        <Text style={styles.header}>
          <Text style={{ color: Colors.primary }}>Dodaj </Text>
          <Text style={{ color: '#ffffff' }}>ofertę</Text>
        </Text>
        
        {/* SEKCJA 1: CEL OGŁOSZENIA (Zawsze aktywny) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Od czego zaczynamy?</Text>
          <View style={styles.row}>
            <OptionCard icon="key-outline" label="Sprzedaż" selected={draft.transactionType === 'SELL'} onPress={() => handleSelect('transactionType', 'SELL')} />
            <OptionCard icon="home-outline" label="Wynajem" selected={draft.transactionType === 'RENT'} onPress={() => handleSelect('transactionType', 'RENT')} />
          </View>
        </View>

        {/* SEKCJA 2: TYP NIERUCHOMOŚCI (Twardo zablokowane i wyszarzone, dopóki nie ma kroku 1) */}
        <Animated.View 
          style={[styles.section, { opacity: typeOpacity }]} 
          pointerEvents={isStep2Unlocked ? 'auto' : 'none'}
        >
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Co oferujesz?</Text>
          <View style={styles.row}>
            <OptionCard icon="business-outline" label="Mieszkanie" selected={draft.propertyType === 'FLAT'} onPress={() => handleSelect('propertyType', 'FLAT')} />
            <OptionCard icon="home" label="Dom" selected={draft.propertyType === 'HOUSE'} onPress={() => handleSelect('propertyType', 'HOUSE')} />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <OptionCard icon="map-outline" label="Działka" selected={draft.propertyType === 'PLOT'} onPress={() => handleSelect('propertyType', 'PLOT')} />
            <OptionCard icon="cafe-outline" label="Lokal" selected={draft.propertyType === 'PREMISES'} onPress={() => handleSelect('propertyType', 'PREMISES')} />
          </View>
        </Animated.View>

        {/* SEKCJA 3: STAN WYKOŃCZENIA (Twardo zablokowane, dopóki nie ma kroku 2, a dla Działki całkiem znika) */}
        {draft.propertyType !== 'PLOT' && (
          <Animated.View 
            style={[styles.section, { opacity: conditionOpacity }]} 
            pointerEvents={isStep3Unlocked ? 'auto' : 'none'}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>W jakim jest stanie?</Text>
            <View style={styles.row}>
              <OptionCard icon="sparkles-outline" label="Gotowe" selected={draft.condition === 'READY'} onPress={() => handleSelect('condition', 'READY')} />
              <OptionCard icon="construct-outline" label="Do remontu" selected={draft.condition === 'RENOVATION'} onPress={() => handleSelect('condition', 'RENOVATION')} />
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
              <OptionCard icon="hammer-outline" label="Deweloperski" selected={draft.condition === 'DEVELOPER'} onPress={() => handleSelect('condition', 'DEVELOPER')} />
              <View style={{ flex: 1 }} />
            </View>
          </Animated.View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  progressContainer: { marginBottom: 30 },
  progressText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' },
  header: { fontSize: 42, fontWeight: '900', marginBottom: 40, letterSpacing: -1.5 },
  section: { marginBottom: 40 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 18, textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 4 },
  row: { flexDirection: 'row', gap: 12 },
  optionCard: { flex: 1, padding: 18, borderRadius: 24, borderWidth: 1.5, alignItems: 'flex-start', justifyContent: 'center' },
  optionText: { fontSize: 16, fontWeight: '700' }
});
