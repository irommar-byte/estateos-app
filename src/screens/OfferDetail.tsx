import FloorPlanViewer from '../components/FloorPlanViewer';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Share, Alert } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { ChevronLeft, Share as ShareIcon, Heart, Maximize, MapPin, BedDouble, Bath, Layers, Calendar, Pencil } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 450;
const API_URL = 'https://estateos.pl';

export default function OfferDetail({ route, navigation }: any) {
  const offer = route?.params?.offer;
  const [isFavorite, setIsFavorite] = useState(false);
  const heartScale = useSharedValue(1);
  const { user } = useAuthStore() as any;
  const isOwner = user?.id && offer?.userId === user?.id;

  // --- LOGIKA ULUBIONYCH (Trwały zapis na telefonie) ---
  useEffect(() => {
    const checkFavorite = async () => {
      if (!offer?.id) return;
      try {
        const storedFavs = await AsyncStorage.getItem('@estateos_favorites');
        if (storedFavs) {
          const favArray = JSON.parse(storedFavs);
          if (favArray.includes(offer.id)) {
            setIsFavorite(true);
          }
        }
      } catch (e) {
        console.error("Błąd odczytu ulubionych", e);
      }
    };
    checkFavorite();
  }, [offer?.id]);

  const handleFavorite = async () => {
    if (!offer?.id) return;
    
    // Animacja "bicia" serca
    heartScale.value = withSpring(1.5, { damping: 2, stiffness: 80 }, () => {
      heartScale.value = withSpring(1);
    });

    const newFavState = !isFavorite;
    setIsFavorite(newFavState);
    
    if (newFavState) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const storedFavs = await AsyncStorage.getItem('@estateos_favorites');
      let favArray = storedFavs ? JSON.parse(storedFavs) : [];
      
      if (newFavState) {
        if (!favArray.includes(offer.id)) favArray.push(offer.id);
      } else {
        favArray = favArray.filter((id: number) => id !== offer.id);
      }
      
      await AsyncStorage.setItem('@estateos_favorites', JSON.stringify(favArray));
    } catch (e) {
      console.error("Błąd zapisu ulubionych", e);
    }
  };

  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }]
  }));

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('EditOffer', { offerId: offer.id });
  };

  // --- LOGIKA ZDJĘĆ (Naprawa brakującego API_URL) ---
  let realImages: string[] = [];
  if (offer?.images) {
    try {
      const parsedImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
      // Doklejamy adres serwera do każdej ścieżki, która zaczyna się od /uploads
      realImages = parsedImages.map((img: string) => {
        if (img.startsWith('/uploads')) return `${API_URL}${img}`;
        return img;
      });
    } catch (e) {
      console.log("Błąd parsowania zdjęć", e);
    }
  }

  const imagesToShow = (realImages && realImages.length > 0) 
    ? realImages 
    : ['https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1200&auto=format&fit=crop'];

  const displayOffer = {
    title: offer?.title || 'Apartament Premium',
    price: offer?.price ? new Intl.NumberFormat('pl-PL').format(offer.price) + ' PLN' : 'Cena na zapytanie',
    location: offer?.city ? `${offer.city}, ${offer.district || ''}` : 'Warszawa',
    description: offer?.description || 'Brak opisu dla tej nieruchomości.',
    stats: { 
      beds: offer?.rooms || '-', 
      size: offer?.area ? `${offer.area} m²` : '- m²' 
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Sprawdź tę ofertę na EstateOS: ${displayOffer.title} za ${displayOffer.price}`,
        title: 'Oferta Nieruchomości',
      });
    } catch (error) {
      console.log(error);
    }
  };

  const isTrue = (v: any) => v === true || v === 1 || v === 'true' || v === '1';
  const activeAmenities = [];
  if (isTrue(offer?.hasBalcony)) activeAmenities.push('Balkon / Taras');
  if (isTrue(offer?.hasParking)) activeAmenities.push('Miejsce parkingowe');
  if (isTrue(offer?.hasElevator)) activeAmenities.push('Winda');
  if (isTrue(offer?.hasStorage)) activeAmenities.push('Piwnica / Komórka');
  if (isTrue(offer?.hasGarden)) activeAmenities.push('Ogródek');
  if (isTrue(offer?.isFurnished)) activeAmenities.push('Umeblowane');
  if (isTrue(offer?.petsAllowed)) activeAmenities.push('Zwierzęta akceptowane');
  if (isTrue(offer?.airConditioning)) activeAmenities.push('Klimatyzacja');

  const formatCondition = (cond: string) => {
    const map: any = { NEW: 'Nowe', VERY_GOOD: 'Bardzo dobry', GOOD: 'Dobry', TO_RENOVATION: 'Do remontu', DEVELOPER: 'Stan deweloperski', READY: 'Gotowe do zamieszkania' };
    return map[cond] || cond || 'Brak danych';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Brak danych';
    const d = new Date(dateString);
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.5], Extrapolation.CLAMP) },
        { scale: interpolate(scrollY.value, [-IMG_HEIGHT, 0], [2, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
        <Image
          source={{ uri: imagesToShow[0] }}
          style={styles.mainImage}
          contentFit="cover"
          transition={500}
        />
      </Animated.View>

      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.glassButton} 
          onPress={() => navigation?.goBack()}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <ChevronLeft color="white" size={24} />
        </TouchableOpacity>

        <View style={styles.topBarRight}>
          <TouchableOpacity 
            style={[styles.glassButton, { marginRight: 12 }]} 
            onPress={handleShare}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <ShareIcon color="white" size={20} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.glassButton} 
            onPress={handleFavorite}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
            <Animated.View style={animatedHeartStyle}>
               <Heart color={isFavorite ? "#ff3b30" : "white"} fill={isFavorite ? "#ff3b30" : "transparent"} size={20} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: IMG_HEIGHT - 40, paddingBottom: 150 }}
      >
        <View style={styles.contentSheet}>
          <Text style={styles.price}>{displayOffer.price}</Text>
          <Text style={styles.title}>{displayOffer.title}</Text>
          
          <View style={styles.locationRow}>
            <MapPin color="#86868b" size={16} />
            <Text style={styles.locationText}>{displayOffer.location}</Text>
          </View>

          {isOwner && (
            <TouchableOpacity style={styles.editButtonSubtle} onPress={handleEdit}>
              <Pencil color="#0071e3" size={16} strokeWidth={2.5} />
              <Text style={styles.editButtonSubtleText}>Edytuj parametry oferty</Text>
            </TouchableOpacity>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <BedDouble color="#1d1d1f" size={24} />
              <Text style={styles.statText}>{displayOffer.stats.beds} Pokoje</Text>
            </View>
            <View style={styles.statBox}>
              <Maximize color="#1d1d1f" size={24} />
              <Text style={styles.statText}>{displayOffer.stats.size}</Text>
            </View>
            <View style={styles.statBox}>
              <Layers color="#1d1d1f" size={24} />
              <Text style={styles.statText}>Piętro {offer?.floor ?? '-'}</Text>
            </View>
            <View style={styles.statBox}>
              <Calendar color="#1d1d1f" size={24} />
              <Text style={styles.statText}>Rok {offer?.yearBuilt || offer?.buildYear || offer?.year || '-'}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Szczegóły</Text>
          <View style={styles.detailsContainer}>
            <View style={[styles.detailRow, { borderTopWidth: 0 }]}><Text style={styles.detailLabel}>Stan wykończenia</Text><Text style={styles.detailValue}>{formatCondition(offer?.condition)}</Text></View>
            <View style={[styles.detailRow, { borderBottomWidth: 0 }]}><Text style={styles.detailLabel}>Na rynku od</Text><Text style={styles.detailValue}>{formatDate(offer?.createdAt)}</Text></View>
          </View>

          {activeAmenities.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Udogodnienia</Text>
              <View style={styles.amenitiesWrapper}>
                {activeAmenities.map((am, i) => (
                  <View key={i} style={styles.amenityPill}><Text style={styles.amenityText}>{am}</Text></View>
                ))}
              </View>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>O nieruchomości</Text>
          <Text style={styles.description}>{displayOffer.description}</Text>

          <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Galeria zdjęć</Text>
          <Animated.ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.8 + 16}
            decelerationRate="fast"
            contentContainerStyle={styles.galleryContainer}
          >
            {imagesToShow.map((img, idx) => (
              <Image 
                key={idx} 
                source={{ uri: img }} 
                style={styles.galleryImage} 
                contentFit="cover" 
              />
            ))}
          </Animated.ScrollView>
          <Text style={styles.offerIdText}>ID Oferty: {offer?.id}</Text>
        </View>
      </Animated.ScrollView>

      <View style={styles.bottomBarContainer}>
        <BlurView intensity={90} tint="light" style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomBarPrice}>{displayOffer.price}</Text>
            <Text style={styles.bottomBarSub}>{isOwner ? 'Twój panel zarządzania' : 'Kontakt błyskawiczny'}</Text>
          </View>
          {isOwner ? (
            <TouchableOpacity style={[styles.buyButton, { backgroundColor: '#1d1d1f' }]} onPress={handleEdit}>
              <Text style={styles.buyButtonText}>Edytuj ofertę</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.buyButton} onPress={() => Alert.alert("EstateOS", "Trwa łączenie z agentem...")}>
              <Text style={styles.buyButtonText}>Umów wizytę</Text>
            </TouchableOpacity>
          )}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  imageContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: IMG_HEIGHT },
  mainImage: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 55, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 100 },
  topBarRight: { flexDirection: 'row' },
  glassButton: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  contentSheet: { backgroundColor: '#ffffff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 800, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 },
  price: { fontSize: 34, fontWeight: '800', color: '#1d1d1f', letterSpacing: -1, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '600', color: '#1d1d1f', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  locationText: { fontSize: 15, color: '#86868b', marginLeft: 6, fontWeight: '500' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15, marginBottom: 32 },
  statBox: { alignItems: 'center', backgroundColor: '#f5f5f7', padding: 16, borderRadius: 20, width: (width - 48 - 15) / 2 },
  statText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#1d1d1f' },
  divider: { height: 1, backgroundColor: '#e5e5ea', marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1f', marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 26, color: '#424245', fontWeight: '400' },
  detailsContainer: { backgroundColor: '#f5f5f7', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 4, marginBottom: 32 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' },
  detailLabel: { color: '#86868b', fontSize: 15, fontWeight: '500' },
  detailValue: { color: '#1d1d1f', fontSize: 15, fontWeight: '600' },
  amenitiesWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  amenityPill: { backgroundColor: '#f5f5f7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)' },
  amenityText: { color: '#1d1d1f', fontSize: 14, fontWeight: '600' },
  offerIdText: { textAlign: 'center', color: '#86868b', fontSize: 12, marginTop: 40, marginBottom: 20, letterSpacing: 0.5 },
  galleryContainer: { paddingRight: 24 },
  galleryImage: { width: width * 0.8, height: 220, borderRadius: 24, marginRight: 16 },
  bottomBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
  bottomBarPrice: { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  bottomBarSub: { fontSize: 12, color: '#86868b', marginTop: 2 },
  buyButton: { backgroundColor: '#0071e3', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24 },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editButtonSubtle: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 113, 227, 0.08)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginBottom: 24, gap: 8 },
  editButtonSubtleText: { color: '#0071e3', fontSize: 14, fontWeight: '700' }
});
