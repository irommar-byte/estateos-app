import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Share, Alert } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { ChevronLeft, Share as ShareIcon, Heart, Maximize, MapPin, BedDouble, Bath } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const IMG_HEIGHT = 450;

export default function OfferDetail({ route, navigation }: any) {
  const offer = route?.params?.offer;
  const [isFavorite, setIsFavorite] = useState(false);

  // --- LOGIKA ZDJĘĆ ---
  let realImages: string[] = [];
  if (offer?.images) {
    try {
      // Obsługa formatu string JSON z bazy lub czystej tablicy
      realImages = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images;
    } catch (e) {
      console.log("Błąd parsowania zdjęć", e);
    }
  }

  // Jeśli brak zdjęć lub błąd, dajemy luksusowy placeholder z Unsplash
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

  // --- AKCJE PRZYCISKÓW ---
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

  const handleFavorite = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsFavorite(!isFavorite);
  };

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(scrollY.value, [-IMG_HEIGHT, 0, IMG_HEIGHT], [-IMG_HEIGHT / 2, 0, IMG_HEIGHT * 0.5], Extrapolation.CLAMP),
        },
        {
          scale: interpolate(scrollY.value, [-IMG_HEIGHT, 0], [2, 1], Extrapolation.CLAMP),
        },
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

      {/* GÓRNY PASEK - NAPRAWIONE HITBOXY I BLUR */}
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
            <Heart color={isFavorite ? "#ff3b30" : "white"} fill={isFavorite ? "#ff3b30" : "transparent"} size={20} />
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

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <BedDouble color="#1d1d1f" size={24} />
              <Text style={styles.statText}>{displayOffer.stats.beds} Pokoje</Text>
            </View>
            <View style={styles.statBox}>
              <Maximize color="#1d1d1f" size={24} />
              <Text style={styles.statText}>{displayOffer.stats.size}</Text>
            </View>
          </View>

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
        </View>
      </Animated.ScrollView>

      <View style={styles.bottomBarContainer}>
        <BlurView intensity={90} tint="light" style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomBarPrice}>{displayOffer.price}</Text>
            <Text style={styles.bottomBarSub}>Kontakt błyskawiczny</Text>
          </View>
          <TouchableOpacity style={styles.buyButton} onPress={() => Alert.alert("EstateOS", "Trwa łączenie z agentem...")}>
            <Text style={styles.buyButtonText}>Umów wizytę</Text>
          </TouchableOpacity>
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
  statsRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 15, marginBottom: 32 },
  statBox: { alignItems: 'center', backgroundColor: '#f5f5f7', padding: 16, borderRadius: 20, width: (width - 48 - 15) / 2 },
  statText: { marginTop: 8, fontSize: 13, fontWeight: '600', color: '#1d1d1f' },
  divider: { height: 1, backgroundColor: '#e5e5ea', marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1f', marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 26, color: '#424245', fontWeight: '400' },
  galleryContainer: { paddingRight: 24 },
  galleryImage: { width: width * 0.8, height: 220, borderRadius: 24, marginRight: 16 },
  bottomBarContainer: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
  bottomBarPrice: { fontSize: 18, fontWeight: '700', color: '#1d1d1f' },
  bottomBarSub: { fontSize: 12, color: '#86868b', marginTop: 2 },
  buyButton: { backgroundColor: '#0071e3', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 24 },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
