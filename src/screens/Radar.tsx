import { useNavigation } from '@react-navigation/native';
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, Pressable, Animated, Platform, ScrollView, Modal, TextInput, Switch } from 'react-native';
import { Marker } from 'react-native-maps';
import MapView from 'react-native-map-clustering';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const Colors = { primary: '#10b981', dark: '#1C1C1E', light: '#FFFFFF', subtitle: '#8E8E93', danger: '#ef4444' };

const formatPriceMarker = (price: string | number) => {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!num || isNaN(num)) return '';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.floor(num / 1000) + 'k';
  return num.toString();
};

import { useColorScheme } from 'react-native';
export default function Radar({ theme }: any) {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore() as any;

  // APPLE-STYLE MEMORY CLEANER: Cicho czyścimy mapę przy wylogowaniu
  React.useEffect(() => {
    if (!user) {
      setAllOffers([]);
      setFavorites([]);
      setActiveTab('ALL');
    }
  }, [user]);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  
  // Stany UX
  const [activeTab, setActiveTab] = useState<'ALL' | 'FAV' | 'MINE'>('ALL');
  const [showCalibration, setShowCalibration] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Ulubione (Tymczasowo w pamięci aplikacji dla błyskawicznego działania)
  const [favorites, setFavorites] = useState<number[]>([]);

  // Stany Kalibracji (Filtrów)
  const [filters, setFilters] = useState({
    transactionType: 'ALL', // ALL, RENT, SELL
    propertyType: 'ALL',    // ALL, FLAT, HOUSE, PLOT
    minPrice: '',
    maxPrice: '',
    minArea: '',
    requireBalcony: false,
    pushNotifications: true
  });

  // Kopia robocza filtrów do modalu
  const [draftFilters, setDraftFilters] = useState(filters);

  const mapRef = useRef<any>(null);
  const flatListRef = useRef<any>(null);
  const colorScheme = useColorScheme();
  const isDark = theme?.glass === 'dark' || theme?.dark || colorScheme === 'dark';

  // --- PODŁĄCZENIE DO NOWEGO SERWERA NEXT.JS ---
  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch('https://estateos.pl/api/mobile/v1/offers');
      const data = await res.json();
      if (data.success && data.offers) {
        setAllOffers(data.offers);
      }
    } catch (e) {
      console.log("Radar fetch error:", e);
    }
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchOffers(); }, []));

  // --- LOGIKA KALIBRACJI I ZAKŁADEK ---
  const filteredOffers = useMemo(() => {
    return allOffers.filter(offer => {
      if (!offer.lat || !offer.lng || isNaN(parseFloat(offer.lat))) return false;
      // 1. Filtrowanie po zakładkach (Tab)
      if (activeTab === 'MINE' && offer.userId !== user?.id) return false;
      if (activeTab === 'FAV' && !favorites.includes(offer.id)) return false;

      // 2. Filtrowanie po Kalibracji
      if (filters.transactionType !== 'ALL' && offer.transactionType !== filters.transactionType) return false;
      if (filters.propertyType !== 'ALL' && offer.propertyType !== filters.propertyType) return false;
      
      const price = parseFloat(offer.price) || 0;
      if (filters.minPrice && price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && price > parseFloat(filters.maxPrice)) return false;
      
      const area = parseFloat(offer.area) || 0;
      if (filters.minArea && area < parseFloat(filters.minArea)) return false;

      if (filters.requireBalcony && !offer.hasBalcony) {
        return false;
      }

      return true;
    });
  }, [allOffers, activeTab, favorites, filters, user]);

  // Automatyczny przelot kamery po zmianie filtrów
  useFocusEffect(useCallback(() => {
    if (filteredOffers.length > 0) flyToMarker(filteredOffers[0]);
    setActiveIndex(0);
  }, [filteredOffers.length]));

  const flyToMarker = (offer: any) => {
    if (offer?.lat && offer?.lng && mapRef.current) {
      mapRef.current.animateCamera({
        center: { latitude: parseFloat(offer.lat), longitude: parseFloat(offer.lng) },
        pitch: 45, altitude: 3000, zoom: 14
      }, { duration: 1000 });
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

  const toggleFavorite = (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const applyCalibration = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setFilters(draftFilters);
    setShowCalibration(false);
  };

  const isFilterActive = filters.transactionType !== 'ALL' || filters.propertyType !== 'ALL' || filters.minPrice || filters.maxPrice || filters.minArea || filters.requireBalcony;

  return (
    <View style={styles.container}>
      
      {/* MAPA W TLE */}
      <MapView
        mapType={mapType || "standard"}
        clusterColor="#10b981"
        clusterTextColor="#FFFFFF"
        animationEnabled={false}
        radius={45}  
        ref={mapRef}
        mapPadding={{ top: 40, right: 0, bottom: 180, left: 0 }} // APPLE STYLE: Zapobiega zasłanianiu pinesek przez karty
        style={StyleSheet.absoluteFillObject}
        userInterfaceStyle={isDark ? "dark" : "light"}
        mapType={mapType}
        showsUserLocation={true}
        showsBuildings={true}
        pitchEnabled={true}
        initialRegion={{ latitude: 52.2297, longitude: 21.0122, latitudeDelta: 0.1, longitudeDelta: 0.1 }}
      >
        {filteredOffers.map((offer, index) => {
          const lat = parseFloat(offer.lat);
          const lng = parseFloat(offer.lng);
          
          
          const isSelected = activeIndex === index;
          
          const isRent = offer.transactionType === 'RENT';
          // Rozpoznajemy, czy to Agent (zależnie od tego, jak backend podaje rolę, sprawdzamy parę wariantów)
          const isAgent = offer.user?.role === 'AGENT' || offer.advertiserType === 'AGENT' || offer.role === 'AGENT';
          
          const insideColor = isRent ? '#0A2463' : '#10b981'; // Granatowy dla Wynajmu, Zielony dla Sprzedaży
          const borderColor = isAgent ? '#FF9F0A' : '#FFFFFF'; // Złota ramka dla Agenta, Biała dla osoby prywatnej
          
          return (
            <Marker 
              key={offer.id || index}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => handleMarkerPress(index)}
              style={{ zIndex: isSelected ? 10 : 1 }}
              tracksViewChanges={isSelected} // APPLE FIX: Pineska śledzi zmiany TYLKO gdy na nią klikniesz (wtedy rośnie)
            >
              <View style={[
                styles.markerPill, 
                { 
                  backgroundColor: insideColor,
                  borderColor: borderColor,
                  borderWidth: isAgent ? 2.5 : 2,
                  shadowColor: isAgent ? '#FF9F0A' : '#000',
                  shadowOpacity: isSelected ? 0.6 : 0.3,
                  shadowRadius: isSelected ? 10 : 5
                },
                isSelected && { transform: [{ scale: 1.15 }] }
              ]}>
                <Text style={[styles.markerText, { color: '#FFF' }]}>
                  {formatPriceMarker(offer.price)}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* GÓRNY PANEL (SZKŁO) */}
      <View style={styles.topSafeArea}>
        <BlurView intensity={isDark ? 50 : 80} tint={isDark ? "dark" : "light"} style={styles.topBarContainer}>
          
          <View style={styles.segmentControl}>
            {(['ALL', 'FAV', 'MINE'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const labels = { ALL: 'Radar', FAV: 'Ulubione', MINE: 'Moje' };
              return (
                <Pressable 
                  key={tab} 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(tab); }}
                  style={[styles.segmentBtn, isActive && { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : '#FFFFFF' }]}
                >
                  <Text style={[styles.segmentText, { color: isActive ? (isDark ? '#FFF' : '#000') : Colors.subtitle, fontWeight: isActive ? '700' : '500' }]}>
                    {labels[tab]} {tab === 'FAV' && favorites.length > 0 ? `(${favorites.length})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.filterBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMapType(prev => prev === 'standard' ? 'hybrid' : 'standard'); }}>
            <Ionicons name="map" size={22} color={isDark ? '#FFF' : '#000'} />
          </Pressable>
          <Pressable style={styles.filterBtn} onPress={() => { setDraftFilters(filters); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCalibration(true); }}>
            <Ionicons name="options" size={24} color={isDark ? '#FFF' : '#000'} />
            {isFilterActive && <View style={styles.filterActiveDot} />}
          </Pressable>

        </BlurView>
      </View>

      {/* KARUZELA OFERT NA DOLE */}
      <View style={styles.bottomCarouselContainer}>
        {filteredOffers.length > 0 ? (
          <ScrollView
            ref={flatListRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width * 0.85 + 20}
            decelerationRate="fast"
            onMomentumScrollEnd={handleScrollEnd}
            contentContainerStyle={{ paddingHorizontal: (width - (width * 0.85)) / 2 }}
          >
            {filteredOffers.map((offer, index) => {
              const isFav = favorites.includes(offer.id);
              let firstImage = offer.images ? (typeof offer.images === 'string' ? JSON.parse(offer.images)[0] : offer.images[0]) : null;
              
              return (
                <Pressable key={offer.id || index} style={styles.cardWrapper}>
                  <BlurView intensity={isDark ? 75 : 100} tint={isDark ? "dark" : "light"} style={styles.cardGlass}>
                    
                    {/* MINIATURKA Z LEWEJ */}
                    <View style={styles.cardImageContainer}>
                      {firstImage ? (
                        <Image source={{ uri: firstImage }} style={styles.cardImage} />
                      ) : (
                        <View style={[styles.cardImage, { backgroundColor: isDark ? '#333' : '#E5E5EA', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="home" size={24} color={Colors.subtitle} />
                        </View>
                      )}
                      <View style={styles.typeTag}>
                        <Text style={styles.typeTagText}>{offer.transactionType === 'RENT' ? 'WYN' : 'SPRZ'}</Text>
                      </View>
                    </View>

                    {/* DANE PO PRAWEJ */}
                    <View style={styles.cardContent}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardPrice, { color: isDark ? '#FFF' : '#000' }]}>
                            {parseInt(offer.price || "0").toLocaleString("pl-PL")} PLN
                          </Text>
                          <Text style={[styles.cardTitle, { color: isDark ? '#CCC' : '#8E8E93' }]} numberOfLines={1}>
                            {offer.propertyType} • {offer.city}
                          </Text>
                        </View>
                        <Pressable style={styles.favButton} onPress={() => toggleFavorite(offer.id)}>
                          <Ionicons name={isFav ? "heart" : "heart-outline"} size={22} color={isFav ? Colors.danger : Colors.subtitle} />
                        </Pressable>
                      </View>
                      
                      <View style={styles.cardSpecs}>
                        <View style={styles.specItem}><Ionicons name="resize" size={12} color={Colors.subtitle} /><Text style={styles.specText}>{offer.area} m²</Text></View>
                        <View style={styles.specItem}><Ionicons name="bed" size={12} color={Colors.subtitle} /><Text style={styles.specText}>{offer.rooms || '-'} pok.</Text></View>
                        <View style={styles.specItem}><Ionicons name="layers" size={12} color={Colors.subtitle} /><Text style={styles.specText}>p. {offer.floor !== null ? offer.floor : '-'}</Text></View>
                      </View>
                    </View>

                  </BlurView>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.emptyStateGlass, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }]}>
            <Ionicons name="radio-outline" size={40} color={Colors.subtitle} />
            <Text style={[styles.emptyStateText, { color: isDark ? '#FFF' : '#000' }]}>Brak sygnału na radarze.</Text>
            <Text style={styles.emptyStateSub}>Zmień parametry kalibracji lub oddal mapę.</Text>
          </View>
        )}
      </View>

      {/* OVERLAY KALIBRACJI (FILTRY APPLE STYLE) */}
      <Modal visible={showCalibration} animationType="slide" transparent={true}>
        <BlurView intensity={isDark ? 90 : 100} tint={isDark ? "dark" : "light"} style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
            
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFF' : '#000' }]}>Kalibracja Radaru</Text>
              <Pressable onPress={() => setShowCalibration(false)} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={32} color={Colors.subtitle} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
              
              <Text style={styles.filterSectionTitle}>PODSTAWY</Text>
              <View style={[styles.filterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
                <View style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: isDark ? '#FFF' : '#000' }]}>Transakcja</Text>
                  <View style={styles.miniTabs}>
                    {(['ALL', 'RENT', 'SELL'] as const).map(t => (
                      <Pressable key={t} onPress={() => setDraftFilters({...draftFilters, transactionType: t})} style={[styles.miniTab, draftFilters.transactionType === t && { backgroundColor: Colors.primary }]}>
                        <Text style={[styles.miniTabText, draftFilters.transactionType === t && { color: '#FFF' }]}>{t === 'ALL' ? 'Wsz.' : t === 'RENT' ? 'Wynajem' : 'Kupno'}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.filterRow}>
                  <Text style={[styles.filterLabel, { color: isDark ? '#FFF' : '#000' }]}>Typ</Text>
                  <View style={styles.miniTabs}>
                    {(['ALL', 'FLAT', 'HOUSE'] as const).map(t => (
                      <Pressable key={t} onPress={() => setDraftFilters({...draftFilters, propertyType: t})} style={[styles.miniTab, draftFilters.propertyType === t && { backgroundColor: Colors.primary }]}>
                        <Text style={[styles.miniTabText, draftFilters.propertyType === t && { color: '#FFF' }]}>{t === 'ALL' ? 'Wsz.' : t === 'FLAT' ? 'Mieszk.' : 'Dom'}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.filterSectionTitle}>FINANSE I WYMIARY</Text>
              <View style={[styles.filterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
                <View style={styles.filterRow}>
                  <TextInput style={[styles.input, { color: isDark ? '#FFF' : '#000', flex: 1, marginRight: 10 }]} placeholder="Cena Od (PLN)" placeholderTextColor={Colors.subtitle} keyboardType="numeric" value={draftFilters.minPrice} onChangeText={t => setDraftFilters({...draftFilters, minPrice: t})} />
                  <TextInput style={[styles.input, { color: isDark ? '#FFF' : '#000', flex: 1 }]} placeholder="Cena Do (PLN)" placeholderTextColor={Colors.subtitle} keyboardType="numeric" value={draftFilters.maxPrice} onChangeText={t => setDraftFilters({...draftFilters, maxPrice: t})} />
                </View>
                <View style={styles.divider} />
                <View style={styles.filterRow}>
                  <TextInput style={[styles.input, { color: isDark ? '#FFF' : '#000', width: '100%' }]} placeholder="Minimalny Metraż (m²)" placeholderTextColor={Colors.subtitle} keyboardType="numeric" value={draftFilters.minArea} onChangeText={t => setDraftFilters({...draftFilters, minArea: t})} />
                </View>
              </View>

              <Text style={styles.filterSectionTitle}>WYPOSAŻENIE (RESTRYKCYJNE)</Text>
              <View style={[styles.filterGroup, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
                <View style={[styles.filterRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flex: 1, paddingRight: 15 }}>
                    <Text style={[styles.filterLabel, { color: isDark ? '#FFF' : '#000', fontWeight: '700' }]}>Wymagaj Balkonu / Tarasu</Text>
                    <Text style={styles.warningText}>Uwaga: Zaznaczenie rygorystycznie wykluczy i ukryje z radaru wszystkie oferty, które nie posiadają balkonu.</Text>
                  </View>
                  <Switch value={draftFilters.requireBalcony} onValueChange={v => setDraftFilters({...draftFilters, requireBalcony: v})} trackColor={{ false: '#D1D1D6', true: Colors.primary }} />
                </View>
              </View>

              <Text style={[styles.filterSectionTitle, { color: Colors.primary }]}>SYSTEM POWIADOMIEŃ</Text>
              <View style={[styles.filterGroup, { backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: Colors.primary, borderWidth: 1 }]}>
                <View style={[styles.filterRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.filterLabel, { color: Colors.primary, fontWeight: '800' }]}>Alerty Radarowe</Text>
                    <Text style={{ fontSize: 12, color: Colors.subtitle, marginTop: 4 }}>Dostaniesz powiadomienie Push, gdy nowa oferta spełni powyższe kryteria kalibracji.</Text>
                  </View>
                  <Switch value={draftFilters.pushNotifications} onValueChange={v => setDraftFilters({...draftFilters, pushNotifications: v})} trackColor={{ false: '#D1D1D6', true: Colors.primary }} />
                </View>
              </View>

              <View style={{ height: 60 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable style={styles.applyBtn} onPress={applyCalibration}>
                <Text style={styles.applyBtnText}>Zastosuj kalibrację</Text>
              </Pressable>
            </View>

          </View>
        </BlurView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  
  // Górny Pasek
  topSafeArea: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, width: '100%', paddingHorizontal: 20, zIndex: 10 },
  topBarContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  segmentControl: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 18, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 14 },
  segmentText: { fontSize: 13, letterSpacing: 0.5 },
  filterBtn: { width: 50, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 16 },
  filterActiveDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, borderWidth: 1, borderColor: '#FFF' },

  // Markery
  markerPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 5, justifyContent: 'center', alignItems: 'center' },
  markerText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  // Karuzela - Apple Compact Style
  bottomCarouselContainer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 30, width: '100%', zIndex: 10 },
  cardWrapper: { width: width * 0.88, marginHorizontal: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  cardGlass: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', flexDirection: 'row', padding: 10, alignItems: 'center' },
  
  cardImageContainer: { height: 85, width: 85, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  typeTag: { position: 'absolute', bottom: 6, left: 6, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  typeTagText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  
  cardContent: { flex: 1, paddingLeft: 14, justifyContent: 'center' },
  cardPrice: { fontSize: 20, fontWeight: '800', marginBottom: 2, letterSpacing: -0.5 },
  cardTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  
  favButton: { padding: 4, marginLeft: 10 },
  
  cardSpecs: { flexDirection: 'row', gap: 8 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  specText: { fontSize: 11, fontWeight: '700', color: Colors.subtitle },

  emptyStateGlass: { marginHorizontal: 20, padding: 30, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  emptyStateText: { fontSize: 18, fontWeight: '800', marginTop: 15 },
  emptyStateSub: { fontSize: 14, color: Colors.subtitle, marginTop: 5, textAlign: 'center' },

  // Modal Kalibracji
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { height: height * 0.88, borderTopLeftRadius: 40, borderTopRightRadius: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 30, paddingBottom: 10 },
  modalTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: { padding: 5, marginRight: -5 },
  
  filterSectionTitle: { fontSize: 12, fontWeight: '800', color: Colors.subtitle, letterSpacing: 1.5, marginBottom: 10, marginLeft: 5, marginTop: 20 },
  filterGroup: { borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  filterRow: { padding: 18, flexDirection: 'row' },
  filterLabel: { fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginLeft: 18 },
  
  miniTabs: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 2, marginLeft: 'auto' },
  miniTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  miniTabText: { fontSize: 12, fontWeight: '600', color: Colors.subtitle },
  
  input: { fontSize: 16, padding: 10, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12 },
  warningText: { fontSize: 11, color: Colors.danger, marginTop: 6, fontWeight: '600', lineHeight: 16 },

  modalFooter: { padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25, backgroundColor: 'transparent' },
  applyBtn: { backgroundColor: Colors.primary, height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 },
  applyBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }
});
