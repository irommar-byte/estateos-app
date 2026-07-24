import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Gauge, MapPin, Fuel, Settings2, Calendar, Images, X, Share as ShareIcon } from 'lucide-react-native';
import { useAuthStore } from '../store/useAuthStore';
import CarAuthGateModal from '../components/cars/CarAuthGateModal';
import CarFavoriteButton from '../components/cars/CarFavoriteButton';
import CarInquirySheet from '../components/cars/CarInquirySheet';
import CarVehicleChecksPanel from '../components/cars/CarVehicleChecksPanel';
import SellerCarsSection from '../components/cars/SellerCarsSection';
import { fetchCarById, parseCarImages, type CarListing } from '../services/carsApi';
import { useMoneyContext } from '../money/useMoneyContext';
import { deleteCarListing } from '../services/carsMutations';
import { openDirectContactChat } from '../utils/openDirectContact';
import { useCarScreenTheme, type CarScreenColors } from '../theme/carScreenTheme';

type CarDetailScreenProps = {
  navigation: any;
  route: {
    params?: {
      carId?: number;
      car?: CarListing;
    };
  };
};

export default function CarDetailScreen({ navigation, route }: CarDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, elevation } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const SpecRow = ({ icon: Icon, label, value }: { icon: typeof Fuel; label: string; value: string }) => (
    <View style={styles.specRow}>
      <View style={styles.specIconWrap}>
        <Icon color={colors.accentSoft} size={16} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
      </View>
    </View>
  );

  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const { formatOffer } = useMoneyContext();
  const carPrice = car ? formatOffer(car) : null;
  const initialCar = route.params?.car;
  const carId = Number(route.params?.carId || initialCar?.id || 0);
  const [car, setCar] = useState<CarListing | null>(initialCar || null);
  const [loading, setLoading] = useState(!initialCar);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryCurrentIndex, setGalleryCurrentIndex] = useState(0);

  const isOwner = Boolean(car?.userId && userId && Number(car.userId) === Number(userId));
  const images = useMemo(() => (car ? parseCarImages(car) : []), [car]);
  const lightboxImages = useMemo(() => images.map((uri) => ({ uri })), [images]);
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    if (!carId) {
      setError('Brak identyfikatora ogłoszenia.');
      setLoading(false);
      return;
    }
    if (initialCar) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchCarById(carId);
        if (!cancelled) {
          if (!row) setError('Ogłoszenie nie istnieje.');
          setCar(row);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Błąd ładowania ogłoszenia.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [carId, initialCar]);

  const handleDelete = () => {
    if (!token || !car) return;
    Alert.alert('Usuń ogłoszenie', 'Czy na pewno chcesz usunąć to ogłoszenie auta?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteCarListing(token, car.id);
            navigation.goBack();
          } catch (deleteError) {
            Alert.alert('Błąd', deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleContact = () => {
    if (!car?.userId) {
      Alert.alert('Kontakt', 'Sprzedający nie jest jeszcze przypisany do tego ogłoszenia.');
      return;
    }
    if (isOwner) {
      Alert.alert('To Twoje ogłoszenie', 'Nie możesz wysłać zapytania do własnego ogłoszenia.');
      return;
    }
    if (!token) {
      setAuthGateOpen(true);
      return;
    }
    setInquiryOpen(true);
  };

  const handleShare = async () => {
    if (!car?.id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { shareListingLink, buildCarLandingPageUrl } = await import('../utils/offerShareUrls');
      await shareListingLink({
        url: buildCarLandingPageUrl(car.id),
        sheetTitle: 'EstateOS™Car',
      });
    } catch {
      /* anulowano */
    }
  };

  const openAuthEntry = (intent: 'login' | 'register') => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAuthGateOpen(false);
    navigation.navigate('MainTabs', { screen: 'Profil', params: { authIntent: intent } });
  };

  const openGallery = (index: number) => {
    void Haptics.selectionAsync();
    setGalleryIndex(index);
    setGalleryCurrentIndex(index);
    setGalleryOpen(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color={colors.accent} size={22} />
          <Text style={styles.backLabel}>Cars</Text>
        </Pressable>
        {car ? (
          <View style={styles.topBarRight}>
            <Pressable
              onPress={handleShare}
              style={styles.shareBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Udostępnij ogłoszenie"
            >
              <ShareIcon color={colors.accent} size={20} />
            </Pressable>
            <CarFavoriteButton
              carId={car.id}
              isLoggedIn={Boolean(token)}
              onAuthRequired={() => setAuthGateOpen(true)}
            />
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.accentSoft} />
        </View>
      ) : error || !car ? (
        <View style={styles.centerBox}>
          <Text style={styles.error}>{error || 'Ogłoszenie niedostępne.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => openGallery(0)} style={styles.heroWrap}>
            <Image source={{ uri: images[0] || car.imageUrl }} style={styles.hero} contentFit="cover" />
            {hasMultipleImages ? (
              <View style={styles.galleryBadge}>
                <Images color={colors.text} size={14} />
                <Text style={styles.galleryBadgeText}>{images.length} zdjęć</Text>
              </View>
            ) : null}
          </Pressable>

          {hasMultipleImages ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}
            >
              {images.map((uri, idx) => (
                <Pressable key={`${uri}-${idx}`} onPress={() => openGallery(idx)} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.body}>
            <Text style={styles.meta}>
              {car.make} · {car.model} · {car.year}
            </Text>
            <Text style={styles.title}>{car.title}</Text>
            <View style={styles.locationRow}>
              <MapPin color={colors.muted} size={14} />
              <Text style={styles.sub}>{car.city}</Text>
              <Gauge color={colors.muted} size={14} />
              <Text style={styles.sub}>{new Intl.NumberFormat('pl-PL').format(car.mileageKm)} km</Text>
            </View>
            <Text style={styles.price}>{carPrice?.primary || '—'}</Text>
            {carPrice?.secondary ? (
              <Text style={[styles.specLabel, { marginTop: 4 }]}>{carPrice.secondary}</Text>
            ) : null}

            {isOwner ? (
              <View style={styles.ownerRow}>
                <Pressable
                  onPress={() => navigation.navigate('AddCarListing', { mode: 'edit', carId: car.id })}
                  style={styles.editBtn}
                >
                  <Text style={styles.editLabel}>Edytuj</Text>
                </Pressable>
                <Pressable onPress={handleDelete} disabled={deleting} style={styles.deleteBtn}>
                  <Text style={styles.deleteLabel}>{deleting ? 'Usuwanie...' : 'Usuń'}</Text>
                </Pressable>
              </View>
            ) : null}

            {car.description?.trim() ? (
              <View style={[styles.descCard, elevation.cardSm]}>
                <Text style={styles.descTitle}>Opis</Text>
                <Text style={styles.descText}>{car.description.trim()}</Text>
              </View>
            ) : null}

            <View style={[styles.specCard, elevation.cardSm]}>
              <Text style={styles.specTitle}>Specyfikacja</Text>
              <SpecRow icon={Calendar} label="Rocznik" value={String(car.year)} />
              <SpecRow icon={Gauge} label="Przebieg" value={`${new Intl.NumberFormat('pl-PL').format(car.mileageKm)} km`} />
              <SpecRow icon={Fuel} label="Paliwo" value={car.fuelType} />
              <SpecRow icon={Settings2} label="Skrzynia" value={car.transmission} />
              <SpecRow icon={Settings2} label="Nadwozie" value={car.bodyType} />
              {car.exteriorColor ? <SpecRow icon={Settings2} label="Kolor" value={car.exteriorColor} /> : null}
              {car.generation ? <SpecRow icon={Settings2} label="Generacja" value={car.generation} /> : null}
              {car.enginePower ? <SpecRow icon={Settings2} label="Moc" value={car.enginePower} /> : null}
              {car.trimVersion ? <SpecRow icon={Settings2} label="Wersja" value={car.trimVersion} /> : null}
            </View>

            <CarVehicleChecksPanel
              carId={car.id}
              vin={car.vin}
              registrationNumber={car.registrationNumber}
              firstRegistrationDate={car.firstRegistrationDate}
              insuranceValidUntil={car.insuranceValidUntil}
              restrictVehicleDocs={Boolean(car.restrictVehicleDocs)}
            />

            {car.userId ? <SellerCarsSection userId={Number(car.userId)} excludeCarId={car.id} /> : null}

            <Pressable onPress={handleContact} style={styles.contactBtn}>
              <Text style={styles.contactLabel}>Wyślij profesjonalne zapytanie</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      <ImageViewing
        images={lightboxImages}
        imageIndex={galleryIndex}
        visible={galleryOpen}
        onRequestClose={() => setGalleryOpen(false)}
        onImageIndexChange={(idx) => {
          if (!Number.isFinite(idx as number)) return;
          setGalleryCurrentIndex(Number(idx));
        }}
        doubleTapToZoomEnabled
        swipeToCloseEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000000F2"
        HeaderComponent={({ imageIndex }) => (
          <View style={[styles.galleryHeader, { paddingTop: Math.max(insets.top + 6, Platform.OS === 'ios' ? 54 : 36) }]}>
            <TouchableOpacity
              onPress={() => setGalleryOpen(false)}
              style={styles.galleryCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X color="#FFFFFF" size={20} strokeWidth={2.2} />
            </TouchableOpacity>
            <Text style={styles.galleryCounter}>
              {(imageIndex ?? galleryCurrentIndex) + 1} / {images.length}
            </Text>
            <View style={styles.galleryHeaderSpacer} />
          </View>
        )}
      />

      {car && token ? (
        <CarInquirySheet
          visible={inquiryOpen}
          onClose={() => setInquiryOpen(false)}
          token={token}
          carId={car.id}
          carTitle={car.title}
          make={car.make}
          model={car.model}
          year={car.year}
          priceLabel={carPrice?.primary || '—'}
          city={car.city}
          onSuccess={(threadId, peerUserId) => {
            void openDirectContactChat(navigation, token, peerUserId);
          }}
        />
      ) : null}

      <CarAuthGateModal
        visible={authGateOpen}
        onClose={() => setAuthGateOpen(false)}
        onLoginPress={() => openAuthEntry('login')}
        onRegisterPress={() => openAuthEntry('register')}
      />
    </View>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    topBar: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    shareBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
    backLabel: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
    error: { color: '#FCA5A5', textAlign: 'center', fontSize: 15 },
    content: { paddingBottom: 40 },
    heroWrap: { position: 'relative' },
    hero: { width: '100%', height: 280, backgroundColor: colors.inputBg },
    galleryBadge: {
      position: 'absolute',
      right: 14,
      bottom: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    galleryBadgeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
    thumbRow: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
    thumbWrap: {
      width: 72,
      height: 54,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    thumb: { width: '100%', height: '100%' },
    body: { padding: 20, gap: 8 },
    meta: { color: colors.accentSoft, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, textTransform: 'uppercase' },
    title: { color: colors.text, fontSize: 28, fontWeight: '700', lineHeight: 34 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
    sub: { color: colors.muted, fontSize: 14, marginRight: 8 },
    price: { marginTop: 4, color: colors.accent, fontSize: 26, fontWeight: '800' },
    ownerRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    editBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.buttonBorder,
      backgroundColor: colors.buttonBg,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    editLabel: { color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
    deleteBtn: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.dangerButtonBorder,
      backgroundColor: colors.dangerButtonBg,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    deleteLabel: { color: colors.dangerButtonText, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
    descCard: {
      marginTop: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 6,
    },
    descTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    descText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
    specCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 10,
    },
    specTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
    specRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    specIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.buttonBg,
    },
    specLabel: { color: colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
    specValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
    contactBtn: {
      marginTop: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    contactLabel: {
      color: colors.primaryButtonText,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    galleryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    galleryCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    galleryCounter: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    galleryHeaderSpacer: { width: 40 },
  });
}
