import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AddOfferStepper from '../../components/AddOfferStepper';

const Colors = { primary: '#10b981', danger: '#ef4444', warning: '#f59e0b' };

const formatNumber = (val: any) => {
  if (!val) return "";
  const safe = val.toString();
  return safe.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export default function Step4_Finance({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(4); }, []));

  const isDark = theme.glass === 'dark';
  const isRent = draft.transactionType === 'RENT';

  const cardBg = isDark ? '#1a1a1c' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const shadowOpacity = isDark ? 0 : 0.06;

  const priceNum = parseFloat((draft.price || "").replace(/\s/g, '')) || 0;
  const areaNum = parseFloat((draft.area || "").replace(/\s/g, '').replace(',', '.')) || 0;
  
  // W przypadku Sprzedaży (isRent === false) draft.rent przechowuje wpisany "Czynsz Admin."
  const adminFeeNum = !isRent ? (parseFloat((draft.rent || "").replace(/\s/g, '')) || 0) : 0;
  
  const pricePerSqm = areaNum > 0 ? Math.round(priceNum / areaNum) : 0;
  const avgPrice = draft.city === 'Warszawa' ? 16500 : (draft.city === 'Łódź' ? 8500 : 12000); 
  const diff = pricePerSqm - avgPrice;
  const diffPercent = avgPrice > 0 ? Math.round((diff / avgPrice) * 100) : 0;
  
  let statusText = 'W RYNKU'; let statusColor = Colors.warning; let statusIcon = 'swap-vertical-outline'; let sign = '';
  if (diffPercent <= -5) { statusText = 'OKAZJA'; statusColor = Colors.primary; statusIcon = 'trending-down-outline'; sign = ''; } 
  else if (diffPercent >= 5) { statusText = 'ZAWYŻONA'; statusColor = Colors.danger; statusIcon = 'trending-up-outline'; sign = '+'; } 
  else { sign = diffPercent > 0 ? '+' : ''; }
  
  // LOGIKA ROI (Szacowanie przychodów)
  let estimatedRentPerSqm = 60;
  if (draft.city === 'Warszawa') estimatedRentPerSqm = 85;
  else if (draft.city === 'Kraków' || draft.city === 'Wrocław' || draft.city === 'Trójmiasto') estimatedRentPerSqm = 65;
  else if (draft.city === 'Łódź' || draft.city === 'Poznań') estimatedRentPerSqm = 55;

  const estimatedMonthlyRent = areaNum * estimatedRentPerSqm;
  const netMonthlyIncome = Math.max(0, estimatedMonthlyRent - adminFeeNum); // Odejmujemy czynsz administracyjny
  const annualIncome = netMonthlyIncome * 12;

  const roi = priceNum > 0 && annualIncome > 0 ? ((annualIncome / priceNum) * 100).toFixed(2) : 0;

  const handleIncreaseSqm = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (areaNum > 0) { const step = isRent ? 5 : 100; updateDraft({ price: Math.round(priceNum + (step * areaNum)).toString() }); } };
  const handleDecreaseSqm = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); if (areaNum > 0) { const step = isRent ? 5 : 100; updateDraft({ price: Math.round(Math.max(0, priceNum - (step * areaNum))).toString() }); } };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={4} draft={draft} theme={theme} navigation={navigation} />
        <Text style={[styles.header, { color: theme.text }]}>Finanse</Text>

        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{isRent ? 'Czynsz Najmu (zł)' : 'Cena Całkowita (zł)'}</Text>
        <View style={[styles.mainInputBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 15, shadowOffset: { width: 0, height: 5 }, elevation: 2 }]}>
          <TextInput style={[styles.mainInput, { color: theme.text }]} placeholder="0" placeholderTextColor={theme.subtitle} value={formatNumber(draft.price)} onChangeText={(t) => updateDraft({ price: t.replace(/\s/g, '') })} keyboardType="numeric" maxLength={11} />
        </View>

        {!isRent && (
          <View style={styles.analyticsWrapper}>
            {priceNum > 0 && areaNum > 0 ? (
              <View style={[styles.analyticsCard, { backgroundColor: cardBg, borderColor: statusColor, shadowColor: statusColor, shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: {width:0, height:4}, elevation: 3 }]}>
                <View style={styles.analyticsRow}>
                  <Ionicons name="cash-outline" size={24} color={theme.text} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[styles.analyticsLabel, { color: theme.subtitle }]}>Cena za m²</Text>
                    <View style={styles.sqmController}>
                      <Pressable onPress={handleDecreaseSqm} style={[styles.sqmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}><Ionicons name="remove" size={14} color={theme.text} /></Pressable>
                      <Text style={[styles.analyticsValue, { color: theme.text, marginHorizontal: 8 }]}>{formatNumber(pricePerSqm.toString())} zł</Text>
                      <Pressable onPress={handleIncreaseSqm} style={[styles.sqmBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}><Ionicons name="add" size={14} color={theme.text} /></Pressable>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.statusTitle, { color: statusColor }]}>{statusText}</Text>
                  <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                    <Ionicons name={statusIcon as any} size={14} color={statusColor} />
                    <Text style={[styles.badgeText, { color: statusColor }]}>{sign}{diffPercent}% od średniej</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.analyticsCard, { backgroundColor: cardBg, borderColor: cardBorder, borderStyle: 'dashed' }]}>
                <Ionicons name="information-circle-outline" size={24} color={theme.subtitle} />
                <Text style={{ flex: 1, marginLeft: 10, color: theme.subtitle, fontSize: 13 }}>Wpisz metraż w Kroku 3 oraz cenę, aby zobaczyć i regulować analizę rynkową.</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.splitInputs}>
          <View style={styles.halfCol}>
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{isRent ? 'Kaucja' : 'Czynsz Admin.'}</Text>
            <View style={[styles.smallInputBox, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 }]}>
              <TextInput style={[styles.smallInput, { color: theme.text }]} placeholder="0" placeholderTextColor={theme.subtitle} value={formatNumber(isRent ? draft.deposit : draft.rent)} onChangeText={(t) => isRent ? updateDraft({ deposit: t.replace(/\s/g, '') }) : updateDraft({ rent: t.replace(/\s/g, '') })} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.halfCol}>
            {roi !== 0 && !isRent && (
              <View style={[styles.roiBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)', borderColor: '#3b82f6' }]}>
                <Text style={[styles.analyticsLabel, { color: '#3b82f6' }]}>Szacowane ROI</Text>
                <Text style={[styles.analyticsValue, { color: '#3b82f6', fontSize: 22 }]}>{roi}%</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 200 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 20 },
  header: { fontSize: 40, fontWeight: '800', marginBottom: 30, letterSpacing: -1.2 }, sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4 },
  mainInputBox: { height: 100, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 28, borderWidth: 1 }, mainInput: { fontSize: 40, fontWeight: '800', textAlign: 'left' },
  splitInputs: { flexDirection: 'row', gap: 15, marginTop: 30 }, halfCol: { flex: 1 }, smallInputBox: { height: 70, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 24, borderWidth: 1 }, smallInput: { fontSize: 24, fontWeight: '700' },
  analyticsWrapper: { marginTop: 15 },
  analyticsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 20, borderWidth: 1 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center' }, analyticsLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }, analyticsValue: { fontSize: 18, fontWeight: '800' },
  sqmController: { flexDirection: 'row', alignItems: 'center', marginTop: 4 }, sqmBtn: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1, textAlign: 'right' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }, badgeText: { fontSize: 12, fontWeight: '800', marginLeft: 4 },
  roiBox: { height: 70, justifyContent: 'center', alignItems: 'center', borderRadius: 20, borderWidth: 1, marginTop: 28 },
});
