import { useNavigation, useFocusEffect } from '@react-navigation/native';
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Audio } from 'expo-av';
import { View, Text, StyleSheet, Dimensions, Image, Pressable, Platform, ScrollView, Modal, Switch, Animated, useColorScheme, LayoutAnimation, UIManager, TextInput } from 'react-native';
import MapViewCore, { Marker } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RadarStatus from '../components/RadarStatus';
import { fetchLocationCatalog, getFallbackLocationCatalog } from '../services/locationCatalog';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const API_URL = 'https://estateos.pl';
const RadarMapComponent: any = Platform.OS === 'ios' ? MapViewCore : ClusteredMapView;

const BaseColors = { dark: '#1C1C1E', light: '#FFFFFF', subtitle: '#8E8E93', danger: '#FF3B30' }; 
const ThemeColors = { RENT: '#0A84FF', SELL: '#34C759' };

const formatPriceMarker = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!num || isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.floor(num / 1000) + 'k';
  return num.toString();
};

const hasFiniteCoords = (lat: unknown, lng: unknown) =>
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

export default function Radar({ theme, route }: any) {
  const [strictCities, setStrictCities] = useState<string[]>(getFallbackLocationCatalog().strictCities);
  const [strictCityDistricts, setStrictCityDistricts] = useState<Record<string, string[]>>(getFallbackLocationCatalog().strictCityDistricts);

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const catalog = await fetchLocationCatalog();
      if (!mounted) return;
      setStrictCities(catalog.strictCities);
      setStrictCityDistricts(catalog.strictCityDistricts);
    };
    loadCatalog();
    return () => { mounted = false; };
  }, []);

  const playRadarSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/radar.mp3")
      );
      await sound.playAsync();
    } catch (e) {
      console.log("SOUND ERROR", e);
    }
  };

  const navigation = useNavigation<any>();
  const { user, isRadarActive, setRadarActive } = useAuthStore() as any;
  const colorScheme = useColorScheme();
  const isDark = theme?.glass === 'dark' || theme?.dark || colorScheme === 'dark';

  const mapRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);

  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAV' | 'MINE'>('ALL');
  
  const [showCalibration, setShowCalibration] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<number[]>([]);

  // 🔥 DODANY matchThreshold do kalibracji (Domyślnie 100% - pełna precyzja)
  const defaultFilters = {
    transactionType: 'SELL' as 'RENT' | 'SELL', 
    propertyType: 'ALL', city: 'Warszawa', selectedDistricts: [] as string[],
    maxPrice: 5000000, minArea: 0, minYear: 1900,
    requireBalcony: false, requireGarden: false, requireElevator: false, requireParking: false, requireFurnished: false, 
    pushNotifications: false,
    matchThreshold: 100 
  };

  const [filters, setFilters] = useState({ ...defaultFilters, pushNotifications: isRadarActive });
  const [draftFilters, setDraftFilters] = useState({ ...defaultFilters, pushNotifications: isRadarActive });

  const [inputMaxPrice, setInputMaxPrice] = useState(draftFilters.maxPrice.toString());
  const [inputMinArea, setInputMinArea] = useState(draftFilters.minArea.toString());
  const [inputMinYear, setInputMinYear] = useState(draftFilters.minYear.toString());

  const activeColor = ThemeColors[draftFilters.transactionType];

  const scanSpin = useRef(new Animated.Value(0)).current;
  const scanOpacity = useRef(new Animated.Value(0)).current;
  
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0.5)).current;
  const radarUIOpacity = useRef(new Animated.Value(1)).current;

  const scale3D = useRef(new Animated.Value(3)).current; 
  const tilt3D = useRef(new Animated.Value(0)).current; 
  const blipOpacity = useRef(new Animated.Value(0)).current;

  const blip1 = useRef(new Animated.Value(0)).current;
  const blip2 = useRef(new Animated.Value(0)).current;
  const blip3 = useRef(new Animated.Value(0)).current;
  const blip4 = useRef(new Animated.Value(0)).current;

  const radarIndicatorOpacity = useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    if (!user) { setAllOffers([]); setFavorites([]); setActiveTab('ALL'); setRadarActive(false); }
  }, [user]);

  useEffect(() => {
    if (isRadarActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(radarIndicatorOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(radarIndicatorOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      ).start();
    } else {
      radarIndicatorOpacity.setValue(0);
    }
  }, [isRadarActive]);

  useEffect(() => {
    if (!route?.params?.openCalibration) return;
    setDraftFilters(filters);
    setShowCalibration(true);
    navigation.setParams?.({ openCalibration: false });
  }, [route?.params?.openCalibration, filters, navigation]);

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
    return (allOffers || []).filter(offer => {
      if (!hasFiniteCoords(offer?.lat, offer?.lng)) return false;
      if (activeTab === 'MINE') return offer.userId === user?.id;
      if (activeTab === 'FAV') return favorites.includes(offer.id);
      return matchesFilters(offer, filters);
    });
  }, [allOffers, activeTab, favorites, filters, user]);

  const counts = useMemo(() => ({
    ALL: (allOffers || []).filter(o => o.lat && o.lng && matchesFilters(o, filters)).length,
    FAV: (allOffers || []).filter(o => o.lat && o.lng && favorites.includes(o.id)).length,
    MINE: user?.id ? (allOffers || []).filter(o => o.lat && o.lng && o.userId === user.id).length : 0
  }), [allOffers, filters, favorites, user]);

  const projectedCount = useMemo(() => {
    return (allOffers || []).filter(o => o.lat && o.lng && matchesFilters(o, draftFilters)).length;
  }, [allOffers, draftFilters]);

  useFocusEffect(useCallback(() => {
    if (filteredOffers.length > 0) flyToMarker(filteredOffers[0]);
    setActiveIndex(0);
  }, [filteredOffers.length]));

  const flyToMarker = (offer: any) => {
    const lat = Number(offer?.lat);
    const lng = Number(offer?.lng);
    if (hasFiniteCoords(lat, lng) && mapRef.current) {
      mapRef.current.animateCamera({ center: { latitude: lat, longitude: lng }, pitch: 45, altitude: 3000, zoom: 14 }, { duration: 1000 });
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

  const syncRadarPreferencesToBackend = async (payload: any) => {
    if (!user || !user.id) return;
    try {
      const body = {
        userId: user.id,
        transactionType: payload.transactionType,
        propertyType: payload.propertyType === "ALL" ? null : payload.propertyType,
        city: payload.city,
        selectedDistricts: payload.selectedDistricts || [],
        maxPrice: payload.maxPrice ?? null,
        minArea: payload.minArea ?? null,
        minYear: payload.minYear ?? null,
        requireBalcony: !!payload.requireBalcony,
        requireGarden: !!payload.requireGarden,
        requireElevator: !!payload.requireElevator,
        requireParking: !!payload.requireParking,
        requireFurnished: !!payload.requireFurnished,
        pushNotifications: payload.pushNotifications !== false,
        minMatchThreshold: payload.matchThreshold // 🔥 Wysyłamy próg na serwer
      };
      await fetch(`${API_URL}/api/radar/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.log("Błąd zapisu preferencji radaru", e);
    }
  };

  const applyCalibration = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowCalibration(false); 
    setIsScanning(true);
    
    setRadarActive(draftFilters.pushNotifications);
    syncRadarPreferencesToBackend(draftFilters);

    scale3D.setValue(3.5); 
    tilt3D.setValue(0);
    scanOpacity.setValue(1);
    radarUIOpacity.setValue(1);
    flashOpacity.setValue(0);
    resultOpacity.setValue(0);
    resultScale.setValue(0.5);
    
    blip1.setValue(0); blip2.setValue(0); blip3.setValue(0); blip4.setValue(0);

    playRadarSound();

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

    const ticks = [100, 300, 480, 630, 750, 850, 930, 990, 1040, 1080, 1110, 1130, 1140, 1150];
    ticks.forEach((time, index) => {
      setTimeout(() => {
        Haptics.impactAsync(index > 10 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      }, time);
    });

    setTimeout(() => Animated.timing(blip1, { toValue: 1, duration: 100, useNativeDriver: true }).start(), 300);
    setTimeout(() => Animated.timing(blip2, { toValue: 1, duration: 100, useNativeDriver: true }).start(), 630);
    setTimeout(() => Animated.timing(blip3, { toValue: 1, duration: 100, useNativeDriver: true }).start(), 850);
    setTimeout(() => Animated.timing(blip4, { toValue: 1, duration: 100, useNativeDriver: true }).start(), 1040);

    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.parallel([
           Animated.timing(radarUIOpacity, { toValue: 0, duration: 0, useNativeDriver: true }),
           Animated.timing(resultOpacity, { toValue: 1, duration: 0, useNativeDriver: true }),
           Animated.timing(flashOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
           Animated.spring(resultScale, { toValue: 1, friction: 6, tension: 35, useNativeDriver: true })
        ])
      ]).start();

      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
      }, 150);

      setTimeout(() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFilters(draftFilters);
        
        Animated.timing(scanOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setIsScanning(false);
          scanSpin.setValue(0);
        });
      }, 3000); 

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
  };

  const handlePriceEndEditing = () => {
    let raw = parseInt(inputMaxPrice.replace(/\D/g, ''));
    if (isNaN(raw) || raw < 0) raw = 0;
    setInputMaxPrice(raw.toString());
    setDraftFilters({ ...draftFilters, maxPrice: raw });
  };

  const handleAreaEndEditing = () => {
    let raw = parseInt(inputMinArea.replace(/\D/g, ''));
    if (isNaN(raw) || raw < 0) raw = 0;
    setInputMinArea(raw.toString());
    setDraftFilters({ ...draftFilters, minArea: raw });
  };

  const handleYearEndEditing = () => {
    let raw = parseInt(inputMinYear.replace(/\D/g, ''));
    if (isNaN(raw) || raw < 1900) raw = 1900;
    setInputMinYear(raw.toString());
    setDraftFilters({ ...draftFilters, minYear: raw });
  };

  // 🔥 CUSTOM TOUCH GESTURE DLA NASTAWNIKA RADARU 🔥
  const handleSliderMove = (evt: any) => {
    const { pageX } = evt.nativeEvent;
    // Padding kontenera to 16 z lewej i prawej = 32 marginesu
    const trackWidth = width - 64; 
    const rawPct = (pageX - 32) / trackWidth;
    
    let val = 50 + Math.round(rawPct * 50);
    if (val < 50) val = 50;
    if (val > 100) val = 100;

    if (val !== draftFilters.matchThreshold) {
      if (val % 2 === 0) Haptics.selectionAsync(); // Wibracja co 2% jak przy kręceniu koronką zegarka
      setDraftFilters(prev => ({...prev, matchThreshold: val}));
    }
  };

  // 🔥 DYNAMICZNE INFO ZALEŻNE OD PROCENTÓW 🔥
  const getRadarIntelligence = (val: number) => {
    if (val === 100) return {
        title: "🎯 Strzał w dziesiątkę",
        desc: "Ultra-restrykcyjne filtry. Powiadomimy Cię TYLKO, gdy oferta spełni absolutnie 100% Twoich wymagań. Zero kompromisów.",
        color: "#34C759"
    };
    if (val >= 85) return {
        title: "💎 Idealne trafienie",
        desc: "Złoty standard. Otrzymasz oferty o ogromnym dopasowaniu, z marginesem na kosmetyczne braki na rynku.",
        color: "#0A84FF"
    };
    if (val >= 70) return {
        title: "🔥 Świeża okazja",
        desc: "Szybki radar. Wyłapuje świetne oferty, dając Ci szansę na szybkie negocjacje nawet przy drobnych ustępstwach.",
        color: "#FF9F0A"
    };
    return {
        title: "👻 Głośne skanowanie",
        desc: "Szeroki zasięg. Radar poinformuje Cię o każdej nowej ofercie, która choćby ociera się o Twoje ogólne parametry.",
        color: "#FF3B30"
    };
  };

  const currentIntelligence = getRadarIntelligence(draftFilters.matchThreshold);

  const spin = scanSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const tilt = tilt3D.interpolate({ inputRange: [0, 75], outputRange: ['0deg', '75deg'] });
  const availableDistricts = strictCityDistricts[draftFilters.city] || [];
  
  const isFilterActive = JSON.stringify(filters) !== JSON.stringify(defaultFilters);

  return (
    <View style={styles.container}>
      <RadarMapComponent
        mapType={mapType}
        ref={mapRef}
        mapPadding={{ top: 40, right: 0, bottom: 180, left: 0 }}
        style={StyleSheet.absoluteFillObject}
        userInterfaceStyle={isDark ? "dark" : "light"}
        showsUserLocation={true}
        showsBuildings={true}
        pitchEnabled={true}
        initialRegion={{ latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
        {...(Platform.OS === 'ios'
          ? {}
          : {
              clusterColor: ThemeColors[filters.transactionType],
              clusterTextColor: '#FFFFFF',
              animationEnabled: false,
              radius: 45,
            })}
      >
        {filteredOffers.map((offer, index) => {
          const isSelected = activeIndex === index;
          const lat = Number(offer?.lat);
          const lng = Number(offer?.lng);
          if (!hasFiniteCoords(lat, lng)) return null;
          return (
            <Marker key={offer.id || index} coordinate={{ latitude: lat, longitude: lng }} onPress={() => handleMarkerPress(index)} style={{ zIndex: isSelected ? 10 : 1 }} tracksViewChanges={isSelected}>
              <View style={[styles.markerPill, { backgroundColor: offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL, borderColor: (offer.user?.role === 'AGENT' || offer.role === 'AGENT') ? '#FF9F0A' : '#FFFFFF', borderWidth: 2, shadowColor: isSelected ? (offer.transactionType === 'RENT' ? ThemeColors.RENT : ThemeColors.SELL) : '#000', shadowOpacity: isSelected ? 0.8 : 0.3, shadowRadius: isSelected ? 12 : 5 }, isSelected && { transform: [{ scale: 1.15 }] }]}>
                <Text style={[styles.markerText, { color: '#FFF' }]}>{formatPriceMarker(offer.price)}</Text>
              </View>
            </Marker>
          );
        })}
      </RadarMapComponent>

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
                    {tab === 'ALL' && isRadarActive && (
                        <Animated.View style={[styles.activeRadarDot, { opacity: radarIndicatorOpacity }]} />
                    )}
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

        <RadarStatus isDark={isDark} />
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 6 }}>
                            {offer.hasGarden && <Ionicons name="leaf" size={14} color="#10b981" />}
                            {offer.hasParking && <Ionicons name="car-sport" size={14} color="#10b981" />}
                            {offer.hasBalcony && <Ionicons name="sunny" size={14} color="#10b981" />}
                            {offer.hasElevator && <Ionicons name="arrow-up-circle" size={14} color="#10b981" />}
                          </View>
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
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDraftFilters({ transactionType: 'SELL', propertyType: 'ALL', city: 'Warszawa', selectedDistricts: [], maxPrice: 5000000, minArea: 0, minYear: 1900, requireBalcony: false, requireGarden: false, requireElevator: false, requireParking: false, requireFurnished: false, pushNotifications: false, matchThreshold: 100 }); setInputMaxPrice('5000000'); setInputMinArea('0'); setInputMinYear('1900'); }} style={styles.resetBtn}>
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

              <Text style={styles.premiumSectionTitle}>METROPOLIA</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 16 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                  {strictCities.map(c => {
                    const isActive = draftFilters.city === c;
                    return (
                      <Pressable key={c} onPress={() => handleCitySelect(c)} style={[styles.cityPillBtn, isActive && { backgroundColor: activeColor, borderColor: activeColor, shadowColor: activeColor, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8 }]}>
                        <Text style={[styles.cityPillText, isActive && styles.cityPillTextActive]}>{c}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Text style={styles.premiumSectionTitle}>DZIELNICE ({draftFilters.city})</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 16 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                  {availableDistricts.length > 0 ? availableDistricts.map(dist => {
                    const isActive = draftFilters.selectedDistricts.includes(dist);
                    return (
                      <Pressable key={dist} onPress={() => toggleDistrict(dist)} style={[styles.pillBtn, isActive && { backgroundColor: activeColor, borderColor: activeColor, shadowColor: activeColor, shadowOpacity: 0.5, shadowRadius: 8 }]}>
                        <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{dist}</Text>
                      </Pressable>
                    );
                  }) : <Text style={{ color: BaseColors.subtitle, marginLeft: 16 }}>Dla tego miasta dzielnice nie są zmapowane.</Text>}
                </ScrollView>
              </View>

              <Text style={styles.premiumSectionTitle}>PRECYZYJNE WYMIARY</Text>
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', paddingVertical: 5 }]}>
                <View style={styles.inputRow}>
                  <Text style={[styles.inputLabelText, { color: isDark ? '#FFF' : '#000' }]}>Maks. Cena</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.numberInput, { color: activeColor }]}
                      keyboardType="numeric"
                      value={inputMaxPrice.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
                      onChangeText={(val) => setInputMaxPrice(val.replace(/\D/g, ''))}
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
                      onChangeText={(val) => setInputMinArea(val.replace(/\D/g, ''))}
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
                      onChangeText={(val) => setInputMinYear(val.replace(/\D/g, ''))}
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

              {/* 🔥 NOWOŚĆ: CZUŁOŚĆ RADARU I DZIAŁANIE W TLE 🔥 */}
              <Text style={styles.premiumSectionTitle}>DZIAŁANIE W TLE I PRECYZJA</Text>
              
              <View style={[styles.premiumFilterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', borderColor: currentIntelligence.color, borderWidth: draftFilters.pushNotifications ? 1 : 0 }]}>
                
                {/* 1. Przełącznik główny */}
                <View style={styles.premiumSwitchRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.premiumSwitchTitle, { color: draftFilters.pushNotifications ? currentIntelligence.color : (isDark ? '#FFF' : '#000'), fontWeight: '800' }]}>Aktywny Radar (Push)</Text>
                    <Text style={{ color: BaseColors.subtitle, fontSize: 11, marginTop: 4 }}>
                      Nasłuchuj rynku po wyjściu z aplikacji na wybranym poziomie czułości.
                    </Text>
                  </View>
                  <Switch 
                    value={draftFilters.pushNotifications} 
                    onValueChange={v => handleFilterSelect('pushNotifications', v)} 
                    trackColor={{ false: isDark ? '#3A3A3C' : '#E5E5EA', true: currentIntelligence.color }} 
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* 2. Apple-Style Kinetic Equalizer (Wybierak) */}
                {draftFilters.pushNotifications && (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    
                    <View style={[styles.premiumDivider, { backgroundColor: isDark ? '#38383A' : '#E5E5EA', marginBottom: 16 }]} />
                    
                    {/* Dynamiczne Opisy */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: currentIntelligence.color, marginBottom: 4 }}>{currentIntelligence.title}</Text>
                        <Text style={{ fontSize: 11, color: BaseColors.subtitle, lineHeight: 16 }}>{currentIntelligence.desc}</Text>
                      </View>
                      <Text style={{ fontSize: 32, fontWeight: '900', color: currentIntelligence.color, fontVariant: ['tabular-nums'] }}>
                        {draftFilters.matchThreshold}%
                      </Text>
                    </View>

                    {/* Dotykowy Band / Suwak 3D */}
                    <View 
                      style={styles.customSliderContainer}
                      onStartShouldSetResponderCapture={() => true}
                      onMoveShouldSetResponderCapture={() => true}
                      onResponderGrant={handleSliderMove}
                      onResponderMove={handleSliderMove}
                      onResponderRelease={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
                    >
                      {Array.from({length: 25}).map((_, i) => {
                        const stepVal = 50 + (i * 2);
                        const isActive = stepVal <= draftFilters.matchThreshold;
                        const isMajor = stepVal % 10 === 0;
                        
                        return (
                          <View key={i} style={{
                            width: isMajor ? 3 : 2,
                            height: isMajor ? 28 : 14,
                            backgroundColor: isActive ? currentIntelligence.color : (isDark ? '#444' : '#E5E5EA'),
                            borderRadius: 2,
                            shadowColor: isActive ? currentIntelligence.color : 'transparent',
                            shadowOpacity: isActive ? 0.8 : 0,
                            shadowRadius: 6,
                            elevation: isActive ? 5 : 0
                          }} />
                        );
                      })}
                    </View>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>50%</Text>
                      <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>Skala Dopasowania AI</Text>
                      <Text style={{ fontSize: 10, color: BaseColors.subtitle, fontWeight: '700' }}>100%</Text>
                    </View>

                  </View>
                )}
              </View>

              <View style={styles.systemDisclaimerBox}>
                <Ionicons name="shield-checkmark" size={24} color={BaseColors.subtitle} style={{ marginBottom: 8 }} />
                <Text style={styles.systemDisclaimerText}>Radar to integralny rdzeń ekosystemu EstateOS™. Obecnie wspieramy wybrane metropolie, a nasz zasięg nieustannie rośnie.</Text>
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>

            <BlurView intensity={isDark ? 80 : 100} tint={isDark ? "dark" : "light"} style={styles.premiumModalFooter}>
              <Pressable style={({pressed}) => [styles.premiumApplyBtn, { backgroundColor: activeColor, shadowColor: activeColor }, pressed && { opacity: 0.8, transform: [{scale: 0.98}] }]} onPress={applyCalibration}>
                <Text style={styles.premiumApplyBtnText}>Zastosuj i Skanuj</Text>
              </Pressable>
            </BlurView>
          </View>
        </View>
      </Modal>

      <Modal visible={isScanning} transparent={true} animationType="none">
        <Animated.View style={[styles.scannerOverlay, { opacity: scanOpacity }]}>
          
          <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, { opacity: radarUIOpacity }, StyleSheet.absoluteFill]}>
            <Animated.View style={[styles.radar3DContainer, { transform: [{ perspective: 1200 }, { rotateX: tilt3D.interpolate({ inputRange: [0, 75], outputRange: ['0deg', '75deg'] }) }, { scale: scale3D }] }]}>
              <View style={[styles.gridVertical, { backgroundColor: activeColor, shadowColor: activeColor }]} />
              <View style={[styles.gridHorizontal, { backgroundColor: activeColor, shadowColor: activeColor }]} />
              <View style={[styles.neonRing3, { borderColor: activeColor, shadowColor: activeColor }]} />
              <View style={[styles.neonRing2, { borderColor: activeColor, shadowColor: activeColor }]} />
              <View style={[styles.neonRing1, { borderColor: activeColor, shadowColor: activeColor }]} />
              <Animated.View style={[styles.corePulse, { backgroundColor: activeColor, transform: [{ scale: blipOpacity.interpolate({ inputRange: [0.1, 1], outputRange: [1, 1.5] }) }], opacity: blipOpacity.interpolate({ inputRange: [0.1, 1], outputRange: [0.6, 0] }) }]} />
              <View style={styles.coreSolid} />
              <Animated.View style={[styles.sweeperContainer, { transform: [{ rotate: spin }] }]}>
                <View style={[styles.scannerTrail, { backgroundColor: activeColor, opacity: 0.15 }]} />
                <View style={[styles.sweeperBeam, { backgroundColor: '#FFFFFF', shadowColor: activeColor }]} />
              </Animated.View>
              <Animated.View style={[styles.blip, { top: '30%', left: '65%', backgroundColor: activeColor, shadowColor: activeColor, opacity: blip1 }]} />
              <Animated.View style={[styles.blip, { top: '70%', left: '35%', backgroundColor: activeColor, shadowColor: activeColor, opacity: blip2 }]} />
              <Animated.View style={[styles.blip, { top: '45%', left: '20%', backgroundColor: activeColor, shadowColor: activeColor, opacity: blip3 }]} />
              <Animated.View style={[styles.blip, { top: '25%', left: '40%', backgroundColor: activeColor, shadowColor: activeColor, opacity: blip4 }]} />
            </Animated.View>

            <View style={styles.cinematicTextContainer}>
              <Text style={[styles.cinematicTextMain, { color: activeColor, textShadowColor: activeColor }]}>ANALIZA TOPOGRAFII</Text>
              <Text style={styles.cinematicTextSub}>ESTATE OS™ KINETIC SCAN...</Text>
            </View>
          </Animated.View>

          <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, { opacity: resultOpacity, transform: [{ scale: resultScale }] }, StyleSheet.absoluteFill]} pointerEvents="none">
             <Text style={[styles.resultValue, { color: activeColor, textShadowColor: activeColor }]}>{projectedCount}</Text>
             <Text style={[styles.resultText, { color: '#FFF' }]}>DOPASOWANYCH OFERT</Text>
             <Text style={styles.resultLuster}>ESTATE OS™ KINETIC</Text>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashOpacity }]} pointerEvents="none" />
        </Animated.View>
      </Modal>

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
  
  activeRadarDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3B30', marginRight: 6, shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 5 },
  
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
  premiumSwitchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  premiumSwitchTitle: { fontSize: 16, fontWeight: '500' },
  
  cityPillBtn: { paddingHorizontal: 22, paddingVertical: 14, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(150,150,150,0.4)', backgroundColor: 'rgba(150,150,150,0.1)', shadowColor: '#000', shadowOffset: {width: 0, height: 6}, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  cityPillText: { fontSize: 16, color: '#8E8E93', fontWeight: '800', letterSpacing: 0.5 },
  cityPillTextActive: { color: '#FFF', fontWeight: '900' },
  
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.05)' },
  pillText: { fontSize: 13, color: '#8E8E93', fontWeight: '500' },
  pillTextActive: { color: '#FFF', fontWeight: '700' },
  premiumModalFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,150,150,0.2)' },
  premiumApplyBtn: { borderRadius: 16, paddingVertical: 18, alignItems: 'center', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 15, elevation: 5 },
  premiumApplyBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  inputLabelText: { fontSize: 16, fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(150,150,150,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  numberInput: { fontSize: 17, fontWeight: '800', minWidth: 60, textAlign: 'right' },
  inputSuffix: { fontSize: 16, fontWeight: '600', color: '#8E8E93', marginLeft: 8 },

  // 🔥 STYLE DLA DOTYKOWEGO WYBIERAKA RADARU 🔥
  customSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    width: '100%',
    paddingVertical: 10,
    backgroundColor: 'transparent'
  },

  warningDisclaimer: { fontSize: 11, color: BaseColors.subtitle, marginHorizontal: 16, marginTop: 10, lineHeight: 16, textAlign: 'center' },
  systemDisclaimerBox: { marginTop: 30, marginHorizontal: 20, alignItems: 'center', padding: 20, backgroundColor: 'rgba(150,150,150,0.05)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.1)' },
  systemDisclaimerText: { fontSize: 12, color: BaseColors.subtitle, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  scannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)' },
  radar3DContainer: { width: 400, height: 400, justifyContent: 'center', alignItems: 'center' }, 
  gridVertical: { position: 'absolute', width: 2, height: '100%', opacity: 0.15, shadowRadius: 15, shadowOpacity: 1 },
  gridHorizontal: { position: 'absolute', width: '100%', height: 2, opacity: 0.15, shadowRadius: 15, shadowOpacity: 1 },
  neonRing3: { position: 'absolute', width: 380, height: 380, borderRadius: 190, borderWidth: 3, opacity: 0.1, shadowRadius: 30, shadowOpacity: 1 },
  neonRing2: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 4, opacity: 0.25, shadowRadius: 20, shadowOpacity: 1 },
  neonRing1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 5, opacity: 0.5, shadowRadius: 15, shadowOpacity: 1 },
  coreSolid: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', shadowColor: '#FFF', shadowRadius: 25, shadowOpacity: 1 },
  corePulse: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  sweeperContainer: { position: 'absolute', width: 380, height: 380, top: 10, left: 10 },
  scannerTrail: { width: 190, height: 190, position: 'absolute', top: 0, left: 0, borderTopLeftRadius: 190 }, 
  sweeperBeam: { width: 4, height: 190, position: 'absolute', top: 0, left: 188, borderRadius: 2, shadowRadius: 20, shadowOpacity: 1, elevation: 10 }, 
  blip: { position: 'absolute', width: 14, height: 14, borderRadius: 7, shadowRadius: 10, shadowOpacity: 1, elevation: 5 },
  
  cinematicTextContainer: { position: 'absolute', bottom: 80, alignItems: 'center' },
  cinematicTextMain: { fontSize: 28, fontWeight: '900', letterSpacing: 8, textShadowOffset: {width:0, height:0}, textShadowRadius: 30 },
  cinematicTextSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 4, marginTop: 15 },
  
  resultValue: { fontSize: 130, fontWeight: '900', textShadowOffset: {width:0, height:0}, textShadowRadius: 30 },
  resultText: { fontSize: 20, fontWeight: '800', letterSpacing: 4, marginTop: 10 },
  resultLuster: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 15, fontWeight: '700', letterSpacing: 2 }
});
