import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Pressable, Platform, ScrollView, Modal, Switch, Animated, PanResponder, useColorScheme, LayoutAnimation, UIManager, TouchableOpacity, TextInput } from 'react-native';
import { Marker } from 'react-native-maps';
import MapView from 'react-native-map-clustering';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const API_URL = 'https://estateos.pl';

const BaseColors = { dark: '#1C1C1E', light: '#FFFFFF', subtitle: '#8E8E93', danger: '#FF453A' };
const ThemeColors = { RENT: '#0A84FF', SELL: '#34C759' };

// Tymczasowa baza (zostanie zaktualizowana w Kroku 2)
const CITY_DISTRICTS: Record<string, string[]> = {
  "Warszawa": ["Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów", "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz"],
  "Kraków": ["Stare Miasto", "Grzegórzki", "Krowodrza", "Nowa Huta", "Podgórze"],
  "Łódź": ["Bałuty", "Górna", "Polesie", "Śródmieście", "Widzew"],
  "Wrocław": ["Fabryczna", "Krzyki", "Psie Pole", "Stare Miasto", "Śródmieście"],
  "Trójmiasto": ["Gdańsk", "Sopot", "Gdynia"],
  "Poznań": ["Stare Miasto", "Nowe Miasto", "Jeżyce", "Grunwald", "Wilda"]
};
const CITIES = Object.keys(CITY_DISTRICTS);

const formatPriceMarker = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!num || isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.floor(num / 1000) + 'k';
  return num.toString();
};

