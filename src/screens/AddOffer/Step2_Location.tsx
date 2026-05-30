import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Easing, Pressable, LayoutAnimation, UIManager, Modal, ActivityIndicator } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import { AddOfferFieldHint } from '../../components/AddOfferValidation';
import { ADD_OFFER_STREET_MIN } from './validation';
import {
  STRICT_CITIES,
  STRICT_CITY_DISTRICTS,
  REST_OF_COUNTRY_CITY,
  DEFAULT_LOCALITY_COUNTRY,
  DEFAULT_LOCALITY_COUNTRY_CODE,
  buildGeocodeQuery,
  resolveLocalityCountryFromPlace,
  localityCountryIso,
  normalizeLocalityCountryLabel,
  getLocationDraftRepairPatch,
  getDraftLocationPresentation,
  locationDraftPatchHasChanges,
  type LocationDraftFieldsPatch,
  localityNameFromGeocodedPlace,
  countryFieldsFromGeocodedPlace,
  resolveIsExactLocation,
  stripHouseNumber,
  streetLineFromGeocodedPlace,
  resolvePinLocationFromGeocodedPlace,
  preserveVillageStreetHint,
  detectSatelliteMunicipalityFromCoordinates,
  detectStrictCityFromCoordinates,
} from '../../constants/locationEcosystem';
import { flagEmojiFromIso2 } from '../../utils/phoneRegions';
import { coordKeyForCityDistrict } from './districtCoordKeys';
import { useI18n } from '../../i18n';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Colors = { primary: '#10b981' };

const DISTRICT_COORDS: Record<string, { lat: number, lng: number }> = {
  // WARSZAWA — centroidy poprawione na faktyczne geometryczne środki dzielnic
  // (poprzednie wartości miały Białołękę w NW narożniku, przez co Echa Leśne
  // — fizycznie Białołęka, geograficznie ~52.31, 21.02 — przegrywały dystans
  // z centroidem Targówka 52.28, 21.05 i były błędnie klasyfikowane).
  'Warszawa': { lat: 52.2297, lng: 21.0122 },
  'Bemowo': { lat: 52.2540, lng: 20.9100 },
  'Białołęka': { lat: 52.3300, lng: 21.0400 },     // FIX: było 52.324/20.97 (NW narożnik); poprawne ~52.33/21.04
  'Bielany': { lat: 52.2900, lng: 20.9400 },
  'Mokotów': { lat: 52.1930, lng: 21.0290 },
  'Ochota': { lat: 52.2110, lng: 20.9850 },
  'Praga-Południe': { lat: 52.2470, lng: 21.0900 },  // FIX: było 52.239/21.0825; przesunięcie na E
  'Praga-Północ': { lat: 52.2600, lng: 21.0400 },    // FIX: było 52.258/21.033
  'Rembertów': { lat: 52.2650, lng: 21.1900 },       // FIX: było 21.162; właściwe ~21.19
  'Śródmieście': { lat: 52.2310, lng: 21.0120 },
  'Targówek': { lat: 52.2950, lng: 21.0450 },        // FIX: było 52.28/21.05; centroid leży nieco wyżej
  'Ursus': { lat: 52.1960, lng: 20.8860 },
  'Ursynów': { lat: 52.1400, lng: 21.0450 },
  'Wawer': { lat: 52.2150, lng: 21.1830 },           // FIX: było 21.166; właściwe ~21.183
  'Wesoła': { lat: 52.2470, lng: 21.2300 },
  'Wilanów': { lat: 52.1660, lng: 21.0900 },
  'Włochy': { lat: 52.1960, lng: 20.9450 },
  'Wola': { lat: 52.2360, lng: 20.9580 },
  'Żoliborz': { lat: 52.2730, lng: 20.9840 },
  
  // ŁÓDŹ
  'Łódź': { lat: 51.7592, lng: 19.4560 }, 'Bałuty': { lat: 51.8003, lng: 19.4244 }, 'Górna': { lat: 51.7225, lng: 19.4756 },
  'Polesie': { lat: 51.7578, lng: 19.4186 }, 'Widzew': { lat: 51.7600, lng: 19.5300 },
  
  // KRAKÓW
  'Kraków': { lat: 50.0614, lng: 19.9366 }, 'Stare Miasto': { lat: 50.0614, lng: 19.9366 }, 'Grzegórzki': { lat: 50.0583, lng: 19.9583 },
  'Prądnik Czerwony': { lat: 50.0883, lng: 19.9692 }, 'Prądnik Biały': { lat: 50.0933, lng: 19.9300 }, 'Krowodrza': { lat: 50.0733, lng: 19.9183 },
  'Bronowice': { lat: 50.0817, lng: 19.8833 }, 'Zwierzyniec': { lat: 50.0533, lng: 19.8833 }, 'Dębniki': { lat: 50.0350, lng: 19.9100 },
  'Łagiewniki-Borek Fałęcki': { lat: 50.0183, lng: 19.9317 }, 'Swoszowice': { lat: 49.9883, lng: 19.9383 }, 'Podgórze Duchackie': { lat: 50.0167, lng: 19.9617 },
  'Bieżanów-Prokocim': { lat: 50.0167, lng: 20.0050 }, 'Podgórze': { lat: 50.0350, lng: 19.9617 }, 'Czyżyny': { lat: 50.0733, lng: 20.0050 },
  'Mistrzejowice': { lat: 50.0967, lng: 20.0133 }, 'Bieńczyce': { lat: 50.0867, lng: 20.0267 }, 'Wzgórza Krzesławickie': { lat: 50.0983, lng: 20.0650 },
  'Nowa Huta': { lat: 50.0717, lng: 20.0383 },

  // WROCŁAW
  'Wrocław': { lat: 51.1079, lng: 17.0385 }, 'Biskupin': { lat: 51.103, lng: 17.100 }, 'Borek': { lat: 51.080, lng: 17.000 },
  'Fabryczna': { lat: 51.1110, lng: 16.9630 }, 'Gaj': { lat: 51.075, lng: 17.040 }, 'Gądów Mały': { lat: 51.127, lng: 16.965 },
  'Grabiszyn': { lat: 51.093, lng: 16.990 }, 'Huby': { lat: 51.085, lng: 17.040 }, 'Jagodno': { lat: 51.050, lng: 17.055 },
  'Karłowice': { lat: 51.140, lng: 17.045 }, 'Kozanów': { lat: 51.135, lng: 16.960 }, 'Krzyki': { lat: 51.0760, lng: 17.0120 },
  'Leśnica': { lat: 51.145, lng: 16.870 }, 'Maślice': { lat: 51.155, lng: 16.930 }, 'Muchobór': { lat: 51.105, lng: 16.940 },
  'Nadodrze': { lat: 51.120, lng: 17.030 }, 'Ołbin': { lat: 51.125, lng: 17.050 }, 'Oporów': { lat: 51.075, lng: 16.970 },
  'Popowice': { lat: 51.130, lng: 16.985 }, 'Psie Pole': { lat: 51.1440, lng: 17.1080 }, 'Stare Miasto WRO': { lat: 51.1079, lng: 17.0385 },
  'Szczepin': { lat: 51.115, lng: 17.005 }, 'Śródmieście WRO': { lat: 51.1190, lng: 17.0540 }, 'Tarnogaj': { lat: 51.070, lng: 17.055 },

  // POZNAŃ
  'Poznań': { lat: 52.4064, lng: 16.9252 }, 'Antoninek': { lat: 52.405, lng: 17.000 }, 'Chartowo': { lat: 52.390, lng: 16.980 },
  'Dębiec': { lat: 52.375, lng: 16.905 }, 'Górczyn': { lat: 52.380, lng: 16.880 }, 'Grunwald': { lat: 52.392, lng: 16.873 },
  'Jeżyce': { lat: 52.413, lng: 16.890 }, 'Junikowo': { lat: 52.385, lng: 16.850 }, 'Łazarz': { lat: 52.395, lng: 16.900 },
  'Naramowice': { lat: 52.450, lng: 16.940 }, 'Nowe Miasto POZ': { lat: 52.395, lng: 16.965 }, 'Ogrody': { lat: 52.420, lng: 16.880 },
  'Piątkowo': { lat: 52.455, lng: 16.910 }, 'Podolany': { lat: 52.450, lng: 16.890 }, 'Rataje': { lat: 52.385, lng: 16.955 },
  'Sołacz': { lat: 52.425, lng: 16.905 }, 'Stare Miasto POZ': { lat: 52.406, lng: 16.925 }, 'Strzeszyn': { lat: 52.455, lng: 16.865 },
  'Świerczewo': { lat: 52.365, lng: 16.890 }, 'Wilda': { lat: 52.388, lng: 16.922 }, 'Winogrady': { lat: 52.435, lng: 16.925 }, 'Winiary': { lat: 52.430, lng: 16.910 },

  // TRÓJMIASTO
  'Gdańsk - Śródmieście': { lat: 54.352, lng: 18.646 }, 'Gdańsk - Wrzeszcz': { lat: 54.380, lng: 18.605 }, 'Gdańsk - Oliwa': { lat: 54.409, lng: 18.563 },
  'Gdańsk - Przymorze': { lat: 54.410, lng: 18.595 }, 'Gdańsk - Zaspa': { lat: 54.395, lng: 18.605 }, 'Gdańsk - Osowa': { lat: 54.425, lng: 18.460 },
  'Gdańsk - Chełm': { lat: 54.335, lng: 18.620 }, 'Gdańsk - Jasień': { lat: 54.335, lng: 18.565 },
  'Gdynia - Śródmieście': { lat: 54.518, lng: 18.530 }, 'Gdynia - Orłowo': { lat: 54.480, lng: 18.560 }, 'Gdynia - Redłowo': { lat: 54.495, lng: 18.540 }, 'Gdynia - Chylonia': { lat: 54.535, lng: 18.470 },
  'Sopot - Dolny': { lat: 54.445, lng: 18.565 }, 'Sopot - Górny': { lat: 54.440, lng: 18.550 },

  // LUBLIN
  'Lublin': { lat: 51.2465, lng: 22.5684 }, 'Śródmieście LUB': { lat: 51.2465, lng: 22.5684 }, 'Czechów': { lat: 51.2710, lng: 22.5530 },
  'LSM': { lat: 51.2360, lng: 22.5350 }, 'Czuby': { lat: 51.2190, lng: 22.5200 }, 'Węglin': { lat: 51.2310, lng: 22.4890 },
  'Kalinowszczyzna': { lat: 51.2610, lng: 22.5850 }, 'Felin': { lat: 51.2360, lng: 22.6260 }, 'Tatary': { lat: 51.2520, lng: 22.6000 },

  // ZAMOŚĆ
  'Zamość': { lat: 50.7231, lng: 23.2519 }, 'Stare Miasto ZAM': { lat: 50.7231, lng: 23.2519 }, 'Nowe Miasto ZAM': { lat: 50.7200, lng: 23.2700 },
  'Karolówka': { lat: 50.7300, lng: 23.2300 }, 'Planty ZAM': { lat: 50.7150, lng: 23.2500 },

  // POZOSTAŁE MIASTA Z BACKENDU
  'Gdańsk': { lat: 54.3520, lng: 18.6466 },
  'Gdynia': { lat: 54.5189, lng: 18.5305 },
  'Sopot': { lat: 54.4416, lng: 18.5601 },
  'Katowice': { lat: 50.2649, lng: 19.0238 },
  'Rybnik': { lat: 50.0971, lng: 18.5418 },
  'Białystok': { lat: 53.1325, lng: 23.1688 },
  [REST_OF_COUNTRY_CITY]: { lat: 51.9194, lng: 19.1451 },
};

