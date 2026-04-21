import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, Dimensions, Platform, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');
const Colors = { primary: '#10b981', background: '#000000', card: '#1C1C1E', text: '#FFFFFF', subtitle: '#8E8E93', danger: '#ef4444' };
const API_URL = 'https://estateos.pl';

export default function Step6_Summary({ theme }: { theme: any }) {
  const { draft, resetDraft, setCurrentStep } = useOfferStore();
  const { user, token } = useAuthStore();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');

  useFocusEffect(useCallback(() => { setCurrentStep(6); }, []));

  const handlePublish = async () => {
    if (loading) return;
    
    if (!user || !user.id || !token) {
      Alert.alert("Błąd autoryzacji", "Zaloguj się ponownie, aby opublikować ofertę.");
      return;
    }

    setLoading(true);
    setUploadProgressText('Tworzenie oferty w bazie...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const offerData = {
      userId: user.id, 
      lat: draft.lat || 52.2297,
      lng: draft.lng || 21.0122,
      title: draft.title || `${draft.propertyType === 'FLAT' ? 'Mieszkanie' : 'Nieruchomość'} w Warszawie`,
      propertyType: draft.propertyType,
      transactionType: draft.transactionType,
      condition: draft.condition || 'READY',
      city: draft.city || 'Warszawa',
      district: draft.district || 'Śródmieście',
      street: draft.street || '',
      buildingNumber: draft.buildingNumber || '',
      isExactLocation: draft.isExactLocation !== undefined ? draft.isExactLocation : true,
      
      area: draft.area || '0',          
      price: draft.price || '0',
      adminFee: draft.adminFee || null,
      deposit: draft.deposit || null,
      plotArea: draft.plotArea || null,
      rooms: draft.rooms || '0',        
      floor: draft.floor || '0',
      totalFloors: draft.totalFloors || null,
      yearBuilt: draft.yearBuilt || null,
      
      hasBalcony: draft.hasBalcony || false,
      hasElevator: draft.hasElevator || false,
      hasStorage: draft.hasStorage || false,
      hasParking: draft.hasParking || false,
      hasGarden: draft.hasGarden || false,
      isFurnished: draft.isFurnished || false,
      
      description: draft.description || '', 
      images: '[]', 
      videoUrl: draft.videoUrl || '',
      floorPlanUrl: ''
    };

    try {
      let createdOfferId = null;
      
      // 1. ZAPIS TEKSTOWY
      const response = await fetch(`${API_URL}/api/mobile/v1/offers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(offerData)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Błąd serwera przy tworzeniu oferty');
      }

      const data = await response.json();
      createdOfferId = data.offer.id;

      // 2. WGRYWANIE ZDJĘĆ
      if (createdOfferId && draft.images && draft.images.length > 0) {
        for (let i = 0; i < draft.images.length; i++) {
          let localUri = draft.images[i];
          let filename = localUri.split('/').pop() || `image_${i}.jpg`;
          let type = 'image/jpeg';

          if (localUri.toLowerCase().endsWith('.heic') || localUri.toLowerCase().endsWith('.heif')) {
            setUploadProgressText(`Konwersja zdjęcia ${i + 1} (HEIC ➜ JPG)...`);
            const manipResult = await ImageManipulator.manipulateAsync(
              localUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
            );
            localUri = manipResult.uri;
            filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText(`Wysyłanie zdjęcia ${i + 1} z ${draft.images.length}...`);

          const formData = new FormData();
          formData.append('offerId', String(createdOfferId));
          formData.append('file', { uri: localUri, name: filename, type } as any);

          const uploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
            method: 'POST',
            body: formData,
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.json().catch(() => ({ error: 'Nieznany błąd uploadu' }));
            throw new Error(`Zdjęcie ${i + 1}: ${errText.error || 'Odrzucone przez serwer'}`);
          }
        }
      }

      // 3. WGRYWANIE RZUTU NIERUCHOMOŚCI
      if (createdOfferId && draft.floorPlan) {
          let fpUri = draft.floorPlan;
          let fpName = fpUri.split('/').pop() || 'floorplan.jpg';
          
          if (fpUri.toLowerCase().endsWith('.heic') || fpUri.toLowerCase().endsWith('.heif')) {
              setUploadProgressText('Konwersja rzutu (HEIC ➜ JPG)...');
              const manip = await ImageManipulator.manipulateAsync(
                  fpUri, [], { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
              );
              fpUri = manip.uri;
              fpName = fpName.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
          }

          setUploadProgressText('Wysyłanie rzutu nieruchomości...');
          const fpFormData = new FormData();
          fpFormData.append('offerId', String(createdOfferId));
          fpFormData.append('file', { uri: fpUri, name: fpName, type: 'image/jpeg' } as any);
          fpFormData.append('isFloorPlan', 'true');

          const fpUploadRes = await fetch(`${API_URL}/api/upload/mobile`, {
              method: 'POST',
              body: fpFormData,
              headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!fpUploadRes.ok) {
            const errText = await fpUploadRes.json().catch(() => ({ error: 'Nieznany błąd rzutu' }));
            throw new Error(`Rzut: ${errText.error || 'Odrzucony przez serwer'}`);
          }
      }

      // 4. SUKCES
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Gratulacje! 🎉",
        "Oferta została pomyślnie dodana. Po szybkiej weryfikacji będzie widoczna na radarze.",
        [{ text: "Super", onPress: () => {
            navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Radar' }] }));
            setTimeout(() => resetDraft(), 500);
        }}]
      );

    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Błąd', error.message || 'Wystąpił problem z połączeniem.');
    } finally {
      setLoading(false);
      setUploadProgressText('');
    }
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const InfoBadge = ({ label, value }: { label: string, value: string }) => {
    if (!value) return null;
    return (
      <View style={styles.badgeContainer}>
        <Text style={styles.badgeLabel}>{label}</Text>
        <Text style={styles.badgeValue}>{value}</Text>
      </View>
    );
  };

  const DetailRow = ({ icon, label, value }: { icon: any, label: string, value: string }) => {
    if (!value) return null;
    return (
      <View style={styles.detailRow}>
        <View style={styles.detailIconBox}><Ionicons name={icon} size={18} color={Colors.primary} /></View>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190 }}>
        <View style={styles.headerTop}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={Colors.text} />
          </Pressable>
          <View style={{ flex: 1, paddingRight: 28 }}>
            <Text style={styles.stepIndicator}>KROK 6 Z 6: PUBLIKACJA</Text>
            <View style={styles.progressLine}><View style={styles.progressFill} /></View>
          </View>
        </View>

        <View style={styles.mediaSection}>
          {draft.images && draft.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.85 + 15} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 20 }}>
              {draft.images.map((uri: string, idx: number) => (
                <View key={idx} style={styles.imageWrapper}>
                  <Image source={{ uri }} style={styles.carouselImage} resizeMode="cover" />
                  <View style={styles.imageVignette} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.carouselImage, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', marginLeft: 20, borderWidth: 1, borderColor: '#333' }]}>
              <Ionicons name="images-outline" size={50} color={Colors.subtitle} />
              <Text style={{ marginTop: 10, color: Colors.subtitle, fontWeight: '600' }}>Brak zdjęć w ofercie</Text>
            </View>
          )}
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.premiumCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <View>
                <Text style={styles.priceLarge}>{parseInt(draft.price || "0").toLocaleString("pl-PL")} <Text style={{ fontSize: 22, color: Colors.subtitle }}>PLN</Text></Text>
                {draft.transactionType === 'RENT' && draft.rent ? <Text style={styles.rentText}>+ {draft.rent} PLN czynsz adm.</Text> : null}
              </View>
              <View style={[styles.typePill, { backgroundColor: draft.transactionType === 'RENT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.typePillText, { color: draft.transactionType === 'RENT' ? '#60a5fa' : '#34d399' }]}>
                  {draft.transactionType === 'RENT' ? 'WYNAJEM' : 'SPRZEDAŻ'}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <DetailRow icon="location" label="Lokalizacja" value={`${draft.city}, ${draft.district}`} />
            {draft.street ? <DetailRow icon="map" label="Adres" value={draft.street} /> : null}
          </View>

          <View style={styles.premiumCard}>
            <Text style={styles.sectionTitle}>PARAMETRY NIERUCHOMOŚCI</Text>
            <View style={styles.gridBox}>
              <InfoBadge label="Typ" value={draft.propertyType === 'FLAT' ? 'Mieszkanie' : draft.propertyType === 'HOUSE' ? 'Dom' : draft.propertyType === 'PLOT' ? 'Działka' : draft.propertyType} />
              <InfoBadge label="Powierzchnia" value={draft.area ? `${draft.area} m²` : ''} />
              <InfoBadge label="Pokoje" value={draft.rooms ? `${draft.rooms} pok.` : ''} />
              <InfoBadge label="Piętro" value={draft.floor} />
            </View>
          </View>

          {draft.description ? (
            <View style={styles.premiumCard}>
              <Text style={styles.sectionTitle}>OPIS AI / WŁASNY</Text>
              <Text style={styles.descriptionText}>{draft.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.absoluteBottom}>
        <BlurView intensity={90} tint="dark" style={styles.blurWrapper}>
          <Pressable onPress={handlePublish} disabled={loading} style={({ pressed }) => [styles.publishButton, { opacity: pressed || loading ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            {loading ? <ActivityIndicator color="#FFF" style={{ marginRight: 10 }} /> : <Ionicons name="rocket" size={20} color="#fff" style={{ marginRight: 10 }} />}
            <Text style={styles.publishButtonText}>
              {loading ? (uploadProgressText || 'Publikowanie...') : 'Opublikuj w Ekosystemie'}
            </Text>
          </Pressable>
          <Pressable onPress={handleGoBack} disabled={loading} style={({ pressed }) => [styles.editButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Text style={styles.editButtonText}>Wróć i popraw dane</Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 25 },
  backButton: { marginRight: 15, padding: 5, marginLeft: -5 },
  stepIndicator: { fontSize: 11, fontWeight: '800', color: Colors.subtitle, letterSpacing: 1.5, marginBottom: 8, textAlign: 'center' },
  progressLine: { height: 4, backgroundColor: '#333', borderRadius: 2, overflow: 'hidden' },
  progressFill: { width: '100%', height: '100%', backgroundColor: Colors.primary },
  mediaSection: { marginBottom: 20 },
  imageWrapper: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, marginRight: 15 },
  carouselImage: { width: width * 0.85, height: 260, borderRadius: 24 },
  imageVignette: { ...StyleSheet.absoluteFillObject, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.1)' },
  contentContainer: { paddingHorizontal: 20, gap: 15 },
  premiumCard: { backgroundColor: Colors.card, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  priceLarge: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  rentText: { fontSize: 14, fontWeight: '600', color: Colors.subtitle, marginTop: 4 },
  typePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  typePillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  detailIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  detailLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.subtitle },
  detailValue: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.subtitle, letterSpacing: 1.5, marginBottom: 15 },
  gridBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeContainer: { width: '48%', backgroundColor: '#2C2C2E', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.02)' },
  badgeLabel: { fontSize: 11, fontWeight: '600', color: Colors.subtitle, marginBottom: 6 },
  badgeValue: { fontSize: 16, fontWeight: '800', color: Colors.text },
  descriptionText: { fontSize: 15, lineHeight: 24, color: '#D1D1D6', fontWeight: '400' },
  absoluteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  blurWrapper: { paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 25, paddingHorizontal: 20, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 15 },
  publishButton: { backgroundColor: Colors.primary, height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 8 },
  publishButtonText: { color: '#000', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  editButton: { alignItems: 'center', paddingVertical: 5 },
  editButtonText: { color: Colors.subtitle, fontSize: 14, fontWeight: '600' }
});
