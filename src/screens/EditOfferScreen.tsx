import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../store/useThemeStore';
import * as ImagePicker from 'expo-image-picker';

const Colors = { light: '#f5f5f7', dark: '#000000', primary: '#0071e3', textDark: '#1d1d1f', textLight: '#f5f5f7', subLight: '#86868b' };

export default function EditOfferScreen({ route, navigation }: any) {
  const { offerId } = route.params;
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';
  const bgColor = isDark ? Colors.dark : Colors.light;
  const txtColor = isDark ? Colors.textLight : Colors.textDark;
  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

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
  const [images, setImages] = useState<string[]>([]);
  const [floorPlanUrl, setFloorPlanUrl] = useState('');
  
  // Udogodnienia
  const [amenities, setAmenities] = useState({
    hasBalcony: false, hasParking: false, hasStorage: false, hasElevator: false, hasGarden: false, isFurnished: false, petsAllowed: false, airConditioning: false
  });

  useEffect(() => {
    fetchOffer();
  }, []);

  const fetchOffer = async () => {
    try {
      const res = await fetch(`https://estateos.pl/api/mobile/v1/offers?includeAll=true`);
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
          setFloorPlanUrl(offer.floorPlanUrl || '');
          setAmenities({
            hasBalcony: isTrue(offer.hasBalcony), hasParking: isTrue(offer.hasParking), hasStorage: isTrue(offer.hasStorage),
            hasElevator: isTrue(offer.hasElevator), hasGarden: isTrue(offer.hasGarden), isFurnished: isTrue(offer.isFurnished),
            petsAllowed: isTrue(offer.petsAllowed), airConditioning: isTrue(offer.airConditioning)
          });
          let parsedImgs = [];
          try { parsedImgs = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images; } catch (e) {}
          setImages(parsedImgs || []);
        }
      }
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się pobrać oferty");
    }
    setLoading(false);
  };

  const isTrue = (val: any) => val === true || val === 'true' || val === 1;

  // SYSTEM WERYFIKACJI
  const requiresVerification = () => {
    if (!originalData) return false;
    if (originalData.title !== title) return true;
    if (originalData.description !== description) return true;
    if (originalData.condition !== condition) return true;
    if ((originalData.isExactLocation === true) !== isExactLocation) return true;
    if (originalData.floorPlanUrl !== floorPlanUrl) return true;
    
    const origImgs = typeof originalData.images === 'string' ? JSON.parse(originalData.images) : originalData.images;
    if (origImgs?.length !== images.length) return true;

    if (isTrue(originalData.hasBalcony) !== amenities.hasBalcony) return true;
    if (isTrue(originalData.hasParking) !== amenities.hasParking) return true;
    if (isTrue(originalData.hasElevator) !== amenities.hasElevator) return true;
    if (isTrue(originalData.hasStorage) !== amenities.hasStorage) return true;

    return false;
  };

  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    const newStatus = requiresVerification() ? 'PENDING' : originalData.status;

    try {
      // Symulacja zapisu (Zastąpimy to prawdziwym zapytaniem do API po testach widoku)
      Alert.alert(
        "Zapisywanie", 
        `Nowy Status: ${newStatus}\nDane przygotowane do wysyłki.`,
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert("Błąd", "Wystąpił problem podczas zapisywania.");
    }
    setSaving(false);
  };

  const ToggleRow = ({ label, value, onValueChange }: any) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: txtColor }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#39393d', true: '#34c759' }} />
    </View>
  );

  const ConditionButton = ({ label, val }: any) => (
    <Pressable onPress={() => { Haptics.selectionAsync(); setCondition(val); }} style={[styles.condBtn, condition === val && { backgroundColor: Colors.primary, borderColor: Colors.primary }, { borderColor }]}>
      <Text style={[styles.condText, { color: condition === val ? '#fff' : txtColor }]}>{label}</Text>
    </Pressable>
  );

  if (loading) return <View style={[styles.container, { backgroundColor: bgColor, justifyContent: 'center' }]}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={20}><Text style={styles.cancelBtn}>Anuluj</Text></Pressable>
        <Text style={[styles.headerTitle, { color: txtColor }]}>Edytuj ofertę</Text>
        <Pressable onPress={handleSave} disabled={saving}>{saving ? <ActivityIndicator size="small" /> : <Text style={styles.saveBtn}>Zapisz</Text>}</Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <Text style={[styles.sectionTitle, { color: Colors.subLight }]}>INFORMACJE GŁÓWNE</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <TextInput style={[styles.input, { color: txtColor, borderBottomColor: borderColor, borderBottomWidth: 1 }]} value={title} onChangeText={setTitle} placeholder="Tytuł ogłoszenia" placeholderTextColor={Colors.subLight} />
            <TextInput style={[styles.textArea, { color: txtColor }]} value={description} onChangeText={setDescription} placeholder="Pełen opis nieruchomości..." placeholderTextColor={Colors.subLight} multiline />
          </View>

          <Text style={[styles.sectionTitle, { color: Colors.subLight }]}>FINANSE</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.inputRow}>
              <Text style={[styles.label, { color: txtColor, width: 80 }]}>Cena</Text>
              <TextInput style={[styles.inputRight, { color: txtColor }]} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" />
              <Text style={{ color: Colors.subLight, marginLeft: 10 }}>PLN</Text>
            </View>
            <View style={[styles.inputRow, { borderTopColor: borderColor, borderTopWidth: 1 }]}>
              <Text style={[styles.label, { color: txtColor, width: 80 }]}>Czynsz</Text>
              <TextInput style={[styles.inputRight, { color: txtColor }]} value={adminFee} onChangeText={(t) => setAdminFee(t.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="0" />
              <Text style={{ color: Colors.subLight, marginLeft: 10 }}>PLN</Text>
            </View>
          </View>
          <Text style={styles.note}>Zmiana samej ceny lub czynszu nie wymaga ponownej weryfikacji.</Text>

          <Text style={[styles.sectionTitle, { color: Colors.subLight }]}>STAN WYKOŃCZENIA</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 30 }}>
            <ConditionButton label="Gotowe" val="READY" />
            <ConditionButton label="Deweloperski" val="DEVELOPER" />
            <ConditionButton label="Do remontu" val="TO_RENOVATION" />
            <ConditionButton label="Nowe" val="NEW" />
          </View>

          <Text style={[styles.sectionTitle, { color: Colors.subLight }]}>UDOGODNIENIA</Text>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <ToggleRow label="Dokładna lokalizacja (Mapa)" value={isExactLocation} onValueChange={setIsExactLocation} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Balkon / Taras" value={amenities.hasBalcony} onValueChange={(v:boolean) => setAmenities({...amenities, hasBalcony: v})} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Garaż / Parking" value={amenities.hasParking} onValueChange={(v:boolean) => setAmenities({...amenities, hasParking: v})} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Winda" value={amenities.hasElevator} onValueChange={(v:boolean) => setAmenities({...amenities, hasElevator: v})} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Piwnica / Komórka" value={amenities.hasStorage} onValueChange={(v:boolean) => setAmenities({...amenities, hasStorage: v})} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Ogródek" value={amenities.hasGarden} onValueChange={(v:boolean) => setAmenities({...amenities, hasGarden: v})} />
            <View style={{ height: 1, backgroundColor: borderColor }} />
            <ToggleRow label="Klimatyzacja" value={amenities.airConditioning} onValueChange={(v:boolean) => setAmenities({...amenities, airConditioning: v})} />
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 15, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  cancelBtn: { fontSize: 17, color: Colors.primary }, saveBtn: { fontSize: 17, fontWeight: '700', color: Colors.primary },
  scroll: { paddingVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginLeft: 32, marginBottom: 8, letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: 12, marginHorizontal: 16, marginBottom: 30, overflow: 'hidden' },
  input: { fontSize: 17, padding: 16 },
  textArea: { fontSize: 17, padding: 16, minHeight: 120, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 17 }, inputRight: { flex: 1, fontSize: 17, textAlign: 'right' },
  note: { fontSize: 12, color: Colors.subLight, marginHorizontal: 32, marginTop: -20, marginBottom: 30 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  condBtn: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  condText: { fontSize: 15, fontWeight: '600' }
});
