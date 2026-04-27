import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';

const API_URL = 'https://estateos.pl';
const { width } = Dimensions.get('window');
const MAX_IMAGES = 15;

type EditableImage = {
  uri: string;
  isRemote: boolean;
  serverPath?: string;
};

export default function EditOfferScreen({ route }: any) {
  const { offerId } = route.params;
  const navigation = useNavigation<any>();
  const { user, token } = useAuthStore() as any;
  const themeMode = useThemeStore(s => s.themeMode);
  
  // --- APPLE COLOR PALETTE ---
  const isDark = themeMode === 'dark';
  const bgColor = isDark ? '#000000' : '#F2F2F7'; // iOS Grouped Background
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const txtColor = isDark ? '#FFFFFF' : '#000000';
  const subColor = '#8E8E93';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const primaryColor = '#007AFF';
  const destructiveColor = '#FF3B30';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [originalData, setOriginalData] = useState<any>(null);

  // --- ZMIENNE FORMULARZA ---
  const [images, setImages] = useState<EditableImage[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Nowe parametry
  const [area, setArea] = useState('');
  const [rooms, setRooms] = useState('');
  const [floor, setFloor] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');

  const [price, setPrice] = useState('');
  const [adminFee, setAdminFee] = useState('');
  const [condition, setCondition] = useState('READY');
  const [isExactLocation, setIsExactLocation] = useState(true);
  
  const [amenities, setAmenities] = useState({
    hasBalcony: false, hasParking: false, hasStorage: false, hasElevator: false, hasGarden: false, isFurnished: false
  });

  useEffect(() => {
    fetchOffer();
  }, []);

  const toAbsoluteImageUrl = (img: string) => (img.startsWith('/uploads') ? `${API_URL}${img}` : img);
  const toServerPath = (img: string) => (img.startsWith(`${API_URL}/uploads`) ? img.replace(API_URL, '') : img);
  const isLocalUri = (uri: string) => !uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/uploads');

  const fetchOffer = async () => {
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers?includeAll=true&userId=${user?.id || ''}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      const data = await res.json();
      if (data.success) {
        const offer = data.offers.find((o: any) => Number(o.id) === Number(offerId));
        if (offer) {
          setOriginalData(offer);
          setTitle(offer.title || '');
          setDescription(offer.description || '');
          setPrice(offer.price?.toString() || '');
          setAdminFee(offer.adminFee?.toString() || '');
          setArea(offer.area?.toString() || '');
          setRooms(offer.rooms?.toString() || '');
          setFloor(offer.floor?.toString() || '');
          setYearBuilt(offer.yearBuilt?.toString() || offer.buildYear?.toString() || '');
          setCondition(offer.condition || 'READY');
          setIsExactLocation(offer.isExactLocation === true || offer.isExactLocation === 1);
          
          // Zdjęcia
          let parsedImages: string[] = [];
          if (offer.images) {
             parsedImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
             setImages(parsedImages.map((img: string) => ({
              uri: toAbsoluteImageUrl(img),
              isRemote: true,
              serverPath: toServerPath(img),
             })));
          }

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

  // --- ZARZĄDZANIE ZDJĘCIAMI ---
  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentCount = images.length;
    if (currentCount >= MAX_IMAGES) {
      Alert.alert('Limit zdjęć', `Możesz dodać maksymalnie ${MAX_IMAGES} zdjęć.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const slotsLeft = MAX_IMAGES - currentCount;
      const newItems: EditableImage[] = result.assets.slice(0, slotsLeft).map(asset => ({
        uri: asset.uri,
        isRemote: false
      }));
      setImages(prev => [...prev, ...newItems]);
      if (result.assets.length > slotsLeft) {
        Alert.alert('Limit zdjęć', `Dodano tylko ${slotsLeft} zdjęć (maksymalnie ${MAX_IMAGES}).`);
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // --- ZAPISYWANIE ---
  const handleSave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    
    const remoteImages = images.filter(img => img.isRemote && img.serverPath).map(img => img.serverPath as string);
    const localImages = images.filter(img => !img.isRemote && isLocalUri(img.uri));

    if (!title.trim()) {
      Alert.alert("Walidacja", "Tytuł oferty nie może być pusty.");
      setSaving(false);
      return;
    }
    if (!price || Number(price) <= 0) {
      Alert.alert("Walidacja", "Podaj poprawną cenę oferty.");
      setSaving(false);
      return;
    }

    const updatePayload = {
      id: offerId,
      userId: user.id,
      title: title.trim(),
      description: description?.trim() || '',
      area: area ? Number(area) : 0,
      rooms: rooms ? Number(rooms) : null,
      floor: floor ? Number(floor) : null,
      yearBuilt: yearBuilt ? Number(yearBuilt) : null,
      price: Number(price),
      adminFee: adminFee ? Number(adminFee) : null,
      condition,
      isExactLocation,
      status: originalData?.status || 'ACTIVE',
      images: remoteImages,
      ...amenities
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

      if (!response.ok) throw new Error('Odrzucone przez serwer.');
      const saveData = await response.json().catch(() => ({}));
      if (!saveData?.success) {
        throw new Error(saveData?.message || 'Serwer odrzucił zapis.');
      }

      // Uploadujemy tylko nowe lokalne zdjęcia i podpinamy je do oferty.
      for (let i = 0; i < localImages.length; i += 1) {
        const img = localImages[i];
        let localUri = img.uri;
        let filename = localUri.split('/').pop() || `image_${Date.now()}_${i}.jpg`;
        let mimeType = 'image/jpeg';

        // iOS często daje HEIC/HEIF - backend odrzuca, więc konwersja do JPEG.
        const lower = localUri.toLowerCase();
        const isHeicLike = lower.endsWith('.heic') || lower.endsWith('.heif');
        if (isHeicLike) {
          const converted = await ImageManipulator.manipulateAsync(
            localUri,
            [],
            { format: ImageManipulator.SaveFormat.JPEG, compress: 0.88 }
          );
          localUri = converted.uri;
          filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
        } else if (!filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
          // Dla nietypowych rozszerzeń też normalizujemy nazwę do jpg.
          filename = `${filename}.jpg`;
        }

        const formData = new FormData();
        formData.append('offerId', String(offerId));
        formData.append('file', { uri: localUri, name: filename, type: mimeType } as any);
        const uploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.text();
          throw new Error(uploadErr || `Upload zdjęcia ${i + 1} nie powiódł się.`);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Zapisano", 
        "Zmiany zostały pomyślnie zapisane.",
        [{ text: "Super", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert("Błąd", e?.message || "Wystąpił problem podczas zapisywania na serwerze.");
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
          <Text style={[styles.headerTitle, { color: txtColor }]}>Edycja Oferty</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            {saving ? <ActivityIndicator size="small" color={primaryColor} /> : <Text style={[styles.headerBtnText, { color: primaryColor, fontWeight: '600' }]}>Gotowe</Text>}
          </Pressable>
        </View>
      </BlurView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* SEKCJA ZDJĘĆ - APPLE STYLE GALLERY GRID */}
          <View style={styles.sectionHeaderContainer}>
            <Text style={styles.sectionTitle}>GALERIA ZDJĘĆ</Text>
            <Text style={styles.sectionSubtitle}>{images.length} / {MAX_IMAGES}</Text>
          </View>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, padding: 12 }]}>
            <View style={styles.imageGrid}>
              <Pressable style={[styles.addImageBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]} onPress={pickImage}>
                <Ionicons name="camera" size={28} color={primaryColor} />
                <Text style={[styles.addImageText, { color: primaryColor }]}>Dodaj</Text>
              </Pressable>
              
              {images.map((img, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumbnail} contentFit="cover" transition={200} />
                  <Pressable style={styles.deleteImageBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close" size={16} color="#FFF" />
                  </Pressable>
                  {index === 0 && (
                    <View style={styles.mainPhotoBadge}>
                      <Text style={styles.mainPhotoText}>Główne</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* SEKCJA 1: INFORMACJE GŁÓWNE */}
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

          {/* SEKCJA 2: PARAMETRY (NOWE) */}
          <Text style={styles.sectionTitle}>PARAMETRY NIERUCHOMOŚCI</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Powierzchnia</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={area} onChangeText={(t) => setArea(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={subColor} />
              <Text style={styles.inputSuffix}>m²</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Liczba pokoi</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={rooms} onChangeText={(t) => setRooms(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="np. 3" placeholderTextColor={subColor} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Piętro</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={floor} onChangeText={(t) => setFloor(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={subColor} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Rok budowy</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={yearBuilt} onChangeText={(t) => setYearBuilt(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="np. 2022" placeholderTextColor={subColor} maxLength={4} />
            </View>
          </View>

          {/* SEKCJA 3: CENA I KOSZTY */}
          <Text style={styles.sectionTitle}>CENA I KOSZTY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Cena ofertowa</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={subColor} />
              <Text style={styles.inputSuffix}>PLN</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            <View style={styles.inputRowPremium}>
              <Text style={[styles.inputLabelPremium, { color: txtColor }]}>Czynsz admin.</Text>
              <TextInput style={[styles.inputRightPremium, { color: txtColor }]} value={adminFee} onChangeText={(t) => setAdminFee(t.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="0" placeholderTextColor={subColor} />
              <Text style={styles.inputSuffix}>PLN</Text>
            </View>
          </View>
          <Text style={styles.sectionFooter}>Sama zmiana ceny nie ukrywa oferty z radaru.</Text>

          {/* SEKCJA 4: STAN */}
          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>STAN WYKOŃCZENIA</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            <View style={styles.segmentContainer}>
              {(['READY', 'DEVELOPER', 'TO_RENOVATION'] as const).map(t => {
                const isActive = condition === t;
                const labels = { READY: 'Gotowe', DEVELOPER: 'Deweloperski', TO_RENOVATION: 'Do remontu' };
                return (
                  <Pressable key={t} onPress={() => { Haptics.selectionAsync(); setCondition(t); }} style={[styles.segmentBtn, isActive && { backgroundColor: isDark ? '#48484A' : '#E5E5EA', shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity:0.1, shadowRadius:2 }]}>
                    <Text style={[styles.segmentText, isActive && { color: txtColor, fontWeight: '600' }]}>{labels[t]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* SEKCJA 5: UDOGODNIENIA */}
          <Text style={styles.sectionTitle}>WYPOSAŻENIE I CECHY</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg }]}>
            
            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Balkon / Taras</Text>
              <Switch value={amenities.hasBalcony} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasBalcony: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Prywatny Ogródek</Text>
              <Switch value={amenities.hasGarden} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasGarden: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Miejsce parkingowe</Text>
              <Switch value={amenities.hasParking} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasParking: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Winda w budynku</Text>
              <Switch value={amenities.hasElevator} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasElevator: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Piwnica / Komórka</Text>
              <Switch value={amenities.hasStorage} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, hasStorage: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <View style={styles.switchRow}>
              <Text style={[styles.switchTitle, { color: txtColor }]}>Pełne umeblowanie</Text>
              <Switch value={amenities.isFurnished} onValueChange={(v) => { Haptics.selectionAsync(); setAmenities({...amenities, isFurnished: v}); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
            </View>
          </View>

          {/* LOKALIZACJA PRECYZYJNA */}
          <Text style={styles.sectionTitle}>MAPA I WIDOCZNOŚĆ</Text>
          <View style={[styles.premiumGroup, { backgroundColor: cardBg, marginBottom: 60 }]}>
            <View style={[styles.switchRow, { alignItems: 'flex-start' }]}>
              <View style={styles.switchTextGroup}>
                <Text style={[styles.switchTitle, { color: txtColor }]}>Dokładna lokalizacja</Text>
                <Text style={styles.switchSubtitle}>Ukrycie wyświetla tylko przybliżony obszar (promień 500m).</Text>
              </View>
              <Switch value={isExactLocation} onValueChange={(v) => { Haptics.selectionAsync(); setIsExactLocation(v); }} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: '#34C759' }} />
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
  headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: -0.4 },
  headerBtnText: { fontSize: 17, letterSpacing: -0.4 },
  scrollContent: { paddingTop: Platform.OS === 'ios' ? 110 : 90, paddingHorizontal: 16 },
  
  sectionHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 24, marginBottom: 6, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginBottom: 6, marginTop: 24, fontWeight: '400', textTransform: 'uppercase', letterSpacing: 0.2 },
  sectionSubtitle: { fontSize: 13, color: '#8E8E93', fontWeight: '400' },
  sectionFooter: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginTop: 8, lineHeight: 18, letterSpacing: -0.1 },
  premiumGroup: { borderRadius: 12, overflow: 'hidden' },
  
  // ZDJĘCIA SIATKA
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addImageBtn: { width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(0,122,255,0.3)' },
  addImageText: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  imageWrapper: { width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  imageThumbnail: { width: '100%', height: '100%' },
  deleteImageBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  mainPhotoBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  mainPhotoText: { color: '#FFF', fontSize: 9, fontWeight: '600', textTransform: 'uppercase' },

  inputPremium: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14, letterSpacing: -0.4 },
  textAreaPremium: { fontSize: 17, paddingHorizontal: 16, paddingVertical: 14, minHeight: 120, textAlignVertical: 'top', letterSpacing: -0.4, lineHeight: 22 },
  
  inputRowPremium: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  inputLabelPremium: { fontSize: 17, width: 140, fontWeight: '400', letterSpacing: -0.4 },
  inputRightPremium: { flex: 1, fontSize: 17, textAlign: 'right', letterSpacing: -0.4 },
  inputSuffix: { fontSize: 17, color: '#8E8E93', marginLeft: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  
  segmentContainer: { flexDirection: 'row', padding: 2, margin: 16, backgroundColor: 'rgba(150,150,150,0.12)', borderRadius: 8 },
  segmentBtn: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  segmentText: { fontSize: 13, color: '#8E8E93', fontWeight: '500', letterSpacing: -0.2 },
  
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  switchTextGroup: { flex: 1, paddingRight: 15 },
  switchTitle: { fontSize: 17, fontWeight: '400', letterSpacing: -0.4 },
  switchSubtitle: { fontSize: 13, color: '#8E8E93', marginTop: 4, lineHeight: 18 },
});