const DISTRICTS_DATA: Record<string, string[]> = {
  ...STRICT_CITY_DISTRICTS,
};
const STRICT_CITY_SET = new Set<string>(STRICT_CITIES as unknown as string[]);
const POLISH_STRICT_CITIES = STRICT_CITIES.filter((c) => c !== REST_OF_COUNTRY_CITY);
const DEFAULT_STRICT_CITY = STRICT_CITIES[0];

/**
 * Polilinia trasy S8 (Trasa Armii Krajowej / Toruńska) — fizyczna północna
 * granica Targówka i Pragi-Północ z Białołęką w Warszawie.
 *
 * UŻYTKOWNIK JAKO ŹRÓDŁO PRAWDY
 * ─────────────────────────────
 * Mieszkańcy Warszawy znają tę regułę: wszystko po PÓŁNOCNEJ stronie S8
 * (między Wisłą a węzłem Marki) administracyjnie należy do Białołęki.
 * Apple `place.district` potrafi się pomylić przy granicy, Voronoi też
 * nie ma sztywnej wiedzy o trasach — więc dajemy mu deterministyczną
 * regułę „za S8 = Białołęka".
 *
 * GEOMETRIA
 * ─────────
 * S8 nie biegnie idealnie po szerokości — od mostu Grota (zachód) lekko
 * opada na południe ku węzłowi Marki (wschód). Reprezentujemy ją jako
 * polilinię 6 punktów; dla dowolnej długości geograficznej znajdujemy
 * szerokość trasy przez liniową interpolację między dwoma sąsiednimi
 * węzłami. Reguła obowiązuje WYŁĄCZNIE w zakresie lng 20.975-21.095
 * (od mostu Grota do węzła Marki) — poza tym zakresem S8 biegnie przez
 * Bielany / inne dzielnice, gdzie reguła „N=Białołęka" nie obowiązuje.
 */
const S8_LINE: Array<{ lng: number; lat: number }> = [
  // WAŻNE: poprzednia wersja miała S8 przesuniętą za bardzo na południe
  // (ok. 500-900 m), przez co część Bródna łapała się jako „N od S8”.
  // Ten przebieg jest podniesiony do realnej osi Toruńskiej/AK nad Bródnem.
  { lng: 20.9750, lat: 52.3060 }, // Most Grota-Roweckiego (Wisła)
  { lng: 21.0000, lat: 52.3056 }, // rejon Wisłostrady / Tarchomin
  { lng: 21.0200, lat: 52.3050 }, // Modlińska / Annopol
  { lng: 21.0450, lat: 52.3044 }, // nad Bródnem (Kondratowicza/Krasnobrodzka zostają S od linii)
  { lng: 21.0700, lat: 52.3039 }, // Zacisze / Targówek Fabryczny
  { lng: 21.0950, lat: 52.3034 }, // Marki / Drewnica
];

/**
 * Zwraca szerokość geograficzną trasy S8 dla zadanej długości geograficznej,
 * używając liniowej interpolacji między węzłami polilinii.
 *
 * Zwraca `null` jeśli lng wykracza poza zakres polilinii — wtedy reguła
 * „za S8 = Białołęka" się NIE stosuje (np. punkty w Bielanach na zachodzie
 * od mostu Grota lub w Markach na wschodzie od Drewnicy).
 */
function s8LatitudeAtLongitude(lng: number): number | null {
  if (lng < S8_LINE[0].lng || lng > S8_LINE[S8_LINE.length - 1].lng) return null;
  for (let i = 0; i < S8_LINE.length - 1; i++) {
    const a = S8_LINE[i];
    const b = S8_LINE[i + 1];
    if (lng >= a.lng && lng <= b.lng) {
      const t = (lng - a.lng) / (b.lng - a.lng);
      return a.lat + t * (b.lat - a.lat);
    }
  }
  return null;
}

/**
 * Voronoi-style „zarodki" dla dzielnic Warszawy.
 *
 * DLACZEGO TO ISTNIEJE
 * ─────────────────────
 * Apple Maps reverse-geocoding (`place.district`) jest źródłem prawdy, ale:
 *  • na iPad/iOS simulatorze pole `district` często wraca puste/null,
 *  • dla adresów blisko granic dzielnic API zwraca czasem street-level locality
 *    zamiast administracyjnej dzielnicy.
 *
 * Stary fallback miał JEDEN centroid per dzielnica i liczył haversine. To
 * było beznadziejne dla dzielnic-gigantów (Białołęka ciągnie się ~12 km
 * z południa na północ od Annopola po Choszczówkę — centroid w środku
 * geometrycznym nie pomaga punktom w jej południowej połowie, bo bliżej
 * jest do centroidu Targówka).
 *
 * Z wieloma zarodkami:
 *  1. Dla każdej dzielnicy mamy 2-8 reprezentatywnych punktów rozsianych
 *     po jej rzeczywistym obszarze (osiedla, węzły, granice).
 *  2. Dystans punktu do dzielnicy = MIN(distance do każdego zarodka tej dzielnicy).
 *  3. Wybieramy dzielnicę z najmniejszą wartością.
 *
 * To jest aproksymacja diagramu Voronoi — bez ciężaru polygonów (GeoJSON),
 * ale praktycznie tak samo dokładna dla naszego celu (poprawne dopasowanie
 * adresu do dzielnicy administracyjnej).
 *
 * Współrzędne wybrane ręcznie — środki osiedli i charakterystyczne lokacje,
 * NIE czyste centroidy geometryczne (które zawodzą dla dzielnic L-shaped).
 */
