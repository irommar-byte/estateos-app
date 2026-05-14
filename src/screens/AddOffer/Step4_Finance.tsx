import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import { useAuthStore } from '../../store/useAuthStore';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import {
  AGENT_COMMISSION_MAX_PERCENT,
  AGENT_COMMISSION_MIN_PERCENT,
  AGENT_COMMISSION_STEP_PERCENT,
  AGENT_COMMISSION_DEFAULT_PERCENT,
  AGENT_COMMISSION_ZERO_PERCENT,
  computeAgentCommissionAmount,
  formatPercentLabel,
  formatPlnAmount,
  isAgentCommissionAccount,
  isZeroCommissionPercent,
  parseAgentCommissionPercent,
  roundToQuarter,
} from '../../lib/agentCommission';

const Colors = { primary: '#10b981', danger: '#ef4444', warning: '#f59e0b' };

const formatNumber = (val: any) => {
  if (!val) return "";
  const safe = val.toString();
  return safe.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export default function Step4_Finance({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const user = useAuthStore((s) => s.user);
  const isAgent = isAgentCommissionAccount(user);
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

  const handleSecondaryAmountChange = (text: string) => {
    const value = text.replace(/\s/g, '');
    if (isRent) {
      updateDraft({ deposit: value });
      return;
    }
    // Dla sprzedaży utrzymujemy spójność obu pól (legacy rent + canonical adminFee).
    updateDraft({ rent: value, adminFee: value });
  };

  /* ============================================================
   *  PROWIZJA AGENTA — sekcja widoczna TYLKO dla user.role === 'AGENT'.
   *  Cena oferty NIE jest podnoszona — to tylko informacja dla kupującego,
   *  ile z ceny stanowi prowizję pośrednika (opłacaną agentowi BEZPOŚREDNIO
   *  po zawarciu transakcji, poza platformą).
   * ============================================================ */
  const commissionPercent = parseAgentCommissionPercent(draft.agentCommissionPercent);
  const hasCommissionSlot = commissionPercent !== null;
  const isZeroCommission = isZeroCommissionPercent(commissionPercent);
  const commissionAmount = isZeroCommission ? 0 : computeAgentCommissionAmount(priceNum, commissionPercent);
  const commissionInRange =
    commissionPercent !== null &&
    (commissionPercent === AGENT_COMMISSION_ZERO_PERCENT ||
      (commissionPercent >= AGENT_COMMISSION_MIN_PERCENT &&
        commissionPercent <= AGENT_COMMISSION_MAX_PERCENT));

  // Kolor akcentu karty: zielony dla 0% („bez prowizji"), pomarańczowy dla standardowej.
  const commissionAccent = isZeroCommission ? '#10b981' : '#FF9F0A';
  const commissionAccentBgLight = isZeroCommission ? 'rgba(16,185,129,0.12)' : 'rgba(255,159,10,0.12)';
  const commissionAccentBgStrong = isZeroCommission ? 'rgba(16,185,129,0.18)' : 'rgba(255,159,10,0.16)';
  const commissionAccentBorder = isZeroCommission ? 'rgba(16,185,129,0.55)' : 'rgba(255,159,10,0.55)';

  const handleCommissionChange = (text: string) => {
    // Akceptujemy puste / liczby z `.` lub `,` — bez agresywnej walidacji
    // w trakcie wpisywania (walidacja jest przy submitcie w Step6_Summary).
    const cleaned = text.replace(/[^0-9.,]/g, '');
    updateDraft({ agentCommissionPercent: cleaned });
  };

  /** Zmiana o ±0.25 z preserwacją "twardych" przejść:
   *   • 0% + krok dodatni → skacze do AGENT_COMMISSION_MIN_PERCENT (0.5%), nie 0.25%
   *   • 0.5% + krok ujemny → skacze do 0% (świadomy tryb „Bez prowizji"), nie 0.25% */
  const adjustCommission = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const base = commissionPercent ?? AGENT_COMMISSION_DEFAULT_PERCENT;
    if (delta > 0 && base === 0) {
      updateDraft({
        agentCommissionPercent: String(AGENT_COMMISSION_MIN_PERCENT).replace('.', ','),
      });
      return;
    }
    if (delta < 0 && base <= AGENT_COMMISSION_MIN_PERCENT) {
      updateDraft({ agentCommissionPercent: '0' });
      return;
    }
    const next = Math.max(
      AGENT_COMMISSION_MIN_PERCENT,
      Math.min(AGENT_COMMISSION_MAX_PERCENT, roundToQuarter(base + delta)),
    );
    updateDraft({ agentCommissionPercent: String(next).replace('.', ',') });
  };

  const enableDefaultCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateDraft({
      agentCommissionPercent: String(AGENT_COMMISSION_DEFAULT_PERCENT).replace('.', ','),
    });
  };

  const enableZeroCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateDraft({ agentCommissionPercent: '0' });
  };

  const clearCommission = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateDraft({ agentCommissionPercent: '' });
  };

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
              <TextInput
                style={[styles.smallInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.subtitle}
                value={formatNumber(isRent ? draft.deposit : (draft.adminFee || draft.rent))}
                onChangeText={handleSecondaryAmountChange}
                keyboardType="numeric"
              />
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

        {isAgent ? (
          <View style={styles.commissionWrap}>
            <View style={styles.commissionHeader}>
              <View
                style={[
                  styles.commissionHeaderBadge,
                  { backgroundColor: commissionAccentBgStrong, borderColor: commissionAccentBorder },
                ]}
              >
                <Ionicons
                  name={isZeroCommission ? 'gift-outline' : 'briefcase-outline'}
                  size={14}
                  color={commissionAccent}
                />
                <Text style={[styles.commissionHeaderBadgeText, { color: commissionAccent }]}>
                  EstateOS™ Agent
                </Text>
              </View>
              {hasCommissionSlot ? (
                <Pressable onPress={clearCommission} hitSlop={10} style={styles.commissionClearBtn}>
                  <Ionicons name="close-circle" size={18} color={theme.subtitle} />
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.commissionTitle, { color: theme.text }]}>
              {isZeroCommission ? 'Oferta bez prowizji' : 'Twoja prowizja'}
            </Text>
            <Text style={[styles.commissionSubtitle, { color: theme.subtitle }]}>
              {isZeroCommission ? (
                <>Kupujący nie płaci prowizji od tej oferty. Adnotacja „Bez prowizji” pojawi się na ogłoszeniu — przyciąga uwagę i buduje zaufanie.</>
              ) : (
                <>
                  Cena oferty pozostaje bez zmian. Kupujący zobaczy adnotację, że z tej ceny
                  <Text style={{ fontWeight: '800' }}> {hasCommissionSlot ? formatPercentLabel(commissionPercent!) : 'X%'} </Text>
                  stanowi Twoją prowizję — opłacaną Tobie bezpośrednio po sfinalizowaniu transakcji.{' '}
                  <Text style={{ fontWeight: '800' }}>
                    Kwota jest BRUTTO (zawiera VAT) — kupujący nie dopłaca żadnego podatku ani opłat dodatkowych.
                  </Text>
                </>
              )}
            </Text>

            {!hasCommissionSlot ? (
              <View style={styles.commissionCtaRow}>
                <Pressable
                  onPress={enableDefaultCommission}
                  style={({ pressed }) => [
                    styles.commissionAddCta,
                    {
                      flex: 1,
                      backgroundColor: isDark ? 'rgba(255,159,10,0.16)' : 'rgba(255,159,10,0.12)',
                      borderColor: 'rgba(255,159,10,0.6)',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#FF9F0A" />
                  <Text style={[styles.commissionAddCtaText, { color: '#FF9F0A' }]} numberOfLines={1}>
                    Prowizja {formatPercentLabel(AGENT_COMMISSION_DEFAULT_PERCENT)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={enableZeroCommission}
                  style={({ pressed }) => [
                    styles.commissionAddCta,
                    {
                      flex: 1,
                      backgroundColor: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                      borderColor: 'rgba(16,185,129,0.6)',
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name="gift-outline" size={20} color="#10b981" />
                  <Text style={[styles.commissionAddCtaText, { color: '#10b981' }]} numberOfLines={1}>
                    Bez prowizji
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.commissionCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: commissionInRange ? commissionAccentBorder : Colors.danger,
                    shadowColor: commissionAccent,
                    shadowOpacity: isDark ? 0.18 : 0.12,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 3,
                  },
                ]}
              >
                <View style={styles.commissionRow}>
                  <View style={styles.commissionInputCol}>
                    <Text style={[styles.commissionLabel, { color: theme.subtitle }]}>Prowizja</Text>
                    <View
                      style={[
                        styles.commissionInputBox,
                        { backgroundColor: commissionAccentBgLight, borderColor: commissionAccentBorder },
                      ]}
                    >
                      <TextInput
                        style={[styles.commissionInput, { color: theme.text }]}
                        value={String(draft.agentCommissionPercent || '')}
                        onChangeText={handleCommissionChange}
                        placeholder={String(AGENT_COMMISSION_DEFAULT_PERCENT).replace('.', ',')}
                        placeholderTextColor={theme.subtitle}
                        keyboardType="decimal-pad"
                        maxLength={5}
                      />
                      <Text style={[styles.commissionInputSuffix, { color: theme.text }]}>%</Text>
                    </View>
                    <View style={styles.commissionStepRow}>
                      <Pressable
                        onPress={() => adjustCommission(-AGENT_COMMISSION_STEP_PERCENT)}
                        style={[styles.commissionStepBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                      >
                        <Ionicons name="remove" size={16} color={theme.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => adjustCommission(AGENT_COMMISSION_STEP_PERCENT)}
                        style={[styles.commissionStepBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
                      >
                        <Ionicons name="add" size={16} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.commissionStepHint, { color: theme.subtitle }]}>
                        krok {formatPercentLabel(AGENT_COMMISSION_STEP_PERCENT)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.commissionAmountCol}>
                    <Text style={[styles.commissionLabel, { color: theme.subtitle }]} numberOfLines={1}>
                      {isZeroCommission ? 'dla kupującego' : 'z ceny ofertowej'}
                    </Text>
                    <Text
                      style={[styles.commissionAmountValue, { color: commissionAccent }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {isZeroCommission
                        ? 'BEZ PROWIZJI'
                        : commissionAmount > 0
                          ? formatPlnAmount(commissionAmount)
                          : '— PLN'}
                    </Text>
                    <Text style={[styles.commissionAmountHint, { color: theme.subtitle }]} numberOfLines={2}>
                      {isZeroCommission ? 'Kupujący nie płaci prowizji.' : 'To Twoje wynagrodzenie z transakcji.'}
                    </Text>
                  </View>
                </View>

                {!commissionInRange ? (
                  <View style={styles.commissionWarn}>
                    <Ionicons name="warning-outline" size={14} color={Colors.danger} />
                    <Text style={[styles.commissionWarnText, { color: Colors.danger }]}>
                      Prowizja musi być równa 0% (bez prowizji) lub w zakresie {formatPercentLabel(AGENT_COMMISSION_MIN_PERCENT)}–
                      {formatPercentLabel(AGENT_COMMISSION_MAX_PERCENT)}.
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        <AddOfferStepFooterHint
          theme={theme}
          icon="wallet-outline"
          text="Kwoty mają być jednoznaczne dla strony kupującej lub najemnej (w tym przy sprzedaży: czynsz administracyjny, jeśli dotyczy). Wskaźnik ceny za m² i porównanie do uproszczonej średniej służą orientacji — nie stanowią wyceny eksperckiej ani pełnej analizy rynku."
        />
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

  /* — Prowizja Agenta (Apple-style, pomarańczowy akcent) — */
  commissionWrap: { marginTop: 32 },
  commissionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  commissionHeaderBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,159,10,0.14)', borderWidth: 1, borderColor: 'rgba(255,159,10,0.4)',
  },
  commissionHeaderBadgeText: { fontSize: 11, fontWeight: '800', color: '#FF9F0A', marginLeft: 6, letterSpacing: 0.6, textTransform: 'uppercase' },
  commissionClearBtn: { padding: 4 },
  commissionTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  commissionSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  commissionCtaRow: { flexDirection: 'row', gap: 10 },
  commissionAddCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 10, borderRadius: 22, borderWidth: 1, gap: 6,
  },
  commissionAddCtaText: { fontSize: 14, fontWeight: '700' },
  commissionCard: { padding: 18, borderRadius: 24, borderWidth: 1 },
  commissionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  commissionInputCol: { flex: 1 },
  commissionAmountCol: { flex: 1, alignItems: 'flex-end' },
  commissionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  commissionInputBox: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 56, borderRadius: 18,
    borderWidth: 1,
  },
  commissionInput: { flex: 1, fontSize: 28, fontWeight: '800', padding: 0 },
  commissionInputSuffix: { fontSize: 22, fontWeight: '800', marginLeft: 4 },
  commissionStepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  commissionStepBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  commissionStepHint: { fontSize: 11, fontWeight: '600' },
  commissionAmountValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginBottom: 6 },
  commissionAmountHint: { fontSize: 11, fontWeight: '600', textAlign: 'right', maxWidth: 150 },
  commissionWarn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 },
  commissionWarnText: { fontSize: 12, fontWeight: '600', flex: 1 },
});
