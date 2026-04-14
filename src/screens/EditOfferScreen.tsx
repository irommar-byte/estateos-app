import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';

const API_URL = 'https://estateos.pl';

export default function EditOfferScreen({ route }: any) {
  const { offerId } = route.params;
  const navigation = useNavigation<any>();
  const { user, token } = useAuthStore() as any;
  const themeMode = useThemeStore(s => s.themeMode);
  
  const isDark = themeMode === 'dark';
  const bgColor = isDark ? '#000000' : '#F2F2F7';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const txtColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = '#8E8E93';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const primaryColor = '#007AFF';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  // ZMIENNE FORMULARZA
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [adminFee, setAdminFee] = useState('');
  const [condition, setCondition] = useState('READY');
  const [isExactLocation, setIsExactLocation] = useState(true);
  
  // Udogodnienia (BEZ KLIMATYZACJI I ZWIERZĄT!)
  const [amenities, setAmenities] = useState({
    hasBalcony: false, hasParking: false, hasStorage: false, hasElevator: false, hasGarden: false, isFurnished: false
  });

  useEffect(() => {
    fetchOffer();
  }, []);

  const fetchOffer = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true`);
      const data = await res.json();
      if (data.success) {
        const offer = data.offers.find((o: any) => o.id === offerId);
        if (offer) {
          setOriginalData(offer);
          setTitle(offer.title || '');
          setDescription(offer.description || '');
          setPrice(offer.price?.toString() || '');
          setAdminFee(offer.adminFee?.toString() || '');
          setCondition(offer.condition || 'READY');
          setIsExactLocation(offer.isExactLocation === true || offer.isExactLocation === 1);
          setAmenities({
            hasBalcony: isTrue(offer.hasBalcony), 
            hasParking: isTrue(offer.hasParking), 
            hasStorage: isTrue(offer.hasStorage),
            hasElevator: isTrue(offer.hasElevator), 
            hasGarden: isTrue(offer.hasGarden), 
            isFurnished: isTrue(offer.isFurnished)
          });
        }
      }
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się pobrać oferty do edycji.");
    }
    setLoading(false);
  };

  const isTrue = (val: any) => val === true || val === 'true' || val === 1;

  const requiresVerification = () => {
    if (!originalData) return false;
    if (originalData.title !== title) return true;
    if (originalData.description !== description) return true;
    if (originalData.condition !== condition) return true;
    if ((originalData.isExactLocation === true) !== isExactLocation) return true;
    if (isTrue(originalData.hasBalcony) !== amenities.hasBalcony) return true;
    if (isTrue(originalData.hasParking) !== amenities.hasParking) return true;
    if (isTrue(originalData.hasElevator) !== amenities.hasElevator) return true;
    if (isTrue(originalData.hasStorage) !== amenities.hasStorage) return true;
    if (isTrue(originalData.hasGarden) !== amenities.hasGarden) return true;
    if (isTrue(originalData.isFurnished) !== amenities.isFurnished) return true;
    return false;
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    
    const newStatus = originalData.status; // APPLE FIX: Edycja nie wymaga już ponownej weryfikacji

    const updatePayload = {
      id: offerId,
      userId: user.id,
      title,
      description,
      price: Number(price),
      adminFee: adminFee ? Number(adminFee) : null,
      condition,
      isExactLocation,
      status: newStatus,
      hasBalcony: amenities.hasBalcony,
      hasParking: amenities.hasParking,
      hasStorage: amenities.hasStorage,
      hasElevator: amenities.hasElevator,
      hasGarden: amenities.hasGarden,
      isFurnished: amenities.isFurnished
    };

    try {
      const response = await fetch(`${API_URL}/api/mobile/v1/offers`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error('Odrzucone przez serwer.');
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Zapisano", 
        newStatus === 'PENDING' ? "Zmiany zapisane. Oferta wymaga ponownej weryfikacji przez administratora." : "Zmiany zostały zapisane i są już widoczne.",
        [{ text: "Super", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Błąd", "Wystąpił problem podczas zapisywania na serwerze.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      
      {/* APPLE PREMIUM HEADER */}
      <BlurView intensity={isDark ? 80 : 100} tint={isDark ? "dark" : "light"} style={styles.headerGlass}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            <Text style={[styles.headerBtnText, { color: primaryColor, fontWeight: '400' }]}>Anuluj</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: txtColor }]}>Edycja</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            {saving ? <ActivityIndicator size="small" color={primaryColor} /> : <Text style={[styles.headerBtnText, { color: primaryColor, fontWeight: '700' }]}>Gotowe</Text>}
          </Pressable>
        </View>
      </BlurView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* SEKCJA 1: TEKSTY */}
          <Text style={styles.sectionTitle}>INFORMACJE GŁÓWNE</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <TextInput 
              style={[styles.inputPremium, { color: txtColor, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]} 
              value={title} onChangeText={setTitle} placeholder="Tytuł ogłoszenia" placeholderTextColor={subColor} 
            />
            <TextInput 
              style={[styles.textAreaPremium, { color: txtColor }]} 
              value={description} onChangeText={setDescription} placeholder="Opis nieruchomości..." placeholderTextColor={subColor} multiline 
            />
          </View>

          {/* SEKCJA 2: FINANSE */}
          <Text style={styles.sectionTitle}>CENA I KOSZTY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Cena ofertowa</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={subColor} />
              <Text style={styles.inputSuffix}>PLN</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Czynsz admin.</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={adminFee} onChangeText={(t) => setAdminFee(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" placeholderTextColor={subColor} />
              <Text style={styles.inputSuffix}>PLN</Text>
            </View>
          </View>
          <Text style={styles.sectionFooter}>Sama zmiana ceny nie ukrywa oferty z radaru.</Text>

          {/* SEKCJA 3: STAN (BEZ "NOWE") */}
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>STAN WYKOŃCZENIA</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <View style={styles.segmentContainer}>
              {(['READY', 'DEVELOPER', 'TO_RENOVATION'] as const).map(t => {
                const isActive = condition === t;
                const labels = { READY: 'Gotowe', DEVELOPER: 'Deweloperski', TO_RENOVATION: 'Do remontu' };
                return (
                  <Pressable key={t} onPress={() => { Haptics.selectionAsync(); setCondition(t); }} style={[styles.segmentBtn, isActive && { backgroundColor: isDark ? '#48484A' : '#E5E5EA', shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.1, shadowRadius:4 }]}>
                    <Text style={[styles.segmentText, isActive && { color: txtColor, fontWeight: '600' }]}>{labels[t]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SEKCJA 4: UDOGODNIENIA (APPLE SWITCHES) */}
          <Text style={styles.sectionTitle}>WYPOSAŻENIE I CECHY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            
            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Balkon / Taras</Text>
              </View>
              <Switch value={amenities.hasBalcony} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasBalcony: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Prywatny Ogródek</Text>
              </View>
              <Switch value={amenities.hasGarden} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasGarden: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Miejsce parkingowe</Text>
              </View>
              <Switch value={amenities.hasParking} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasParking: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Winda w budynku</Text>
              </View>
              <Switch value={amenities.hasElevator} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasElevator: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Piwnica / Komórka</Text>
              </View>
              <Switch value={amenities.hasStorage} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasStorage: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Pełne umeblowanie</Text>
              </View>
              <Switch value={amenities.isFurnished} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, isFurnished: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>

          </View>

          {/* LOKALIZACJA PRECYZYJNA */}
          <Text style={styles.sectionTitle}>MAPA I WIDOCZNOŚĆ</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, marginBottom: 80 }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Dokładna lokalizacja</Text>
                <Text style={styles.switchSubtitle}>Ukrycie wyświetla tylko przybliżony obszar (promień 500m).</Text>
              </View>
              <Switch value={isExactLocation} onValueChange={(v) => { Haptics.selectionAsync(); setIsExactLocation(v); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#007AFF' }} />
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGlass: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: Platform.OS === 'ios' ? 50 : 30, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(150,150,150,0.3)' },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, height: 44 },
  headerTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  headerBtnText: { fontSize: 17 },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 110 : 90, paddingHorizontal: 16 },
  
  sectionTitle: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginBottom: 6, marginTop: 24, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionFooter: { fontSize: 12, color: '#8E8E93', marginLeft: 16, marginTop: 6, lineHeight: 16 },
  premiumGroup: { borderRadius: 14, overflow: 'hidden' },
  
  inputPremium: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14 },
  textAreaPremium: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14, minHeight: 120, textAlignVertical: 'top' },
  
  inputRowPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  inputLabelPremium: { fontSize: 17, width: 120, fontWeight: '400' },
  inputRightPremium: { flex: 1, fontSize: 17, textAlign: 'right' },
  inputSuffix: { fontSize: 17, color: '#8E8E93', marginLeft: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  
  segmentContainer: { flexDirection: 'row', padding: 3, margin: 8, backgroundColor: 'rgba(150,150,150,0.12)', borderRadius: 10 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  switchTextGroup: { flex: 1, paddingRight: 15 },
  switchTitle: { fontSize: 17, fontWeight: '400' },
  switchSubtitle: { fontSize: 12, color: '#8E8E93', marginTop: 4, lineHeight: 16 },
});