const WARSZAWA_DISTRICT_SEEDS: Record<string, Array<{ lat: number; lng: number }>> = {
  // Białołęka — olbrzymia dzielnica, 8 zarodków
  'Białołęka': [
    { lat: 52.3450, lng: 20.9750 }, // Tarchomin
    { lat: 52.3550, lng: 20.9850 }, // Nowodwory
    { lat: 52.3500, lng: 21.0200 }, // Henryków
    { lat: 52.3580, lng: 21.0450 }, // Białołęka Dworska
    { lat: 52.3650, lng: 21.0300 }, // Choszczówka
    { lat: 52.3200, lng: 20.9850 }, // Brzeziny / Marywilska N
    { lat: 52.3100, lng: 20.9800 }, // Marywilska / Echa Leśne S
    { lat: 52.3050, lng: 21.0050 }, // Annopol / Żerań
  ],
  // Targówek — 4 zarodki, dzielnica L-shaped
  'Targówek': [
    { lat: 52.3000, lng: 21.0430 }, // Bródno-Podgrodzie
    { lat: 52.2920, lng: 21.0500 }, // Targówek Mieszkaniowy
    { lat: 52.2950, lng: 21.0700 }, // Zacisze
    { lat: 52.2820, lng: 21.0750 }, // Targówek Fabryczny
  ],
  // Praga-Północ — 3 zarodki
  'Praga-Północ': [
    { lat: 52.2600, lng: 21.0400 }, // Stara Praga
    { lat: 52.2660, lng: 21.0550 }, // Szmulowizna
    { lat: 52.2540, lng: 21.0350 }, // Nowa Praga
  ],
  // Praga-Południe — 5 zarodków, rozciągnięta na E
  'Praga-Południe': [
    { lat: 52.2470, lng: 21.0750 }, // Saska Kępa
    { lat: 52.2450, lng: 21.0950 }, // Grochów
    { lat: 52.2380, lng: 21.0700 }, // Kamionek
    { lat: 52.2280, lng: 21.1050 }, // Gocław
    { lat: 52.2540, lng: 21.0820 }, // Kępa Gocławska
  ],
  // Mokotów — 4 zarodki
  'Mokotów': [
    { lat: 52.1980, lng: 21.0190 }, // Stary Mokotów
    { lat: 52.1850, lng: 21.0250 }, // Stegny
    { lat: 52.1900, lng: 21.0450 }, // Sadyba
    { lat: 52.1950, lng: 21.0050 }, // Mokotów Górny
  ],
  // Wola — 3 zarodki
  'Wola': [
    { lat: 52.2380, lng: 20.9580 }, // Centrum Woli
    { lat: 52.2260, lng: 20.9700 }, // Mirów
    { lat: 52.2480, lng: 20.9500 }, // Ulrychów
  ],
  // Bielany — 3 zarodki
  'Bielany': [
    { lat: 52.2900, lng: 20.9450 }, // Centrum Bielan
    { lat: 52.3000, lng: 20.9100 }, // Wrzeciono
    { lat: 52.2800, lng: 20.9550 }, // Marymont
  ],
  // Bemowo — 3 zarodki
  'Bemowo': [
    { lat: 52.2520, lng: 20.9100 }, // Bemowo Centrum
    { lat: 52.2400, lng: 20.8950 }, // Jelonki
    { lat: 52.2620, lng: 20.9050 }, // Boernerowo
  ],
  // Ursynów — 3 zarodki
  'Ursynów': [
    { lat: 52.1480, lng: 21.0450 }, // Imielin
    { lat: 52.1380, lng: 21.0300 }, // Kabaty
    { lat: 52.1600, lng: 21.0500 }, // Stokłosy
  ],
  // Wawer — 4 zarodki, ogromna dzielnica
  'Wawer': [
    { lat: 52.2200, lng: 21.1400 }, // Marysin
    { lat: 52.1950, lng: 21.1850 }, // Anin
    { lat: 52.2050, lng: 21.1700 }, // Międzylesie
    { lat: 52.2300, lng: 21.1550 }, // Gocławek
  ],
  // Pojedyncze centroidy wystarczą dla małych dzielnic
  'Śródmieście': [{ lat: 52.2310, lng: 21.0120 }, { lat: 52.2400, lng: 21.0080 }],
  'Ochota': [{ lat: 52.2110, lng: 20.9850 }, { lat: 52.2200, lng: 20.9900 }],
  'Włochy': [
    { lat: 52.1960, lng: 20.9450 },
    { lat: 52.1860, lng: 20.9250 },
    { lat: 52.1785, lng: 20.9850 }, // Okęcie / Raków — granica z Mokotowem
  ],
  'Ursus': [{ lat: 52.1960, lng: 20.8860 }],
  'Wilanów': [{ lat: 52.1660, lng: 21.0900 }, { lat: 52.1550, lng: 21.0950 }],
  'Żoliborz': [{ lat: 52.2730, lng: 20.9840 }, { lat: 52.2680, lng: 20.9900 }],
  'Rembertów': [{ lat: 52.2650, lng: 21.1900 }],
  'Wesoła': [{ lat: 52.2470, lng: 21.2300 }, { lat: 52.2550, lng: 21.2200 }],
};

const DISTRICT_CITY_USAGE = Object.values(STRICT_CITY_DISTRICTS).reduce<Record<string, number>>((acc, districts) => {
  districts.forEach((district) => {
    acc[district] = (acc[district] || 0) + 1;
  });
  return acc;
}, {});

const RedNeedlePin = () => {
  const levitateAnim = useRef(new Animated.Value(0)).current;
  const redWaveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(levitateAnim, { toValue: -12, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(levitateAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
    Animated.loop(Animated.timing(redWaveAnim, { toValue: 1, duration: 2500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
  }, []);

  return (
    <View style={styles.precisePinWrapper}>
      <Animated.View style={{ transform: [{ translateY: levitateAnim }], alignItems: 'center', justifyContent: 'flex-end' }}>
        <Animated.View style={[styles.redWave, { transform: [{ scale: redWaveAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3.5] }) }], opacity: redWaveAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }) }]} />
        <View style={{ alignItems: 'center', zIndex: 3 }}>
          <View style={[styles.pinHead, { backgroundColor: '#ef4444' }]} />
          <View style={[styles.pinNeedle, { backgroundColor: '#9ca3af' }]} />
          <View style={styles.pinContactPoint} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.pinShadowMap, { opacity: levitateAnim.interpolate({ inputRange: [-12, 0], outputRange: [0.2, 0.7] }), transform: [{ scale: levitateAnim.interpolate({ inputRange: [-12, 0], outputRange: [0.5, 1] }) }] }]} />
    </View>
  );
};

const BreathingCircle = () => {
  const pulseValue = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseValue, { toValue: 1.12, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseValue, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ])).start();
  }, []);
  return <Animated.View style={[styles.approximateArea, styles.glowShadow, { transform: [{ scale: pulseValue }], opacity: pulseValue.interpolate({ inputRange: [1, 1.12], outputRange: [0.9, 0.5] }) }]} />;
};

/**
 * MapInteractionTip — luksusowa, samowyjaśniająca się instrukcja gestów mapy.
 *
 * KIEDY SIĘ POJAWIA
 * ─────────────────
 * Pojawia się natychmiast po wejściu w Krok 2 (Lokalizacja) Add Offer i pozostaje
 * widoczna, dopóki użytkownik faktycznie nie przesunie/nie zooma mapy. Po pierwszej
 * interakcji z mapą `dismissed` przełącza się na true i tip płynnie znika (fade +
 * lift) — nie zaśmieca widoku, gdy user już rozumie zasadę. Wraca tylko po
 * pełnym remount'cie ekranu.
 *
 * CZEMU SŁUŻY
 * ───────────
 * Bez tej podpowiedzi user często nie wie, że:
 *   • mapę można przesuwać palcem (drag), żeby ustawić pinezkę dokładnie tam,
 *     gdzie jest jego nieruchomość,
 *   • mapę można zbliżać/oddalać szczypcami (pinch), żeby trafić precyzyjnie,
 *   • pole „Wyszukaj adres" musi pokrywać się z punktem pinezki — pinezka to
 *     źródło prawdy, pole adresu aktualizuje się z reverse-geocoding po
 *     każdym ruchu, ale to USER decyduje gdzie pinezka stoi.
 *
 * CO ZAWIERA
 * ──────────
 *   • Animowana ikona „przesuwającego się palca" (drag-gesture loop)
 *   • Tytuł „Przesuń mapę, by ustawić pinezkę" (15pt 800)
 *   • Subtitle wyjaśniający „Mapę można przybliżać szczypcami. Pinezka musi
 *     wskazywać dokładny adres nieruchomości."
 *   • Glassmorphic BlurView + delikatny czerwony halo (zgodny z kolorem pinezki)
 */