export default function Radar({ theme }: any) {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore() as any;
  const colorScheme = useColorScheme();
  const isDark = theme?.glass === 'dark' || theme?.dark || colorScheme === 'dark';

  const mapRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);

  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAV' | 'MINE'>('ALL');
  
  const [showCalibration, setShowCalibration] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);

  const [filters, setFilters] = useState({
    transactionType: 'SELL' as 'RENT' | 'SELL', 
    propertyType: 'ALL', city: 'Warszawa', selectedDistricts: [] as string[],
    maxPrice: 5000000, minArea: 0, minYear: 1900,
    requireBalcony: false, requireGarden: false, requireElevator: false, requireParking: false, requireFurnished: false, pushNotifications: true
  });
  const [draftFilters, setDraftFilters] = useState(filters);

  // Zmienne tymczasowe dla pól input (aby sformatować po wpisaniu)
  const [inputMaxPrice, setInputMaxPrice] = useState(draftFilters.maxPrice.toString());
  const [inputMinArea, setInputMinArea] = useState(draftFilters.minArea.toString());
  const [inputMinYear, setInputMinYear] = useState(draftFilters.minYear.toString());

  const activeColor = ThemeColors[draftFilters.transactionType];

  // CINEMATIC 3D VARIABLES
  const scanSpin = useRef(new Animated.Value(0)).current;
  const scanPulse = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;
  const blipOpacity = useRef(new Animated.Value(0)).current;
  const scale3D = useRef(new Animated.Value(3)).current; 
  const tilt3D = useRef(new Animated.Value(0)).current; 
  const flashOpacity = useRef(new Animated.Value(0)).current; 

  React.useEffect(() => {
    if (!user) { setAllOffers([]); setFavorites([]); setActiveTab('ALL'); }
  }, [user]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers`);
      const data = await res.json();
      if (data.success && data.offers) setAllOffers(data.offers);
    } catch (e) {}
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchOffers(); }, []));
  useFocusEffect(useCallback(() => {
    const loadFavs = async () => { try { const f = await AsyncStorage.getItem('@estateos_favorites'); if (f) setFavorites(JSON.parse(f)); } catch (e) {} };
    loadFavs();
  }, []));

  const toggleFavorite = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newFavs = favorites.includes(id) ? favorites.filter(f => f !== id) : [...favorites, id];
    setFavorites(newFavs);
    try { await AsyncStorage.setItem('@estateos_favorites', JSON.stringify(newFavs)); } catch (e) {}
  };

  const matchesFilters = (offer: any, f: typeof filters) => {
    if (offer.transactionType !== f.transactionType) return false;
    if (f.propertyType !== 'ALL' && offer.propertyType !== f.propertyType) return false;
    if (f.city && offer.city && offer.city.toLowerCase() !== f.city.toLowerCase()) return false;
    if (f.selectedDistricts.length > 0 && offer.district && !f.selectedDistricts.includes(offer.district)) return false;
    const price = parseFloat(offer.price) || 0; if (price > f.maxPrice) return false;
    const area = parseFloat(offer.area) || 0; if (area < f.minArea) return false;
    const year = offer.yearBuilt ? parseInt(offer.yearBuilt) : 1900; if (year < f.minYear) return false;
    if (f.requireBalcony && !offer.hasBalcony) return false;
    if (f.requireGarden && !offer.hasGarden) return false;
    if (f.requireElevator && !offer.hasElevator) return false;
    if (f.requireParking && !offer.hasParking) return false;
    if (f.requireFurnished && !offer.isFurnished) return false;
    return true;
  };

  const filteredOffers = useMemo(() => {
    return allOffers.filter(offer => {
      if (!offer.lat || !offer.lng || isNaN(parseFloat(offer.lat))) return false;
      if (activeTab === 'MINE') return offer.userId === user?.id;
      if (activeTab === 'FAV') return favorites.includes(offer.id);
      return matchesFilters(offer, filters);
    });
  }, [allOffers, activeTab, favorites, filters, user]);

  const counts = useMemo(() => ({
    ALL: allOffers.filter(o => o.lat && o.lng && matchesFilters(o, filters)).length,
    FAV: allOffers.filter(o => o.lat && o.lng && favorites.includes(o.id)).length,
    MINE: user?.id ? allOffers.filter(o => o.lat && o.lng && o.userId === user.id).length : 0
  }), [allOffers, filters, favorites, user]);

  useFocusEffect(useCallback(() => {
    if (filteredOffers.length > 0) flyToMarker(filteredOffers[0]);
    setActiveIndex(0);
  }, [filteredOffers.length]));

  const flyToMarker = (offer: any) => {
    if (offer?.lat && offer?.lng && mapRef.current) {
      mapRef.current.animateCamera({ center: { latitude: parseFloat(offer.lat), longitude: parseFloat(offer.lng) }, pitch: 45, altitude: 3000, zoom: 14 }, { duration: 1000 });
    }
  };

  const handleScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / (width * 0.85 + 20));
    if (newIndex !== activeIndex && filteredOffers[newIndex]) {
      setActiveIndex(newIndex);
      Haptics.selectionAsync();
      flyToMarker(filteredOffers[newIndex]);
    }
  };

  const handleMarkerPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flatListRef.current?.scrollTo({ x: index * (width * 0.85 + 20), animated: true });
    setActiveIndex(index);
    flyToMarker(filteredOffers[index]);
    navigation.navigate("OfferDetail", { offer: filteredOffers[index] });
  };

  // --- CINEMATIC 3D RADAR ANIMATION ---
  const applyCalibration = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowCalibration(false); 
    setIsScanning(true);
    
    scale3D.setValue(3.5); 
    tilt3D.setValue(0);
    scanOpacity.setValue(1);
    flashOpacity.setValue(0);

    Animated.parallel([
      Animated.loop(Animated.timing(scanSpin, { toValue: 1, duration: 3500, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.delay(600),
        Animated.timing(blipOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(blipOpacity, { toValue: 0.1, duration: 1500, useNativeDriver: true })
      ])),
      Animated.sequence([
        Animated.delay(400), 
        Animated.parallel([
          Animated.timing(scale3D, { toValue: 0.3, duration: 3500, useNativeDriver: true }),
          Animated.timing(tilt3D, { toValue: 75, duration: 3500, useNativeDriver: true })
        ])
      ])
    ]).start();

    let hapticCount = 0;
    const hapticInterval = setInterval(() => {
      hapticCount++;
      if (hapticCount < 15) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (hapticCount < 25) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 150);

    setTimeout(() => {
      clearInterval(hapticInterval);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setFilters(draftFilters);
      
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(scanOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
          Animated.timing(flashOpacity, { toValue: 0, duration: 1000, useNativeDriver: true })
        ])
      ]).start(() => {
        setIsScanning(false);
        scanSpin.setValue(0);
        scanPulse.setValue(0);
        blipOpacity.setValue(0);
      });
    }, 3800); 
  };

  const handleFilterSelect = (key: string, val: any) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraftFilters({ ...draftFilters, [key]: val });
  };

  const toggleDistrict = (district: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraftFilters(prev => {
      const current = prev.selectedDistricts;
      if (current.includes(district)) return { ...prev, selectedDistricts: current.filter(d => d !== district) };
      return { ...prev, selectedDistricts: [...current, district] };
    });
  };

  const handleCitySelect = (city: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDraftFilters({ ...draftFilters, city: city, selectedDistricts: [] });
    setShowCityPicker(false);
  };

  // Funkcje formatujące dla TextInput
  const formatNumberInput = (value: string) => {
    return value.replace(/\D/g, ''); // Usuwa wszystko co nie jest cyfrą
  };

  const handlePriceEndEditing = () => {
    let raw = parseInt(formatNumberInput(inputMaxPrice));
    if (isNaN(raw) || raw < 0) raw = 0;
    setInputMaxPrice(raw.toString());
    setDraftFilters({ ...draftFilters, maxPrice: raw });
  };

  const handleAreaEndEditing = () => {
    let raw = parseInt(formatNumberInput(inputMinArea));
    if (isNaN(raw) || raw < 0) raw = 0;
    setInputMinArea(raw.toString());
    setDraftFilters({ ...draftFilters, minArea: raw });
  };

  const handleYearEndEditing = () => {
    let raw = parseInt(formatNumberInput(inputMinYear));
    if (isNaN(raw) || raw < 1900) raw = 1900;
    setInputMinYear(raw.toString());
    setDraftFilters({ ...draftFilters, minYear: raw });
  };


  const spin = scanSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const tilt = tilt3D.interpolate({ inputRange: [0, 75], outputRange: ['0deg', '75deg'] });
  
  const isFilterActive = true; 
  const availableDistricts = CITY_DISTRICTS[draftFilters.city] || [];

  return (
    <View style={styles.container}>
      <MapView
        mapType={mapType} clusterColor={ThemeColors[filters.transactionType]} clusterTextColor="#FFFFFF" animationEnabled={false} radius={45} ref={mapRef}
        mapPadding={{ top: 40, right: 0, bottom: 180, left: 0 }} style={StyleSheet.absoluteFillObject}
        userInterfaceStyle={isDark ? "dark" : "light"} showsUserLocation={true} showsBuildings={true} pitchEnabled={true}
        initialRegion={{ latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
      >
        {filteredOffers.map((offer, index) => {
          const isSelected = activeIndex === index;
          return (
            <Marker key={offer.id || index} coordinate={{ latitude: parseFloat(offer.lat), longitude: parseFloat(offer.lng) }} onPress={() => handleMarkerPress(index)} style={{ zIndex: isSelected ? 10 : 1 }} tracksViewChanges={isSelected}>
              <View style={[styles.markerPill, { backgroundColor: offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL, borderColor: (offer.user?.role === 'AGENT' || offer.role === 'AGENT') ? '#FF9F0A' : '#FFFFFF', borderWidth: 2, shadowColor: isSelected ? (offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL) : '#000', shadowOpacity: isSelected ? 0.8 : 0.3, shadowRadius: isSelected ? 12 : 5 }, isSelected && { transform: [{ scale: 1.15 }] }]}>
                <Text style={[styles.markerText, { color: '#FFF' }]}>{formatPriceMarker(offer.price)}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.topSafeArea}>
        <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={styles.topBarContainer}>
          <View style={styles.segmentControl}>
            {(['ALL', 'FAV', 'MINE'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const labels = { ALL: 'Radar', FAV: 'Ulubione', MINE: 'Moje' };
              const tabCount = counts[tab];
              return (
                <Pressable key={tab} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }} style={[styles.segmentBtn, isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#FFFFFF' }]}>
                  <View style={styles.segmentContent}>
                    <Text style={[styles.segmentText, { color: isActive ? (isDark ? '#FFF' : '#000') : BaseColors.subtitle, fontWeight: isActive ? '700' : '600' }]} numberOfLines={1} adjustsFontSizeToFit>{labels[tab]}</Text>
                    {tabCount > 0 && <View style={[styles.badgePill, { backgroundColor: isActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }]}><Text style={[styles.badgeText, { color: isActive ? (isDark ? '#FFF' : '#000') : BaseColors.subtitle }]}>{tabCount}</Text></View>}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.filterBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMapType(prev => prev === 'standard' ? 'hybrid' : 'standard'); }}><Ionicons name="map" size={22} color={isDark ? '#FFF' : '#000'} /></Pressable>
          <Pressable style={styles.filterBtn} onPress={() => { setDraftFilters(filters); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCalibration(true); }}>
            <Ionicons name="options" size={24} color={isDark ? '#FFF' : '#000'} />
            {isFilterActive && <View style={[styles.filterActiveDot, { backgroundColor: ThemeColors[filters.transactionType] }]} />}
          </Pressable>
        </BlurView>
      </View>

      <View style={styles.bottomCarouselContainer}>
        {filteredOffers.length > 0 ? (
          <ScrollView ref={flatListRef} horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.85 + 20} decelerationRate="fast" onMomentumScrollEnd={handleScrollEnd} contentContainerStyle={{ paddingHorizontal: (width - (width * 0.85)) / 2 }}>
            {filteredOffers.map((offer, index) => {
              const isFav = favorites.includes(offer.id);
              let firstImage = null;
              try { const p = typeof offer.images === 'string' ? JSON.parse(offer.images) : offer.images; if (p?.length > 0) firstImage = p[0].startsWith('/uploads') ? `${API_URL}${p[0]}` : p[0]; } catch(e) {}
              
              return (
                <Pressable key={offer.id || index} style={styles.cardWrapper} onPress={() => handleMarkerPress(index)}>
                  <BlurView intensity={isDark ? 75 : 100} tint={isDark ? "dark" : "light"} style={styles.cardGlass}>
                    <View style={styles.cardImageContainer}>
                      {firstImage ? <Image source={{ uri: firstImage }} style={styles.cardImage} /> : <View style={[styles.cardImage, { backgroundColor: isDark ? '#333' : '#E5E5EA', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="home" size={24} color={BaseColors.subtitle} /></View>}
                      <View style={[styles.typeTag, { backgroundColor: offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL }]}><Text style={styles.typeTagText}>{offer.transactionType === 'RENT' ? 'WYNAJEM' : 'SPRZEDAŻ'}</Text></View>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardPrice, { color: isDark ? '#FFF' : '#000' }]}>{parseInt(offer.price || "0").toLocaleString("pl-PL")} PLN</Text>
                          <Text style={[styles.cardTitle, { color: isDark ? '#CCC' : '#8E8E93' }]} numberOfLines={1}>{offer.propertyType === 'FLAT' ? 'Mieszkanie' : offer.propertyType === 'HOUSE' ? 'Dom' : offer.propertyType === 'PLOT' ? 'Działka' : 'Lokal'} • {offer.district || offer.city}</Text>
                        </View>
                        <Pressable style={styles.favButton} onPress={(e) => { e.stopPropagation(); toggleFavorite(offer.id); }}><Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? BaseColors.danger : BaseColors.subtitle} /></Pressable>
                      </View>
                      <View style={styles.cardSpecsContainer}>
                        <View style={styles.cardSpecs}>
                          <View style={styles.specItem}><Ionicons name="resize" size={12} color={BaseColors.subtitle} /><Text style={styles.specText}>{offer.area} m²</Text></View>
                          {offer.propertyType !== 'PLOT' && <View style={styles.specItem}><Ionicons name="bed" size={12} color={BaseColors.subtitle} /><Text style={styles.specText}>{offer.rooms || '-'} pok.</Text></View>}
                        </View>
                        <View style={styles.amenitiesRow}>
                          {offer.hasBalcony && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="leaf" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                          {offer.hasParking && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="car" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                          {offer.hasGarden && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="flower" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                          {offer.hasElevator && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="swap-vertical" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                          {offer.hasStorage && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="cube" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                          {offer.isFurnished && <View style={[styles.amenityStamp, { borderColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.3)' : 'rgba(52, 199, 89, 0.3)', backgroundColor: offer.transactionType === 'RENT' ? 'rgba(10, 132, 255, 0.1)' : 'rgba(52, 199, 89, 0.1)' }]}><Ionicons name="tv" size={10} color={offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL} /></View>}
                        </View>
                      </View>
                    </View>
                  </BlurView>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.emptyStateGlass, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}>
            <Ionicons name="radio-outline" size={40} color={BaseColors.subtitle} />
            <Text style={[styles.emptyStateText, { color: isDark ? '#FFF' : '#000' }]}>Brak sygnału na radarze.</Text>
            <Text style={styles.emptyStateSub}>Zmień parametry kalibracji lub oddal mapę.</Text>
          </View>
        )}
      </View>

      <Modal visible={showCalibration} animationType="slide" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCalibration(false)}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          </Pressable>

          <View style={[styles.premiumModalContent, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={styles.modalDragHandle} />

            <View style={styles.premiumModalHeader}>
              <Text style={[styles.premiumModalTitle, { color: isDark ? '#FFF' : '#000' }]}>Kalibracja Radaru</Text>
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDraftFilters({ transactionType: 'SELL', propertyType: 'ALL', city: 'Warszawa', selectedDistricts: [], maxPrice: 5000000, minArea: 0, minYear: 1900, requireBalcony: false, requireGarden: false, requireElevator: false, requireParking: false, requireFurnished: false, pushNotifications: true }); setInputMaxPrice('5000000'); setInputMinArea('0'); setInputMinYear('1900'); }} style={styles.resetBtn}>
                <Text style={[styles.resetBtnText, { color: activeColor }]}>Wyczyść</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 150 }}>

              <Text style={styles.premiumSectionTitle}>PRZEZNACZENIE I TYP</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
                <View style={styles.premiumSegmentContainer}>
                  {(['RENT', 'SELL'] as const).map(t => {
                    const isActive = draftFilters.transactionType === t;
                    return (
                      <Pressable key={t} onPress={() => handleFilterSelect('transactionType', t)} style={[styles.premiumSegmentBtn, isActive && { backgroundColor: ThemeColors[t], shadowColor: ThemeColors[t], shadowOpacity: 0.8, shadowRadius: 10, elevation: 5 }]}>
                        <Text style={[styles.premiumSegmentText, isActive && styles.segmentTextActive]}>{t === 'RENT' ? 'Wynajem' : 'Kupno'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA' }]} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.premiumSegmentContainer}>
                  {(['ALL', 'FLAT', 'HOUSE', 'PLOT', 'COMMERCIAL'] as const).map(t => {
                    const isActive = draftFilters.propertyType === t;
                    const labels = { ALL: 'Wszystko', FLAT: 'Mieszkanie', HOUSE: 'Dom', PLOT: 'Działka', COMMERCIAL: 'Lokal' };
                    return (
                      <Pressable key={t} onPress={() => handleFilterSelect('propertyType', t)} style={[styles.premiumSegmentBtn, { paddingHorizontal: 16 }, isActive && { backgroundColor: activeColor, shadowColor: activeColor, shadowOpacity: 0.5, shadowRadius: 10 }]}>
                        <Text style={[styles.premiumSegmentText, isActive && styles.segmentTextActive]}>{labels[t]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={styles.premiumSectionTitle}>LOKALIZACJA</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingBottom: 16 }]}>
                <Pressable onPress={() => { Haptics.selectionAsync(); setShowCityPicker(true); }} style={styles.cityDrumBtn}>
                  <Text style={[styles.cityDrumLabel, { color: isDark ? '#FFF' : '#000' }]}>Miasto</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.cityDrumValue, { color: activeColor }]}>{draftFilters.city}</Text>
                    <Ionicons name="chevron-forward" size={20} color={BaseColors.subtitle} />
                  </View>
                </Pressable>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
                
                <Text style={[styles.premiumInputLabel, { color: isDark ? '#FFF' : '#000', marginHorizontal: 16, marginTop: 16, marginBottom: 12 }]}>Dzielnice ({draftFilters.city})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {availableDistricts.length > 0 ? availableDistricts.map(dist => {
                    const isActive = draftFilters.selectedDistricts.includes(dist);
                    return (
                      <Pressable key={dist} onPress={() => toggleDistrict(dist)} style={[styles.pillBtn, isActive && { backgroundColor: activeColor, borderColor: activeColor, shadowColor: activeColor, shadowOpacity: 0.5, shadowRadius: 8 }]}>
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{dist}</Text>
                      </Pressable>
                    );
                  }) : <Text style={{ color: BaseColors.subtitle }}>Dla tego miasta dzielnice nie są zmapowane.</Text>}
                </ScrollView>
              </View>

              {/* ZMIENIONA SEKCJA: PRECYZYJNE WYMIARY (INPUTY ZAMIAST SUWAKÓW) */}
              <Text style={styles.premiumSectionTitle}>PRECYZYJNE WYMIARY</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 5 }]}>
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Maks. Cena</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.numberInput, { color: activeColor }]}
                      keyboardType="numeric"
                      value={inputMaxPrice}
                      onChangeText={setInputMaxPrice}
                      onBlur={handlePriceEndEditing}
                      returnKeyType="done"
                    />
                    <Text style={styles.inputSuffix}>PLN</Text>
                  </View>
                </View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
                
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Min. Metraż</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.numberInput, { color: activeColor }]}
                      keyboardType="numeric"
                      value={inputMinArea}
                      onChangeText={setInputMinArea}
                      onBlur={handleAreaEndEditing}
                      returnKeyType="done"
                    />
                    <Text style={styles.inputSuffix}>m²</Text>
                  </View>
                </View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />

                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Rok Budowy (od)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.numberInput, { color: activeColor }]}
                      keyboardType="numeric"
                      value={inputMinYear}
                      onChangeText={setInputMinYear}
                      onBlur={handleYearEndEditing}
                      returnKeyType="done"
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.premiumSectionTitle}>WYPOSAŻENIE (RESTRYKCYJNE)</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
                <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Wymagaj balkonu</Text><Switch value={draftFilters.requireBalcony} onValueChange={v => handleFilterSelect('requireBalcony', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
                <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Wymagaj ogródka</Text><Switch value={draftFilters.requireGarden} onValueChange={v => handleFilterSelect('requireGarden', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
                <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Tylko z windą</Text><Switch value={draftFilters.requireElevator} onValueChange={v => handleFilterSelect('requireElevator', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
                <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginLeft: 16 }]} />
                <View style={styles.premiumSwitchRow}><Text style={[styles.premiumSwitchTitle, { color: isDark ? '#FFF' : '#000' }]}>Tylko umeblowane</Text><Switch value={draftFilters.requireFurnished} onValueChange={v => handleFilterSelect('requireFurnished', v)} trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: activeColor }} /></View>
              </View>
              <Text style={styles.warningDisclaimer}>Zaznaczenie powyższych opcji rygorystycznie odfiltruje wyniki. Nawet najbardziej okazyjna oferta zostanie ukryta, jeśli wprost nie posiada zaznaczonego atrybutu. Zalecamy używać oszczędnie.</Text>

              <View style={styles.systemDisclaimerBox}>
                <Ionicons name="shield-checkmark" size={24} color={BaseColors.subtitle} style={{ marginBottom: 8 }} />
                <Text style={styles.systemDisclaimerText}>Radar to integralny rdzeń ekosystemu EstateOS™. Obecnie wspieramy wybrane metropolie, a nasz zasięg nieustannie rośnie.</Text>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <BlurView intensity={isDark ? 80 : 100} tint={isDark ? "dark" : "light"} style={styles.premiumModalFooter}>
              <Pressable style={({pressed}) => [styles.premiumApplyBtn, { backgroundColor: activeColor, shadowColor: activeColor }, pressed && { opacity: 0.8, transform: [{scale: 0.98}] }]} onPress={applyCalibration}>
                <Text style={styles.premiumApplyBtnText}>Pokaż Wyniki na Mapie</Text>
              </Pressable>
            </BlurView>
          </View>
        </View>
      </Modal>

      {/* MODAL WYBORU MIASTA */}
      <Modal visible={showCityPicker} animationType="fade" transparent={true}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCityPicker(false)}><BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} /></Pressable>
          <View style={[styles.premiumModalContent, { height: height * 0.45, backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            <View style={styles.modalDragHandle} />
            <Text style={[styles.premiumModalTitle, { textAlign: 'center', marginTop: 10, marginBottom: 20, color: isDark ? '#FFF' : '#000' }]}>Wybierz Metropolię</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CITIES.map(c => (
                <Pressable key={c} onPress={() => handleCitySelect(c)} style={{ paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDark ? '#38383A' : '#E5E5EA', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: draftFilters.city === c ? '700' : '400', color: draftFilters.city === c ? activeColor : (isDark ? '#FFF' : '#000') }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PEŁNOEKRANOWA ANIMACJA SKANOWANIA KINOWEGO (CINEMATIC 3D LENS) */}
      {isScanning && (
        <Animated.View style={[styles.scannerOverlay, { opacity: scanOpacity }]}>
          
          <Animated.View style={[styles.radar3DContainer, { transform: [{ perspective: 1200 }, { rotateX: tilt3D.interpolate({ inputRange: [0, 75], outputRange: ['0deg', '75deg'] }) }, { scale: scale3D }] }]}>
            
            <View style={[styles.gridVertical, { backgroundColor: activeColor, shadowColor: activeColor }]} />
            <View style={[styles.gridHorizontal, { backgroundColor: activeColor, shadowColor: activeColor }]} />

            <View style={[styles.neonRing3, { borderColor: activeColor, shadowColor: activeColor }]} />
            <View style={[styles.neonRing2, { borderColor: activeColor, shadowColor: activeColor }]} />
            <View style={[styles.neonRing1, { borderColor: activeColor, shadowColor: activeColor }]} />

            <Animated.View style={[styles.corePulse, { backgroundColor: activeColor, transform: [{ scale: scanPulse }], opacity: scanPulse.interpolate({ inputRange: [0, 1.5], outputRange: [1, 0] }) }]} />
            <View style={styles.coreSolid} />

            <Animated.View style={[styles.sweeperContainer, { transform: [{ rotate: spin }] }]}>
              <View style={[styles.sweeperBeam, { shadowColor: activeColor }]} />
            </Animated.View>

            <Animated.View style={[styles.blip, { shadowColor: activeColor, borderColor: activeColor, top: '30%', left: '70%', opacity: blipOpacity }]} />
            <Animated.View style={[styles.blip, { shadowColor: activeColor, borderColor: activeColor, top: '65%', left: '25%', opacity: blipOpacity }]} />
            <Animated.View style={[styles.blip, { shadowColor: activeColor, borderColor: activeColor, top: '40%', left: '20%', opacity: blipOpacity }]} />

          </Animated.View>

          <View style={styles.cinematicTextContainer}>
            <Text style={[styles.cinematicTextMain, { color: activeColor, textShadowColor: activeColor }]}>ANALIZA TOPOGRAFII</Text>
            <Text style={styles.cinematicTextSub}>ESTATE OS™ KINETIC SCAN...</Text>
          </View>

          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity, zIndex: 10000 }]} pointerEvents="none" />
        </Animated.View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topSafeArea: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  topBarContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  segmentControl: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 18, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  segmentContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 2 },
  segmentText: { fontSize: 13, letterSpacing: 0.3 },
  badgePill: { marginLeft: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  filterBtn: { width: 50, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 },
  filterActiveDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#FFF' },
  markerPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  markerText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  bottomCarouselContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 30, width: '100%', zIndex: 10 },
  cardWrapper: { width: width * 0.88, marginHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  cardGlass: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', padding: 10, alignItems: 'center' },
  cardImageContainer: { height: 95, width: 95, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  typeTag: { position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  typeTagText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  cardContent: { flex: 1, paddingLeft: 14, justifyContent: 'center' },
  cardPrice: { fontSize: 20, fontWeight: '800', marginBottom: 2, letterSpacing: -0.5 },
  cardTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  favButton: { padding: 4, marginLeft: 10 },
  cardSpecsContainer: { marginTop: 2, gap: 6 },
  cardSpecs: { flexDirection: 'row', gap: 8 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  specText: { fontSize: 11, fontWeight: '700', color: BaseColors.subtitle },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  amenityStamp: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  emptyStateGlass: { marginHorizontal: 20, padding: 30, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  emptyStateText: { fontSize: 18, fontWeight: '800', marginTop: 15 },
  emptyStateSub: { fontSize: 14, color: BaseColors.subtitle, marginTop: 5, textAlign: 'center' },
  
  premiumModalContent: { height: height * 0.88, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalDragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginTop: 10, marginBottom: 5 },
  premiumModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15 },
  premiumModalTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  resetBtn: { padding: 4 },
  resetBtnText: { fontSize: 16, fontWeight: '600' },
  premiumSectionTitle: { fontSize: 13, color: '#8E8E93', marginLeft: 16, marginBottom: 8, marginTop: 24, fontWeight: '600', letterSpacing: 0.5 },
  premiumFilterGroup: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  premiumSegmentContainer: { flexDirection: 'row', padding: 3, marginHorizontal: 12, marginVertical: 8, backgroundColor: 'rgba(150,150,150,0.12)', borderRadius: 10 },
  premiumSegmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  premiumSegmentText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  segmentBtnActive: { shadowOffset: {width: 0, height: 0}, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  segmentTextActive: { color: '#FFF', fontWeight: '700' },
  premiumDivider: { height: StyleSheet.hairlineWidth },
  premiumInputLabel: { fontSize: 16, width: 110, fontWeight: '400' },
  premiumSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  premiumSwitchTitle: { fontSize: 16, fontWeight: '500' },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.05)' },
  pillText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  pillTextActive: { color: '#FFF', fontWeight: '700' },
  cityDrumBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  cityDrumLabel: { fontSize: 16, fontWeight: '400' },
  cityDrumValue: { fontSize: 18, fontWeight: '600', marginRight: 5 },
  premiumModalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  premiumApplyBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 5 },
  premiumApplyBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  
  // NOWE POLE DO WPISYWANIA ZAMIAST SUWAKA
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  inputLabelText: { fontSize: 16, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  numberInput: { fontSize: 18, fontWeight: '800', minWidth: 80, textAlign: 'right' },
  inputSuffix: { fontSize: 16, fontWeight: '600', color: '#8E8E93', marginLeft: 8 },

  warningDisclaimer: { fontSize: 11, color: BaseColors.subtitle, marginHorizontal: 16, marginTop: 10, lineHeight: 16, textAlign: 'center' },
  systemDisclaimerBox: { marginTop: 30, marginHorizontal: 20, alignItems: 'center', padding: 20, backgroundColor: 'rgba(150,150,150,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)' },
  systemDisclaimerText: { fontSize: 12, color: BaseColors.subtitle, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  scannerOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 9999, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.92)' },
  radar3DContainer: { width: 400, height: 400, justifyContent: 'center', alignItems: 'center' }, 
  gridVertical: { position: 'absolute', width: 2, height: '100%', opacity: 0.15, shadowRadius: 15, shadowOpacity: 1 },
  gridHorizontal: { position: 'absolute', width: '100%', height: 2, opacity: 0.15, shadowRadius: 15, shadowOpacity: 1 },
  neonRing3: { position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 3, opacity: 0.1, shadowRadius: 30, shadowOpacity: 1 },
  neonRing2: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 4, opacity: 0.25, shadowRadius: 20, shadowOpacity: 1 },
  neonRing1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 5, opacity: 0.5, shadowRadius: 15, shadowOpacity: 1 },
  coreSolid: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', shadowColor: '#FFF', shadowRadius: 25, shadowOpacity: 1 },
  corePulse: { position: 'absolute', width: 80, height: 80, borderRadius: 40, opacity: 0.6 },
  sweeperContainer: { position: 'absolute', width: 380, height: 380, alignItems: 'center' },
  sweeperBeam: { width: 6, height: 190, backgroundColor: '#FFFFFF', shadowRadius: 20, shadowOpacity: 1, elevation: 10 },
  blip: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', shadowRadius: 20, shadowOpacity: 1, borderWidth: 3 },
  cinematicTextContainer: { position: 'absolute', bottom: 80, alignItems: 'center' },
  cinematicTextMain: { fontSize: 28, fontWeight: '900', letterSpacing: 8, textShadowOffset: {width:0, height:0}, textShadowRadius: 30 },
  cinematicTextSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 4, marginTop: 15 }
});
