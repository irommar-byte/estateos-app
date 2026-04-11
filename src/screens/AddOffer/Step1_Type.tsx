import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';

const Colors = { primary: '#10b981' };

const InteractiveProgressBar = ({ step, total, theme, navigation }: any) => (
  <View style={styles.progressContainer}><Text style={[styles.progressText, { color: theme.subtitle }]}>KROK {step} Z {total}</Text><View style={{ flexDirection: 'row', gap: 6, height: 4 }}>{Array.from({ length: total }).map((_, i) => (<Pressable key={i} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate(`Step${i + 1}`); }} style={{ flex: 1, borderRadius: 2, backgroundColor: i + 1 <= step ? Colors.primary : 'rgba(255,255,255,0.1)' }} />))}</View></View>
);

export default function Step1_Type({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(1); }, []));
  
  const isStep2Unlocked = !!draft.transactionType;
  const isStep3Unlocked = !!draft.propertyType;

  const anim2 = useRef(new Animated.Value(isStep2Unlocked ? 1 : 0)).current;
  const anim3 = useRef(new Animated.Value(isStep3Unlocked ? 1 : 0)).current;

  useEffect(() => { if (isStep2Unlocked) { Animated.spring(anim2, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start(); } else { anim2.setValue(0); } }, [isStep2Unlocked]);
  useEffect(() => { if (isStep3Unlocked) { Animated.spring(anim3, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start(); } else { anim3.setValue(0); } }, [isStep3Unlocked]);

  const OptionCard = ({ icon, label, selected, onPress }: any) => (
    <Pressable onPress={onPress} style={[styles.optionCard, { backgroundColor: selected ? Colors.primary : 'rgba(255,255,255,0.05)', borderColor: selected ? Colors.primary : 'rgba(255,255,255,0.1)' }]}>
      <Ionicons name={icon} size={24} color={selected ? '#ffffff' : theme.text} style={{ marginBottom: 8 }} />
      <Text style={[styles.optionText, { color: selected ? '#ffffff' : theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={{ marginTop: 50 }} />
        <InteractiveProgressBar step={1} total={6} theme={theme} navigation={navigation} />
        <Text style={[styles.header, { color: theme.text }]}>Zaczynamy</Text>
        
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Cel Ogłoszenia</Text>
          <View style={styles.row}>
            <OptionCard icon="key-outline" label="Sprzedaż" selected={draft.transactionType === 'SELL'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ transactionType: 'SELL' }); }} />
            <OptionCard icon="home-outline" label="Wynajem" selected={draft.transactionType === 'RENT'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ transactionType: 'RENT' }); }} />
          </View>
        </View>

        <Animated.View style={[styles.section, { opacity: anim2.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }), transform: [{ translateY: anim2.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]} pointerEvents={isStep2Unlocked ? 'auto' : 'none'}>
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Typ Nieruchomości</Text>
          <View style={styles.row}>
            <OptionCard icon="business-outline" label="Mieszkanie" selected={draft.propertyType === 'FLAT'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ propertyType: 'FLAT' }); }} />
            <OptionCard icon="home" label="Dom" selected={draft.propertyType === 'HOUSE'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ propertyType: 'HOUSE' }); }} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <OptionCard icon="map-outline" label="Działka" selected={draft.propertyType === 'PLOT'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ propertyType: 'PLOT' }); }} />
            <OptionCard icon="cafe-outline" label="Lokal" selected={draft.propertyType === 'PREMISES'} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ propertyType: 'PREMISES' }); }} />
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, { opacity: anim3.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }), transform: [{ translateY: anim3.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]} pointerEvents={isStep3Unlocked ? 'auto' : 'none'}>
          <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Stan Wykończenia</Text>
          <View style={styles.row}>
            <OptionCard icon="sparkles-outline" label="Gotowe" selected={draft.condition === 'READY'} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ condition: 'READY' }); setTimeout(() => navigation.navigate('Step2'), 450); }} />
            <OptionCard icon="construct-outline" label="Do remontu" selected={draft.condition === 'RENOVATION'} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ condition: 'RENOVATION' }); setTimeout(() => navigation.navigate('Step2'), 450); }} />
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <OptionCard icon="hammer-outline" label="Deweloperski" selected={draft.condition === 'DEVELOPER'} onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ condition: 'DEVELOPER' }); setTimeout(() => navigation.navigate('Step2'), 450); }} />
            <View style={{ flex: 1 }} />
          </View>
        </Animated.View>

        <View style={{ height: 160 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 20 }, progressContainer: { marginBottom: 30 }, progressText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 }, header: { fontSize: 40, fontWeight: '800', marginBottom: 40, letterSpacing: -1.2 }, section: { marginBottom: 35 }, sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4 }, row: { flexDirection: 'row', gap: 10 }, optionCard: { flex: 1, padding: 15, borderRadius: 20, borderWidth: 1, alignItems: 'flex-start', justifyContent: 'center' }, optionText: { fontSize: 15, fontWeight: '700' } });