const MapInteractionTip = ({
  isDark,
  dismissed,
  t,
}: {
  isDark: boolean;
  dismissed: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const fingerX = useRef(new Animated.Value(0)).current;
  const fingerOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardLift = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(cardLift, { toValue: 0, friction: 9, tension: 80, useNativeDriver: true }),
    ]).start();
  }, [cardOpacity, cardLift]);

  useEffect(() => {
    if (dismissed) {
      Animated.parallel([
        Animated.timing(cardOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(cardLift, { toValue: -12, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [dismissed, cardOpacity, cardLift]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fingerOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(fingerX, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.timing(fingerX, { toValue: 24, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fingerOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(fingerOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.timing(fingerX, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.timing(fingerX, { toValue: -24, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(fingerOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(420),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fingerOpacity, fingerX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.mapTipWrapper,
        { opacity: cardOpacity, transform: [{ translateY: cardLift }] },
      ]}
    >
      <BlurView
        intensity={isDark ? 50 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.mapTipCard,
          {
            backgroundColor: isDark ? 'rgba(20,20,22,0.72)' : 'rgba(255,255,255,0.82)',
            borderColor: 'rgba(220,38,38,0.35)',
          },
        ]}
      >
        <View style={styles.mapTipGestureBubble}>
          {/* Tor po którym sunie palec — wizualnie „kierunek przesuwania" */}
          <View style={styles.mapTipGestureTrack} />
          <Animated.View
            style={[
              styles.mapTipFingerDot,
              { opacity: fingerOpacity, transform: [{ translateX: fingerX }] },
            ]}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mapTipTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {t('addOffer.step2.mapTip.title')}
          </Text>
          <Text style={[styles.mapTipSubtitle, { color: isDark ? 'rgba(235,235,245,0.74)' : 'rgba(60,60,67,0.7)' }]}>
            {t('addOffer.step2.mapTip.subtitle')}
          </Text>
        </View>
      </BlurView>
    </Animated.View>
  );
};

/**
 * Normalizuje string do porównań — usuwa znaki diakrytyczne,
 * sprowadza do małych liter, scala spacje, ujednolica myślniki.
 * „Białołęka" / „Bialoleka" / „BIAŁOŁĘKA" → „bialoleka".
 */
const normalizeForMatch = (raw: string): string => {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ł]/g, 'l')
    .replace(/[-_/]/g, ' ')
    .replace(/[.,;:()]+/g, ' ')
    .replace(/[–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Próbuje dopasować nazwę dzielnicy zwróconą z `Location.reverseGeocodeAsync`
 * (`place.district`) do naszej listy dzielnic dla danego miasta.
 *
 * Apple Maps zwraca nazwę dzielnicy w wielu wariantach — z polskimi znakami,
 * bez nich, czasem z dopiskami typu „Stara" / „Nowa". Stosujemy 3 strategie
 * po kolei: 1) dopasowanie 1:1 po normalizacji, 2) prefix-match, 3) substring.
 * Zwraca dokładnie tę nazwę z naszej listy (z polskimi znakami), albo null.
 */
const matchDistrictByName = (rawDistrict: string | null | undefined, city: string): string | null => {
  if (!rawDistrict) return null;
  const cityDistricts = DISTRICTS_DATA[city as keyof typeof DISTRICTS_DATA];
  if (!cityDistricts || cityDistricts.length === 0) return null;
  const needle = normalizeForMatch(rawDistrict);
  if (!needle) return null;

  // Warszawa: "Praga" bez kierunku jest niejednoznaczna — nie zgadujemy.
  // Jeśli OS zwróci tylko "Praga", oddajemy sterowanie fallbackowi geograficznemu.
  if (city === 'Warszawa' && /\bpraga\b/.test(needle)) {
    if (/\b(polnoc|pn)\b/.test(needle)) return 'Praga-Północ';
    if (/\b(poludnie|pd|poludniowa)\b/.test(needle)) return 'Praga-Południe';
    if (needle === 'praga') return null;
  }

  // 1) exact match po normalizacji
  for (const district of cityDistricts) {
    if (normalizeForMatch(district) === needle) return district;
  }
  // 2) prefix — np. „Praga" w place.district vs „Praga-Północ" w naszej liście
  let prefixMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeForMatch(district);
    if (n.startsWith(needle) || needle.startsWith(n)) {
      if (prefixMatch && prefixMatch !== district) {
        // Niejednoznaczny prefix (np. "Praga") — zostawiamy decyzję geometrii.
        return null;
      }
      prefixMatch = district;
    }
  }
  if (prefixMatch) return prefixMatch;
  // 3) substring — np. „Stare Mokotów" → „Mokotów"
  let substringMatch: string | null = null;
  for (const district of cityDistricts) {
    const n = normalizeForMatch(district);
    if (n.includes(needle) || needle.includes(n)) {
      if (substringMatch && substringMatch !== district) {
        return null;
      }
      substringMatch = district;
    }
  }
  return substringMatch;
};

/**
 * Geograficzny dystans między dwoma punktami w sferze ziemskiej (km, haversine).
 * Używamy do porównań między centroidem dzielnicy a wskazanym punktem.
 * Pythagoras na surowych lat/lng był BŁĘDNY — na 52°N stopień długości
 * ma ~67 km a stopień szerokości ~111 km, więc nieważony dystans
 * w stopniach faworyzował błędne dzielnice.
 */
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // promień Ziemi w km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

/**
 * Wybiera najlepszą dzielnicę dla punktu (lat, lng) w danym mieście.
 *
 * 4-poziomowy priorytet:
 *   0. **HARD GEO RULE — Warszawa, S8 (DWUSTRONNA)**:
 *      - pin na N od S8 (z buforem) => zawsze Białołęka,
 *      - pin na S od S8 (z buforem) => Białołęka jest zabroniona.
 *      To eliminuje oba rodzaje pomyłek:
 *        a) Białołęka oznaczana jako Targówek,
 *        b) Targówek oznaczany jako Białołęka.
 *   1. `place.district` z reverse-geocoding (z fuzzy match) — gdy OS go zwrócił.
 *      Uwaga: jeśli `place.district === "Białołęka"` ale pin leży po stronie
 *      południowej S8, ignorujemy tę wartość jako błąd geokodera.
 *   2. Voronoi po WIELU zarodkach na dzielnicę (`WARSZAWA_DISTRICT_SEEDS`).
 *   3. Stary jednocentroidowy fallback (haversine) — dla miast bez seedów.
 */
const getClosestDistrict = (
  lat: number,
  lng: number,
  city: string,
  placeDistrict?: string | null
) => {
  if (city === REST_OF_COUNTRY_CITY) return '';
  const cityDistricts = DISTRICTS_DATA[city as keyof typeof DISTRICTS_DATA];
  if (!cityDistricts || cityDistricts.length === 0) return '';

  const isWarszawa = city === 'Warszawa';
  const s8Lat = isWarszawa ? s8LatitudeAtLongitude(lng) : null;
  const s8Tolerance = 0.0009; // ~100 m marginesu na niepewność GPS/geokodera
  const isNorthOfS8 = s8Lat !== null && lat >= s8Lat + s8Tolerance;
  const isSouthOfS8 = s8Lat !== null && lat <= s8Lat - s8Tolerance;

  // POZIOM 0A: twarda reguła północna — ponad S8 = Białołęka.
  if (isWarszawa && cityDistricts.includes('Białołęka') && isNorthOfS8) {
    if (__DEV__) {
      console.log(
        `[district-detect] S8 north override → Białołęka (pin ${lat.toFixed(4)} > S8 ${s8Lat?.toFixed(4)} @ ${lng.toFixed(4)})`
      );
    }
    return 'Białołęka';
  }

  // POZIOM 1: priorytetowo — dzielnica zwrócona z systemu reverse-geocoding
  const matched = matchDistrictByName(placeDistrict, city);
  if (matched) {
    // POZIOM 0B: twarda reguła południowa — pod S8 nie dopuszczamy Białołęki.
    if (isWarszawa && isSouthOfS8 && matched === 'Białołęka') {
      if (__DEV__) {
        console.log(
          `[district-detect] S8 south guard: ignoruję place.district=Białołęka (pin ${lat.toFixed(4)} < S8 ${s8Lat?.toFixed(4)} @ ${lng.toFixed(4)})`
        );
      }
    } else {
      return matched;
    }
  }

  // Diagnostyka: gdy reverse-geocoding nie zwrócił dzielnicy (na simulatorze
  // częste), logujemy z którego mechanizmu fallback skorzystaliśmy.
  if (__DEV__ && (!placeDistrict || !String(placeDistrict).trim())) {
    console.log(
      `[district-detect] ${city}: place.district pusty dla (${lat.toFixed(4)}, ${lng.toFixed(4)}), używam fallback (zarodki/centroidy).`
    );
  }

  // POZIOM 2: Voronoi po wielu zarodkach (Warszawa — z `WARSZAWA_DISTRICT_SEEDS`)
  if (city === 'Warszawa') {
    const candidateDistricts =
      isSouthOfS8 && cityDistricts.includes('Białołęka')
        ? cityDistricts.filter((d) => d !== 'Białołęka')
        : cityDistricts;

    let bestDistrict = '';
    let bestKm = Infinity;
    for (const district of candidateDistricts) {
      const seeds = WARSZAWA_DISTRICT_SEEDS[district];
      if (!seeds || seeds.length === 0) continue;
      let minKmForThisDistrict = Infinity;
      for (const seed of seeds) {
        const km = haversineKm(lat, lng, seed.lat, seed.lng);
        if (km < minKmForThisDistrict) minKmForThisDistrict = km;
      }
      if (minKmForThisDistrict < bestKm) {
        bestKm = minKmForThisDistrict;
        bestDistrict = district;
      }
    }
    if (bestDistrict) {
      if (__DEV__) {
        console.log(
          `[district-detect] Warszawa: zarodek-Voronoi → ${bestDistrict} (${bestKm.toFixed(2)} km)`
        );
      }
      return bestDistrict;
    }
  }

  // POZIOM 3: stary fallback — najbliższy pojedynczy centroid (Kraków/Łódź/etc.)
  const centroidCandidateDistricts =
    isWarszawa && isSouthOfS8 && cityDistricts.includes('Białołęka')
      ? cityDistricts.filter((d) => d !== 'Białołęka')
      : cityDistricts;
  let closest = centroidCandidateDistricts[0];
  let minKm = Infinity;
  for (const district of centroidCandidateDistricts) {
    const key = coordKeyForCityDistrict(city, district);
    const coords = DISTRICT_COORDS[key];
    if (!coords) continue;
    const km = haversineKm(lat, lng, coords.lat, coords.lng);
    if (km < minKm) {
      minKm = km;
      closest = district;
    }
  }
  return closest;
};

const POLAND_LOCATION = {
  localityCountry: DEFAULT_LOCALITY_COUNTRY,
  localityCountryCode: DEFAULT_LOCALITY_COUNTRY_CODE,
} as const;

const normalizeStrictLocation = (
  cityCandidate: string | null | undefined,
  districtCandidate?: string | null,
  restLocality?: string | null,
  place?: Location.LocationGeocodedAddress | null,
) => {
  const countryFields = countryFieldsFromGeocodedPlace(place);
  const cand = String(cityCandidate || '').trim();
  if (!STRICT_CITY_SET.has(cand)) {
    const locality = (restLocality || '').trim() || 'Ogólna';
    return {
      city: REST_OF_COUNTRY_CITY,
      district: locality,
      ...countryFields,
    };
  }
  if (cand === REST_OF_COUNTRY_CITY) {
    const d = (districtCandidate || restLocality || '').trim() || 'Ogólna';
    return {
      city: REST_OF_COUNTRY_CITY,
      district: d,
      ...countryFields,
    };
  }
  const city = cand;
  const districts = DISTRICTS_DATA[city] || [];
  const district = districts.includes(String(districtCandidate || ''))
    ? String(districtCandidate)
    : districts[0] || '';
  return { city, district, ...POLAND_LOCATION };
};

const resolvePlaceToNormalizedLocation = (
  place: Location.LocationGeocodedAddress,
  lat: number,
  lng: number,
  streetHint?: string,
  anchorStrictCity?: string | null,
) => {
  const hint = streetHint ?? streetLineFromGeocodedPlace(place, '');
  const anchor =
    anchorStrictCity && STRICT_CITY_SET.has(anchorStrictCity) ? anchorStrictCity : null;
  const resolution = resolvePinLocationFromGeocodedPlace(place, {
    streetHint: hint,
    lat,
    lng,
    anchorStrictCity: anchor,
  });
  if (resolution.mode === 'strict') {
    return normalizeStrictLocation(
      resolution.strictCity,
      getClosestDistrict(lat, lng, resolution.strictCity, place.district),
      null,
      place,
    );
  }
  return {
    city: resolution.city,
    district: resolution.district,
    localityCountry: resolution.localityCountry,
    localityCountryCode: resolution.localityCountryCode,
  };
};

export default function Step2_Location({ theme }: { theme: any }) {
  const { t } = useI18n();
  const { draft, updateDraft, setCurrentStep, setNavigationGate } = useOfferStore();
  const [streetInput, setStreetInput] = useState(draft.street || '');
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  // Zapamiętujemy całą akcję nawigacji (GO_BACK / NAVIGATE / POP / PUSH itd.),
  // żeby po wciśnięciu "Zatwierdź" dispatchować dokładnie to, co user chciał,
  // niezależnie od kierunku ruchu w kreatorze.
  const pendingNavActionRef = useRef<any>(null);
  // Flaga: czy user już rzeczywiście dotknął mapy (drag/pinch). Sterujemy nią
  // widocznością `MapInteractionTip` — po pierwszej interakcji tip zanika,
  // żeby nie zaśmiecać widoku po tym, jak user zrozumiał zasadę.
  const [userInteractedWithMap, setUserInteractedWithMap] = useState(false);
  const [locatingDevice, setLocatingDevice] = useState(false);
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<any>();
  
  const isProgrammaticMove = useRef(false);
  const geoCacheRef = useRef<Record<string, { lat: number; lng: number }>>({});
  const allowStep3NavigationRef = useRef(false);
  const reverseGeocodeSeq = useRef(0);
  const geoInitStartedRef = useRef(false);
  const lastMapSyncKeyRef = useRef('');
  const pinAlignSeqRef = useRef(0);
  const cityScrollRef = useRef<ScrollView>(null);
  const cityChipLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});
  const cityScrollWidthRef = useRef(0);
  const pendingCityScrollRef = useRef<string | null>(null);

  const scrollSelectedCityIntoView = useCallback((city: string, animated = true) => {
    if (!city || city === REST_OF_COUNTRY_CITY) return;
    const layout = cityChipLayoutsRef.current[city];
    if (!layout || !cityScrollRef.current) {
      pendingCityScrollRef.current = city;
      return;
    }
    pendingCityScrollRef.current = null;
    const viewport = cityScrollWidthRef.current || 320;
    const targetX = Math.max(0, layout.x + layout.width / 2 - viewport / 2);
    cityScrollRef.current.scrollTo({ x: targetX, animated });
  }, []);

  const applyLocationFieldsPatch = useCallback((patch: LocationDraftFieldsPatch | null) => {
    if (!patch) return;
    const latest = useOfferStore.getState().draft;
    const merged: LocationDraftFieldsPatch = { ...patch };
    if (!locationDraftPatchHasChanges(latest, merged)) return;
    useOfferStore.getState().updateDraft(merged);
  }, []);

  const resolveMapExact = useCallback(
    (sourceDraft = draft) => resolveIsExactLocation(sourceDraft.isExactLocation ?? true),
    [draft.isExactLocation],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const store = useOfferStore.getState();
      if (store.currentStep !== 2) setCurrentStep(2);

      const currentDraft = store.draft;
      applyLocationFieldsPatch(
        getLocationDraftRepairPatch(currentDraft, {
          lat: Number(currentDraft.lat),
          lng: Number(currentDraft.lng),
        }),
      );

      if (!resolveIsExactLocation(currentDraft.isExactLocation)) {
        store.updateDraft({ isExactLocation: true });
      }

      const street = String(useOfferStore.getState().draft.street || '').trim();
      setStreetInput(street);

      const lat = Number(currentDraft.lat);
      const lng = Number(currentDraft.lng);
      const hasCoords =
        Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
      if (!hasCoords) geoInitStartedRef.current = false;

      const expectedExact = true;
      const syncKey = `${lat.toFixed(5)}:${lng.toFixed(5)}:${expectedExact ? 1 : 0}:${String(currentDraft.propertyType || '')}`;
      if (hasCoords && syncKey !== lastMapSyncKeyRef.current) {
        lastMapSyncKeyRef.current = syncKey;
        setTimeout(() => {
          isProgrammaticMove.current = true;
          mapRef.current?.animateCamera({
            center: { latitude: lat, longitude: lng },
            pitch: expectedExact ? 75 : 30,
            altitude: expectedExact ? 150 : 4000,
            zoom: expectedExact ? 19.5 : 13.5,
            heading: 0,
          }, { duration: 1200 });
          setTimeout(() => { isProgrammaticMove.current = false; }, 1300);
        }, 80);
      }

      if (hasCoords) {
        const seq = ++pinAlignSeqRef.current;
        void (async () => {
          try {
            const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (cancelled || seq !== pinAlignSeqRef.current || !reverse[0]) return;
            const latestStreet = String(useOfferStore.getState().draft.street || '').trim();
            const latestCity = String(useOfferStore.getState().draft.city || '').trim();
            const normalized = resolvePlaceToNormalizedLocation(
              reverse[0],
              lat,
              lng,
              latestStreet,
              latestCity,
            );
            applyLocationFieldsPatch({
              city: normalized.city,
              district: normalized.district,
              localityCountry: normalized.localityCountry,
              localityCountryCode: normalized.localityCountryCode,
            });
          } catch {
            // noop
          }
        })();
      }

      setNavigationGate((targetStep: number) => {
        if (targetStep === 2) return true;
        pendingNavActionRef.current = {
          type: 'NAVIGATE',
          payload: { name: `Step${targetStep}` },
        };
        setShowLocationConfirm(true);
        return false;
      });
      return () => {
        cancelled = true;
        setNavigationGate(null);
      };
    }, [applyLocationFieldsPatch, setCurrentStep, setNavigationGate]),
  );

  useEffect(() => {
    // ZAWSZE przy próbie opuszczenia Step 2 (czy to "Dalej" → Step 3, "Wstecz" → Step 1,
    // zamknięcie kreatora, czy dowolna nawigacja w jego trakcie) wyświetlamy okno
    // potwierdzenia adresu. Po "Zatwierdź" wykonujemy oryginalną akcję, po "Popraw"
    // pozostajemy na Step 2.
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (allowStep3NavigationRef.current) return;
      const action = event?.data?.action;
      if (!action) return;
      event.preventDefault();
      pendingNavActionRef.current = action;
      setShowLocationConfirm(true);
    });
    return unsubscribe;
  }, [navigation]);

  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? 'rgba(30,30,34,0.65)' : '#ffffff';
  const inputBg = isDark ? 'rgba(0,0,0,0.5)' : '#ffffff';
  const shadow = isDark ? {} : { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 };
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)';

  const hasAddress = !!draft.street && draft.street.length > 2;
  const rawDraftCity = String(draft.city || '').trim();
  const safeDraftLocalityCountry = normalizeLocalityCountryLabel(draft.localityCountry);
  const safeDraftLocalityCountryIso = localityCountryIso(
    draft.localityCountryCode,
    safeDraftLocalityCountry,
  );
  const isPolandLocation = safeDraftLocalityCountryIso === DEFAULT_LOCALITY_COUNTRY_CODE;
  const hasCoords =
    Number.isFinite(Number(draft.lat)) && Number.isFinite(Number(draft.lng));
  const streetTrim = String(streetInput || '').trim();
  const streetLen = streetTrim.length;
  const streetHasDigit = /\d/.test(streetTrim);
  const currentIsExact = resolveIsExactLocation(draft.isExactLocation ?? true);
  const latN = Number(draft.lat);
  const lngN = Number(draft.lng);
  const satelliteMunicipality =
    hasCoords && isPolandLocation && Number.isFinite(latN) && Number.isFinite(lngN)
      ? detectSatelliteMunicipalityFromCoordinates(latN, lngN)
      : null;
  const coordStrictCity =
    hasCoords && isPolandLocation && !satelliteMunicipality && Number.isFinite(latN) && Number.isFinite(lngN)
      ? detectStrictCityFromCoordinates(latN, lngN)
      : null;
  const safeDraftCity = (() => {
    if (!isPolandLocation) return REST_OF_COUNTRY_CITY;
    if (satelliteMunicipality || rawDraftCity === REST_OF_COUNTRY_CITY) {
      return REST_OF_COUNTRY_CITY;
    }
    if (STRICT_CITY_SET.has(rawDraftCity)) return rawDraftCity;
    if (rawDraftCity) return REST_OF_COUNTRY_CITY;
    if (coordStrictCity) return coordStrictCity;
    if (hasCoords) return REST_OF_COUNTRY_CITY;
    return DEFAULT_STRICT_CITY;
  })();
  const isRestOfCountry = safeDraftCity === REST_OF_COUNTRY_CITY;
  const showGeocodedLocality = !isPolandLocation || isRestOfCountry;
  const showPolishCityPicker = hasAddress && isPolandLocation && !isRestOfCountry;
  const safeDraftDistricts = DISTRICTS_DATA[safeDraftCity] || [];
  const locationPresentation = getDraftLocationPresentation({
    city: draft.city,
    district: draft.district,
    localityCountry: draft.localityCountry,
    localityCountryCode: draft.localityCountryCode,
  });
  const safeDraftDistrict = isRestOfCountry
    ? locationPresentation.district
    : safeDraftDistricts.includes(String(draft.district || ''))
      ? String(draft.district)
      : (safeDraftDistricts[0] || '');
  const localityCountryFlag = flagEmojiFromIso2(safeDraftLocalityCountryIso);

  useEffect(() => {
    if (!showPolishCityPicker) return;
    scrollSelectedCityIntoView(safeDraftCity);
  }, [safeDraftCity, showPolishCityPicker, scrollSelectedCityIntoView]);

  const syncStreetToDraft = useCallback(() => {
    const trimmedStreet = String(streetInput || '').trim();
    if (trimmedStreet.length > 2 && trimmedStreet !== String(draft.street || '').trim()) {
      updateDraft({ street: trimmedStreet });
    }
  }, [streetInput, draft.street, updateDraft]);

  useEffect(() => {
    syncStreetToDraft();
  }, [syncStreetToDraft]);

  const flyTo = (targetLat: number | string | null | undefined, targetLng: number | string | null | undefined, isExact: boolean) => {
    const lat = Number(targetLat);
    const lng = Number(targetLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    lastMapSyncKeyRef.current = `${lat.toFixed(5)}:${lng.toFixed(5)}:${isExact ? 1 : 0}:${String(draft.propertyType || '')}`;
    isProgrammaticMove.current = true;
    mapRef.current?.animateCamera({
      center: { latitude: lat, longitude: lng },
      pitch: isExact ? 75 : 30,
      altitude: isExact ? 150 : 4000,
      zoom: isExact ? 19.5 : 13.5,
      heading: 0,
    }, { duration: 2500 });

    setTimeout(() => { isProgrammaticMove.current = false; }, 2600);
  };

  const resolvePlaceCoords = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!normalized) return null;
    if (geoCacheRef.current[normalized]) return geoCacheRef.current[normalized];
    const countryLabel = String(draft.localityCountry || DEFAULT_LOCALITY_COUNTRY).trim();
    const result = await Location.geocodeAsync(buildGeocodeQuery(normalized, countryLabel));
    if (!result.length) return null;
    const coords = { lat: result[0].latitude, lng: result[0].longitude };
    geoCacheRef.current[normalized] = coords;
    return coords;
  }, [draft.localityCountry]);

  const applyDeviceGpsLocation = useCallback(
    async (options: { updateStreetOnlyIfEmpty?: boolean; showErrors?: boolean } = {}) => {
      const { updateStreetOnlyIfEmpty = false, showErrors = false } = options;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (showErrors) {
            Alert.alert(
              t('addOffer.step2.alerts.locationDenied.title'),
              t('addOffer.step2.alerts.locationDenied.message'),
            );
          }
          return false;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        let finalCity: string = DEFAULT_STRICT_CITY;
        let finalDistrict: string = (DISTRICTS_DATA[DEFAULT_STRICT_CITY] || [])[0] || '';
        let finalCountry = DEFAULT_LOCALITY_COUNTRY;
        let finalCountryCode = DEFAULT_LOCALITY_COUNTRY_CODE;
        let newStreet = '';
        if (reverse.length > 0) {
          const place = reverse[0];
          const streetHint = String(streetInput || useOfferStore.getState().draft.street || '').trim();
          const rawStreet = streetLineFromGeocodedPlace(place, streetHint);
          newStreet = currentIsExact ? rawStreet : stripHouseNumber(rawStreet) || rawStreet;
          const normalized = resolvePlaceToNormalizedLocation(
            place,
            latitude,
            longitude,
            streetHint || newStreet,
            useOfferStore.getState().draft.city,
          );
          finalCity = normalized.city;
          finalDistrict = normalized.district;
          finalCountry = normalized.localityCountry;
          finalCountryCode = normalized.localityCountryCode;
        }
        const mapExact = resolveIsExactLocation(useOfferStore.getState().draft.isExactLocation ?? true);
        if (newStreet && (!updateStreetOnlyIfEmpty || !String(streetInput || '').trim())) {
          setStreetInput(newStreet);
        }
        updateDraft({
          lat: latitude,
          lng: longitude,
          city: finalCity,
          district: finalDistrict,
          localityCountry: finalCountry,
          localityCountryCode: finalCountryCode,
          ...(newStreet ? { street: newStreet } : {}),
        });
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        flyTo(latitude, longitude, mapExact);
        return true;
      } catch (_e) {
        if (showErrors) {
          Alert.alert(
            t('addOffer.step2.alerts.locationFailed.title'),
            t('addOffer.step2.alerts.locationFailed.message'),
          );
        }
        return false;
      }
    },
    [streetInput, updateDraft, currentIsExact, t],
  );

  const initFromDeviceLocation = useCallback(async () => {
    if (geoInitStartedRef.current) return;
    geoInitStartedRef.current = true;
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return;
    const ok = await applyDeviceGpsLocation({ updateStreetOnlyIfEmpty: true, showErrors: false });
    if (!ok) geoInitStartedRef.current = false;
  }, [applyDeviceGpsLocation, draft.lat, draft.lng]);

  const handleMyLocationPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocatingDevice(true);
    try {
      const ok = await applyDeviceGpsLocation({ showErrors: true });
      if (ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } finally {
      setLocatingDevice(false);
    }
  }, [applyDeviceGpsLocation]);

  useEffect(() => {
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) return;
    void initFromDeviceLocation();
  }, [draft.lat, draft.lng, initFromDeviceLocation]);

  const handleAddressSearch = async () => {
    if (streetInput.length < 3) return;
    if (currentIsExact && !/\d/.test(streetInput)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('addOffer.step2.alerts.missingNumber.title'),
        t('addOffer.step2.alerts.missingNumber.message'),
      );
      return;
    }
    try {
      const countryLabel = String(draft.localityCountry || DEFAULT_LOCALITY_COUNTRY).trim();
      const result = await Location.geocodeAsync(buildGeocodeQuery(streetInput, countryLabel));
      if (result.length > 0) {
        const { latitude, longitude } = result[0];
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        let newStreet = streetInput;
        let finalCity: string = DEFAULT_STRICT_CITY;
        let finalDistrict: string = (DISTRICTS_DATA[DEFAULT_STRICT_CITY] || [])[0] || '';
        let finalCountry = DEFAULT_LOCALITY_COUNTRY;
        let finalCountryCode = DEFAULT_LOCALITY_COUNTRY_CODE;

        if (reverse.length > 0) {
          const place = reverse[0];
          const normalized = resolvePlaceToNormalizedLocation(
            place,
            latitude,
            longitude,
            streetInput,
            draft.city,
          );
          finalCity = normalized.city;
          finalDistrict = normalized.district;
          finalCountry = normalized.localityCountry;
          finalCountryCode = normalized.localityCountryCode;
          newStreet = streetLineFromGeocodedPlace(place, streetInput);
        }
        const storedStreet = currentIsExact ? newStreet : stripHouseNumber(newStreet) || newStreet;

        setStreetInput(storedStreet);
        updateDraft({
          city: finalCity,
          district: finalDistrict,
          localityCountry: finalCountry,
          localityCountryCode: finalCountryCode,
          lat: latitude,
          lng: longitude,
          street: storedStreet,
        });
        flyTo(latitude, longitude, currentIsExact);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t('addOffer.step2.alerts.addressNotFound.title'),
          t('addOffer.step2.alerts.addressNotFound.message'),
        );
      }
    } catch (e) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
  };

  const handleRegionChangeComplete = async (region: Region, details: any) => {
    const isProgrammatic = isProgrammaticMove.current;
    const isNonGesture = details && details.isGesture === false;

    if (!isProgrammatic) {
      const prevLat = Number(draft.lat);
      const prevLng = Number(draft.lng);
      const latChanged =
        !Number.isFinite(prevLat) || Math.abs(prevLat - region.latitude) > 1e-6;
      const lngChanged =
        !Number.isFinite(prevLng) || Math.abs(prevLng - region.longitude) > 1e-6;
      if (latChanged || lngChanged) {
        updateDraft({ lat: region.latitude, lng: region.longitude });
      }
    }

    if (isProgrammatic) return;
    if (isNonGesture) return;

    // Pierwszy faktyczny gest na mapie — chowamy MapInteractionTip.
    // Sprawdzamy `details.isGesture` (iOS RN-Maps), żeby nie liczyć ruchów
    // wyzwolonych programowo przez `animateCamera`.
    if (!userInteractedWithMap) {
      setUserInteractedWithMap(true);
    }

    const seq = ++reverseGeocodeSeq.current;

    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
      if (seq !== reverseGeocodeSeq.current) return;
      if (reverse.length > 0) {
        const place = reverse[0];
        
        const rawStreet = streetLineFromGeocodedPlace(place, streetInput);
        let newStreet = currentIsExact ? rawStreet : stripHouseNumber(rawStreet) || rawStreet;
        newStreet = preserveVillageStreetHint(streetInput || draft.street || '', newStreet);

        const streetHint = String(streetInput || draft.street || newStreet).trim();
        const normalized = resolvePlaceToNormalizedLocation(
          place,
          region.latitude,
          region.longitude,
          streetHint,
          draft.city,
        );
        const finalCity = normalized.city;
        const finalDistrict = normalized.district;
        const shouldUpdate =
          newStreet !== streetInput ||
          finalCity !== draft.city ||
          finalDistrict !== draft.district ||
          normalized.localityCountry !== draft.localityCountry ||
          normalized.localityCountryCode !== draft.localityCountryCode;

        if (shouldUpdate) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          
          setStreetInput(newStreet);
          updateDraft({
            city: finalCity,
            district: finalDistrict,
            localityCountry: normalized.localityCountry,
            localityCountryCode: normalized.localityCountryCode,
            street: newStreet,
          });
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('Błąd Reverse Geocoding:', e);
    }
  };

  const handleCityChange = async (city: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    const normalized = normalizeStrictLocation(city, null);
    const newDistricts = DISTRICTS_DATA[normalized.city as keyof typeof DISTRICTS_DATA];
    const coords = DISTRICT_COORDS[normalized.city] || await resolvePlaceCoords(normalized.city) || { lat: 52.0, lng: 19.0 };
    updateDraft({
      city: normalized.city,
      district: normalized.district || newDistricts[0],
      localityCountry: normalized.localityCountry,
      localityCountryCode: normalized.localityCountryCode,
      lat: coords.lat,
      lng: coords.lng,
    });
    flyTo(coords.lat, coords.lng, resolveMapExact());
  };
  
  const handleDistrictChange = async (district: string) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    const selectedCity = STRICT_CITY_SET.has(String(draft.city || '')) ? String(draft.city) : DEFAULT_STRICT_CITY;
    const normalized = normalizeStrictLocation(selectedCity, district);
    updateDraft({
      city: normalized.city,
      district: normalized.district,
      localityCountry: normalized.localityCountry,
      localityCountryCode: normalized.localityCountryCode,
    });
    const isAmbiguousDistrict = (DISTRICT_CITY_USAGE[district] || 0) > 1;
    const coords =
      await resolvePlaceCoords(`${normalized.district}, ${normalized.city}`) ||
      (!isAmbiguousDistrict ? DISTRICT_COORDS[normalized.district] : null) ||
      await resolvePlaceCoords(normalized.district);
    if (coords) {
      updateDraft({ lat: coords.lat, lng: coords.lng });
      flyTo(coords.lat, coords.lng, resolveMapExact());
    } else {
      Alert.alert(
        t('addOffer.step2.alerts.districtNotFound.title'),
        t('addOffer.step2.alerts.districtNotFound.message', {
          district: normalized.district,
          city: normalized.city,
        }),
      );
    }
  };

  // Przechwycenie nawigacji ze steppera (numerki 1..6).
  //
  // KLUCZOWE: navigation.navigate('Step3') NIE usuwa Step 2 ze stosu, więc
  // `beforeRemove` w ogóle nie wystrzeli. Dlatego musimy zatrzymać przejście
  // tutaj — zwracając `false` AddOfferStepper anuluje wywołanie navigate().
  // Zapisujemy zamiar w `pendingNavActionRef` i pokazujemy modal. Po Zatwierdź
  // wykonujemy oryginalną navigation.navigate(`Step${targetStep}`).
  const handleBeforeStepChange = (targetStep: number) => {
    if (targetStep === 2) return true;
    pendingNavActionRef.current = {
      type: 'NAVIGATE',
      payload: { name: `Step${targetStep}` },
    };
    setShowLocationConfirm(true);
    return false;
  };

  // Etykieta "Miasto i dzielnica" w modalu potwierdzenia.
  // Reguły:
  //  1) Gdy "Reszta kraju" — pokazujemy SAMĄ nazwę miejscowości (district zawiera
  //     wynik geokodowania, np. "Białystok"). Nie chcemy słów "Reszta kraju".
  //  2) Gdy district to "Ogólna" lub pusty — pokazujemy tylko miasto.
  //  3) W pozostałych przypadkach — "Miasto, Dzielnica".
  const locationCityDistrict = (() => {
    const districtTrim = String(safeDraftDistrict || '').trim();
    if (isRestOfCountry) {
      return districtTrim || t('addOffer.step2.confirm.fallbacks.localityUnknown');
    }
    if (!districtTrim || districtTrim.toLowerCase() === 'ogólna') {
      return safeDraftCity;
    }
    return `${safeDraftCity}, ${districtTrim}`;
  })();
  const locationStreetRaw = streetInput?.trim() || draft.street || '';
  const locationStreet = locationStreetRaw
    ? currentIsExact
      ? locationStreetRaw
      : stripHouseNumber(locationStreetRaw) || locationStreetRaw
    : t('addOffer.step2.confirm.fallbacks.noExactAddress');

  const confirmAndGoNext = () => {
    if (streetInput?.trim()) {
      const trimmed = streetInput.trim();
      updateDraft({ street: currentIsExact ? trimmed : stripHouseNumber(trimmed) || trimmed });
    }
    const action = pendingNavActionRef.current;
    pendingNavActionRef.current = null;
    setShowLocationConfirm(false);
    if (action) {
      allowStep3NavigationRef.current = true;
      navigation.dispatch(action);
      setTimeout(() => {
        allowStep3NavigationRef.current = false;
      }, 0);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View style={styles.mapContainer}>
        <MapView 
          ref={mapRef} 
          style={styles.map} 
          userInterfaceStyle={isDark ? "dark" : "light"} 
          showsBuildings={true} 
          pitchEnabled={true} 
          initialRegion={{ latitude: draft.lat || 52.2297, longitude: draft.lng || 21.0122, latitudeDelta: 0.05, longitudeDelta: 0.05 }} 
          onRegionChangeComplete={handleRegionChangeComplete} 
        />
        <View style={styles.centerPinContainer} pointerEvents="none">{currentIsExact ? <RedNeedlePin /> : <BreathingCircle />}</View>
        <View style={[styles.mapGradient, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)' }]} pointerEvents="none" />
        {/* Floating-tip nad dolną krawędzią mapy — wyjaśnia że mapę
            trzeba przesuwać palcem i zoomować szczypcami. Znika po pierwszym
            gestem usera (handleRegionChangeComplete → userInteractedWithMap). */}
        <MapInteractionTip isDark={isDark} dismissed={userInteractedWithMap} t={t} />
      </View>

      <ScrollView style={styles.controlsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <AddOfferStepper currentStep={2} draft={draft} theme={theme} navigation={navigation} onBeforeStepChange={handleBeforeStepChange} />
        
        <Text style={[styles.header, { color: theme.text }]}>{t('addOffer.step2.header')}</Text>
        
        <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step2.sections.searchAddress')}</Text>
        <View style={[styles.insetSlot, styles.addressInputRow, { backgroundColor: inputBg, borderColor }, shadow]}>
          <TextInput
            style={[styles.input, styles.addressInput, { color: theme.text }]}
            placeholder={t('addOffer.step2.placeholders.street')}
            placeholderTextColor={theme.subtitle}
            value={streetInput}
            onChangeText={setStreetInput}
            onBlur={syncStreetToDraft}
            onSubmitEditing={() => {
              syncStreetToDraft();
              void handleAddressSearch();
            }}
            returnKeyType="search"
            selectionColor="#dc2626"
          />
          <Pressable
            onPress={() => void handleMyLocationPress()}
            disabled={locatingDevice}
            style={({ pressed }) => [styles.myLocationBtn, pressed && { opacity: 0.65 }]}
            accessibilityRole="button"
            accessibilityLabel={t('addOffer.step2.myLocation.a11y')}
            hitSlop={8}
          >
            {locatingDevice ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="locate" size={22} color={Colors.primary} />
            )}
          </Pressable>
        </View>
        {isPolandLocation ? (
          <AddOfferFieldHint current={streetLen} min={ADD_OFFER_STREET_MIN} />
        ) : null}
        {isPolandLocation && currentIsExact && streetLen >= ADD_OFFER_STREET_MIN && !streetHasDigit ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF3B30', marginTop: 6, marginLeft: 4 }}>
            {t('addOffer.step2.streetBuildingHint')}
          </Text>
        ) : null}

        {showGeocodedLocality ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step2.sections.locality')}</Text>
            <View style={[styles.restLocalityCard, { backgroundColor: cardBg, borderColor }, shadow]}>
              <Text style={[styles.restLocalityName, { color: theme.text }]}>{safeDraftDistrict}</Text>
              <Text style={[styles.restLocalityHint, { color: theme.subtitle }]}>
                {t('addOffer.step2.localityHint')}
              </Text>
            </View>
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step2.sections.country')}</Text>
            <View style={[styles.restLocalityCard, { backgroundColor: cardBg, borderColor }, shadow]}>
              <View style={styles.countryRow}>
                <Text style={styles.countryFlag} accessibilityLabel={safeDraftLocalityCountry}>
                  {localityCountryFlag}
                </Text>
                <Text style={[styles.restLocalityName, styles.countryName, { color: theme.text }]}>
                  {safeDraftLocalityCountry}
                </Text>
              </View>
              <Text style={[styles.restLocalityHint, { color: theme.subtitle }]}>
                {t('addOffer.step2.countryHint')}
              </Text>
            </View>
          </>
        ) : null}

        {showPolishCityPicker ? (
          <View pointerEvents="auto">
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step2.sections.city')}</Text>
            <ScrollView
              ref={cityScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingBottom: 20, paddingHorizontal: 2 }}
              onLayout={(event) => {
                cityScrollWidthRef.current = event.nativeEvent.layout.width;
              }}
              onContentSizeChange={() => {
                const city = pendingCityScrollRef.current || safeDraftCity;
                scrollSelectedCityIntoView(city, !pendingCityScrollRef.current);
              }}
            >
              {POLISH_STRICT_CITIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => handleCityChange(c)}
                  onLayout={(event) => {
                    cityChipLayoutsRef.current[c] = {
                      x: event.nativeEvent.layout.x,
                      width: event.nativeEvent.layout.width,
                    };
                    if (c === safeDraftCity) {
                      scrollSelectedCityIntoView(c, false);
                    }
                  }}
                  style={[styles.pillBtn, safeDraftCity === c && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}
                >
                  <Text style={[styles.pillText, safeDraftCity === c && { color: '#FFF' }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{t('addOffer.step2.sections.district')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
              {(DISTRICTS_DATA[safeDraftCity as keyof typeof DISTRICTS_DATA] || []).map((d) => (
                <Pressable key={d} onPress={() => handleDistrictChange(d)} style={[styles.pillBtn, safeDraftDistrict === d && { backgroundColor: Colors.primary, borderColor: Colors.primary }]}>
                  <Text style={[styles.pillText, safeDraftDistrict === d && { color: '#FFF' }]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <AddOfferStepFooterHint
          theme={theme}
          icon="map-outline"
          text={
            isPolandLocation
              ? t('addOffer.step2.footerHint.poland')
              : t('addOffer.step2.footerHint.international')
          }
        />

        <View pointerEvents={hasAddress ? "auto" : "none"} style={{ opacity: hasAddress ? 1 : 0.35, marginTop: 8 }}>
          <View style={[styles.glassCard, { backgroundColor: cardBg, borderColor }, shadow]}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.text }]}>{t('addOffer.step2.exactLocation.label')}</Text>
                <Text style={[styles.subLabel, { color: theme.subtitle }]}>
                  {currentIsExact
                    ? t('addOffer.step2.exactLocation.on')
                    : t('addOffer.step2.exactLocation.off')}
                </Text>
              </View>
              <Switch
                value={currentIsExact}
                onValueChange={(val) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const trimmed = String(streetInput || draft.street || '').trim();
                  const nextStreet = trimmed
                    ? val
                      ? trimmed
                      : stripHouseNumber(trimmed) || trimmed
                    : trimmed;
                  if (nextStreet !== streetInput) setStreetInput(nextStreet);
                  updateDraft({ isExactLocation: val, ...(nextStreet ? { street: nextStreet } : {}) });
                  flyTo(draft.lat, draft.lng, val);
                }}
                trackColor={{ false: '#D1D1D6', true: '#10b981' }}
              />
            </View>
          </View>
        </View>

        <View style={{ height: 200 }} />
      </ScrollView>

      <Modal
        visible={showLocationConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowLocationConfirm(false);
          pendingNavActionRef.current = null;
        }}
      >
        <View style={styles.confirmOverlay}>
          <BlurView intensity={36} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[styles.confirmCard, { backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)' }]}>
            <Text style={[styles.confirmTitle, { color: theme.text }]}>{t('addOffer.step2.confirm.title')}</Text>
            <Text style={[styles.confirmSubtitle, { color: theme.subtitle }]}>
              {t('addOffer.step2.confirm.subtitle')}
            </Text>

            <View style={[styles.confirmRow, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.confirmLabel, { color: theme.subtitle }]}>{t('addOffer.step2.confirm.labels.cityDistrict')}</Text>
              <Text style={[styles.confirmValue, { color: theme.text }]}>{locationCityDistrict || t('addOffer.common.none')}</Text>
            </View>
            {showGeocodedLocality ? (
              <View style={[styles.confirmRow, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.confirmLabel, { color: theme.subtitle }]}>{t('addOffer.step2.confirm.labels.country')}</Text>
                <View style={styles.confirmCountryValue}>
                  <Text style={styles.confirmCountryFlag}>{localityCountryFlag}</Text>
                  <Text style={[styles.confirmValue, { color: theme.text }]}>{safeDraftLocalityCountry}</Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.confirmRow, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={[styles.confirmLabel, { color: theme.subtitle }]}>{t('addOffer.step2.confirm.labels.address')}</Text>
              <Text style={[styles.confirmValue, { color: theme.text }]}>{locationStreet}</Text>
            </View>

            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmSecondary]}
                onPress={() => {
                  setShowLocationConfirm(false);
                  pendingNavActionRef.current = null;
                }}
              >
                <Text style={styles.confirmSecondaryText}>{t('addOffer.step2.confirm.buttons.edit')}</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, styles.confirmPrimary]} onPress={confirmAndGoNext}>
                <Text style={styles.confirmPrimaryText}>{t('addOffer.step2.confirm.buttons.confirm')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { height: '42%', width: '100%', position: 'relative' },
  map: { flex: 1 },
  mapGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
  centerPinContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  precisePinWrapper: { position: 'absolute', marginTop: -40, alignItems: 'center' },
  pinHead: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#dc2626', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.9, shadowRadius: 10, elevation: 10, zIndex: 4 },
  pinNeedle: { width: 3, height: 26, marginTop: -2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, zIndex: 3 },
  pinContactPoint: { width: 6, height: 2, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.9)', marginTop: 0, zIndex: 2 },
  pinShadowMap: { position: 'absolute', bottom: -2, width: 14, height: 5, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 10, transform: [{ scaleY: 0.5 }], zIndex: 1 },
  redWave: { position: 'absolute', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(220, 38, 38, 0.4)', borderWidth: 2, borderColor: 'rgba(220, 38, 38, 0.8)', zIndex: 0, bottom: -10 },
  approximateArea: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(220, 38, 38, 0.2)', borderWidth: 3, borderColor: '#dc2626' },
  glowShadow: { shadowColor: '#dc2626', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 20, elevation: 15 },
  controlsContainer: { flex: 1, padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, zIndex: 2 },
  header: { fontSize: 34, fontWeight: '800', marginBottom: 20, letterSpacing: -1 },
  glassCard: { padding: 18, borderRadius: 26, borderTopWidth: 1.5, borderLeftWidth: 1.5, marginBottom: 25, borderWidth: 1 },
  insetSlot: { borderRadius: 22, borderTopWidth: 2, borderLeftWidth: 1.5, borderBottomWidth: 1, marginBottom: 30, borderWidth: 1 }, 
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 17, fontWeight: '700' }, subLabel: { fontSize: 13, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.5 },
  input: { height: 55, paddingHorizontal: 20, fontSize: 17, fontWeight: '600' },
  addressInputRow: { flexDirection: 'row', alignItems: 'center' },
  addressInput: { flex: 1, paddingRight: 4 },
  myLocationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  restLocalityCard: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 30,
  },
  restLocalityName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  countryFlag: { fontSize: 28, lineHeight: 32 },
  countryName: { flex: 1, marginBottom: 0 },
  restLocalityHint: { fontSize: 12, lineHeight: 17, fontWeight: '500' },
  confirmCountryValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  confirmCountryFlag: { fontSize: 20, lineHeight: 24 },
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  confirmCard: {
    width: '100%',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  confirmLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  confirmValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSecondary: {
    backgroundColor: 'rgba(142,142,147,0.18)',
  },
  confirmPrimary: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmSecondaryText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  
  pillBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(150,150,150,0.3)', backgroundColor: 'rgba(150,150,150,0.05)' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#8E8E93' },

  // === MAP INTERACTION TIP — floating glass pill nad dolną krawędzią mapy ===
  mapTipWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 22,
    zIndex: 5,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  mapTipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mapTipGestureBubble: {
    width: 60,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mapTipGestureTrack: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(220,38,38,0.35)',
    top: '50%',
    marginTop: -0.5,
  },
  mapTipFingerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  mapTipTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  mapTipSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
