import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';

const Colors = { primary: '#10b981', aiGlow: '#8b5cf6', danger: '#ef4444', premiumDark: '#1C1C1E', premiumBorder: 'rgba(255,255,255,0.08)' };
const MAX_TITLE_LENGTH = 70;
const MAX_IMAGES = 20;
const MAX_MB = 20;
/** Gdy brak fileSize z pickera (np. po powrocie na krok) — realistyczny szacunek ~0,9 MB */
const FALLBACK_BYTES_PER_IMAGE = Math.round(0.9 * 1024 * 1024);
const MAX_BYTES = MAX_MB * 1024 * 1024;

function sumImageBytes(uris: string[], sizes: Record<string, number> | undefined): number {
  const map = sizes || {};
  return uris.reduce((acc, uri) => acc + (map[uri] ?? FALLBACK_BYTES_PER_IMAGE), 0);
}

function countUnknownImageSizes(uris: string[], sizes: Record<string, number> | undefined): number {
  const map = sizes || {};
  return uris.reduce((acc, uri) => acc + (typeof map[uri] === 'number' && map[uri] > 0 ? 0 : 1), 0);
}

/** Mapa rozmiarów bez wpisów dla URI których już nie ma na liście (oraz przy duplikatach kluczy w obiekcie bez zmian wartości). */
function pruneImageByteSizes(images: string[], sizes: Record<string, number>): Record<string, number> {
  const unique = [...new Set(images)];
  const out: Record<string, number> = {};
  for (const uri of unique) {
    const b = sizes[uri];
    if (typeof b === 'number' && b > 0) out[uri] = Math.round(b);
  }
  return out;
}

function uniqueImages(uris: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const uri of uris) {
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    out.push(uri);
  }
  return out;
}

/**
 * Rozmiar „do limitu aplikacji” musi pasować do tego co później wysyła Step6 (_JPEG compress 0.8_ dla HEIC).
 * Sam rozmiar z pickera dla HEIC bywa znacznie mniejszy niż wyjściowy JPG → fałszywy zapas lub fałszywy limit.
 */
async function estimateBytesForDraftImage(uri: string, pickerFileSize?: number | null): Promise<number> {
  const lower = uri.toLowerCase();
  const looksHeic = lower.endsWith('.heic') || lower.endsWith('.heif');

  try {
    let measureUri = uri;
    let tempConvert: string | null = null;
    if (looksHeic) {
      const converted = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.8,
      });
      measureUri = converted.uri;
      tempConvert = converted.uri;
    }

    const info = await FileSystem.getInfoAsync(measureUri, { size: true });
    if (info.exists && typeof info.size === 'number' && info.size > 0) {
      if (tempConvert) {
        FileSystem.deleteAsync(tempConvert, { idempotent: true }).catch(() => {});
      }
      return Math.round(info.size);
    }

    if (tempConvert) {
      FileSystem.deleteAsync(tempConvert, { idempotent: true }).catch(() => {});
    }
  } catch {
    // przejdź po fallbackach
  }

  if (typeof pickerFileSize === 'number' && pickerFileSize > 0) {
    /** HEIC bez pomiaru: bufor w górę, żeby limit nie uwierzył w mały rozmiar z biblioteki. */
    const mul = looksHeic ? 2.4 : 1;
    return Math.round(Math.max(pickerFileSize * mul, pickerFileSize + 220 * 1024));
  }

  return looksHeic ? Math.round(2.8 * FALLBACK_BYTES_PER_IMAGE) : FALLBACK_BYTES_PER_IMAGE;
}

// --- MATEMATYKA SIATKI ---
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 20;
const GRID_GAP = 12;
const COLUMNS = 3;
const SQUARE_SIZE = (SCREEN_WIDTH - (GRID_PADDING * 2) - (GRID_GAP * (COLUMNS - 1))) / COLUMNS;

// Funkcja zwracająca absolutną pozycję (x, y) na podstawie indeksu
const getPosition = (index: number) => ({
  x: (index % COLUMNS) * (SQUARE_SIZE + GRID_GAP),
  y: Math.floor(index / COLUMNS) * (SQUARE_SIZE + GRID_GAP),
});

// --- EKSKLUZYWNY PASEK LIMITÓW ---
const CapacityBar = ({ label, current, max, suffix, theme }: any) => {
  const progress = Math.min(current / max, 1);
  const isDanger = progress > 0.9;
  return (
    <View style={styles.capacityContainer}>
      <View style={styles.capacityHeader}>
        <Text style={[styles.capacityLabel, { color: theme.subtitle }]}>{label}</Text>
        <Text style={[styles.capacityValue, { color: isDanger ? Colors.danger : theme.text }]}>
          {current.toFixed(suffix === 'MB' ? 1 : 0)} / {max} {suffix}
        </Text>
      </View>
      <View style={[styles.capacityTrack, { backgroundColor: theme.glass === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        <Animated.View style={[styles.capacityFill, { width: `${progress * 100}%`, backgroundColor: isDanger ? Colors.danger : Colors.primary }]} />
      </View>
    </View>
  );
};

// --- DRAGGABLE SQUARE APPLE-STYLE ---
const DraggableSquare = ({
  uri,
  index,
  total,
  onDragStart,
  onDragEnd,
  onHoverSwap,
  onRemove,
  theme,
  progress = 100,
}: any) => {
  const pos = useRef(new Animated.ValueXY(getPosition(index))).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [isActive, setIsActive] = useState(false);
  const isDragging = useRef(false);
  const initialIndex = useRef(index);
  const lastHoveredIndex = useRef(index);

  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onHoverSwapRef = useRef(onHoverSwap);
  const indexRef = useRef(index);
  const totalRef = useRef(total);
  const uriRef = useRef(uri);
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;
  onHoverSwapRef.current = onHoverSwap;
  indexRef.current = index;
  totalRef.current = total;
  uriRef.current = uri;

  // Tylko gdy nie przeciągamy — płynne dociąganie kafelków do siatki (bez podwójnej animacji z końcem gestu)
  useEffect(() => {
    if (!isDragging.current) {
      Animated.spring(pos, {
        toValue: getPosition(index),
        useNativeDriver: true,
        friction: 9,
        tension: 68,
      }).start();
    }
  }, [index, pos]);

  const finishDrag = useCallback(() => {
    setIsActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(pos, {
        toValue: getPosition(indexRef.current),
        useNativeDriver: true,
        friction: 9,
        tension: 85,
      }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start(() => {
      onDragEndRef.current();
    });
    isDragging.current = false;
  }, [pos, scaleAnim]);

  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          isDragging.current = true;
          setIsActive(true);
          initialIndex.current = indexRef.current;
          lastHoveredIndex.current = indexRef.current;

          onDragStartRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Animated.spring(scaleAnim, { toValue: 1.08, friction: 6, useNativeDriver: true }).start();
        },
        onPanResponderMove: (_e, gestureState) => {
          const startPos = getPosition(initialIndex.current);
          const currentX = startPos.x + gestureState.dx;
          const currentY = startPos.y + gestureState.dy;

          pos.setValue({ x: currentX, y: currentY });

          const cellStride = SQUARE_SIZE + GRID_GAP;
          const centerX = currentX + SQUARE_SIZE / 2;
          const centerY = currentY + SQUARE_SIZE / 2;
          const n = totalRef.current;

          const targetCol = Math.max(0, Math.min(COLUMNS - 1, Math.floor(centerX / cellStride)));
          const rowCount = Math.max(1, Math.ceil(n / COLUMNS));
          const maxRow = Math.max(0, rowCount - 1);
          const targetRow = Math.max(0, Math.min(maxRow, Math.floor(centerY / cellStride)));

          let targetIndex = targetRow * COLUMNS + targetCol;
          targetIndex = Math.min(Math.max(0, targetIndex), Math.max(0, n - 1));

          if (targetIndex !== lastHoveredIndex.current) {
            lastHoveredIndex.current = targetIndex;
            Haptics.selectionAsync();
            onHoverSwapRef.current(uriRef.current, targetIndex);
          }
        },
        onPanResponderRelease: () => finishDragRef.current(),
        onPanResponderTerminate: () => finishDragRef.current(),
      }),
    [pos, scaleAnim]
  );

  // Unikalny stos przy nakładaniu się kafelków w trakcie animacji (równy zIndex = losowa kolejność malowania).
  const stackOrder = isActive ? 1000 : 10 + index;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.squareContainer,
        {
          transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: scaleAnim }],
          zIndex: stackOrder,
          // Zielony "glow" i mocny cień przy uchwyceniu
          shadowColor: isActive ? Colors.primary : '#000',
          shadowOpacity: isActive ? 0.6 : 0.0,
          shadowOffset: isActive ? { width: 0, height: 10 } : { width: 0, height: 0 },
          shadowRadius: isActive ? 15 : 0,
          elevation: isActive ? 28 : Math.min(2 + index, 24),
        }
      ]}
    >
      <Image source={{ uri }} style={styles.squareImage} />
      
      <View style={[styles.matrixOverlay, { opacity: isActive ? 0.3 : 1 }]}>
        <View style={styles.dotMatrix}>
          {[...Array(9)].map((_, i) => <View key={i} style={styles.matrixDot} />)}
        </View>
      </View>

      {index === 0 && (
        <View style={styles.coverBadge}>
          <Text style={styles.coverBadgeText}>OKŁADKA</Text>
        </View>
      )}

      {progress < 100 && (
        <View style={styles.uploadOverlay}>
          <Text style={styles.uploadText}>{progress}%</Text>
          <View style={styles.miniProgressTrack}>
            <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {/* Przycisk usuwania działa bezpiecznie dzięki ograniczeniom PanRespondera */}
      <Pressable onPress={() => onRemove(index)} style={styles.squareRemoveBtn} hitSlop={10}>
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    </Animated.View>
  );
};

const aiVocabulary = {
  intros: ["Przekrocz próg przestrzeni, która redefiniuje pojęcie luksusu i komfortu.", "Rzadka okazja na rynku. Nieruchomość, która natychmiast przykuwa uwagę.", "Oto miejsce stworzone z myślą o osobach ceniących miejski styl życia.", "Harmonia, spokój i doskonały design. Ta propozycja zadowoli najbardziej wymagających."],
  poi: ["W promieniu 500 metrów znajdziesz renomowane szkoły i nowoczesny kompleks.", "Zaledwie 3 minuty spacerem do głównych węzłów komunikacyjnych.", "Otoczenie to kwintesencja wielkomiejskiego życia: kawiarnie i restauracje.", "Dla aktywnych: ścieżki rowerowe, kluby fitness i bliskość rzeki."],
  marketOccasion: [
    "To propozycja o charakterze okazji rynkowej — relacja ceny do metrażu wypada bardzo konkurencyjnie.",
    "Analiza porównawcza wskazuje na atrakcyjną wycenę względem podobnych ofert w najbliższej okolicy.",
    "W tym segmencie lokalnym to jedna z ciekawszych ofert cenowych dostępnych obecnie na rynku."
  ],
  marketFair: [
    "Cena pozostaje na poziomie rynkowym, spójnym z aktualnymi transakcjami dla podobnych nieruchomości.",
    "Wycena jest wyważona i dobrze wpisuje się w lokalne widełki cenowe.",
    "To stabilna, rynkowa propozycja — bez sztucznego zawyżenia, z zachowaniem jakości oferty."
  ],
  marketPremium: [
    "Oferta pozycjonowana jest jako ekskluzywna — wyższa cena odzwierciedla standard, lokalizację i potencjał.",
    "To segment premium: wycena ponad średnią rynkową wynika z jakości i profilu nieruchomości.",
    "Nieruchomość celuje w klienta premium, który szuka jakości ponad przeciętność rynkową."
  ],
};

const formatNumber = (value: number | string): string =>
  String(value || '')
    .replace(/\D/g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function Step5_Media({ theme }: { theme: any }) {
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => {
        setCurrentStep(5);
        const { draft: d } = useOfferStore.getState();
        const dedupedImages = uniqueImages(d.images || []);
        const cleaned = pruneImageByteSizes(dedupedImages, d.imageByteSizes || {});
        const prev = d.imageByteSizes || {};
        const sameSizes =
          Object.keys(cleaned).length === Object.keys(prev).length &&
          Object.keys(cleaned).every((k) => cleaned[k] === prev[k]);
        const sameImages =
          Array.isArray(d.images) &&
          d.images.length === dedupedImages.length &&
          d.images.every((v: string, i: number) => v === dedupedImages[i]);
        if (!sameSizes || !sameImages) {
          updateDraft({ images: dedupedImages, imageByteSizes: cleaned });
        }
      }, 0);
      return () => clearTimeout(id);
    }, [setCurrentStep, updateDraft])
  );
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [sizingGallery, setSizingGallery] = useState(false);
  /** Kolejność podczas przeciągania — bez ciągłego zapisu do Zustand (brak „skakania”). */
  const [dragSnapshot, setDragSnapshot] = useState<string[] | null>(null);
  const dragSnapshotRef = useRef<string[] | null>(null);

  const displayImages = dragSnapshot ?? draft.images;
  const imageSizes: Record<string, number> = draft.imageByteSizes || {};
  const usedMB =
    sumImageBytes(displayImages, imageSizes) / (1024 * 1024);
  const estimatedCount = countUnknownImageSizes(displayImages, imageSizes);

  const isTitleValid = (draft.title?.length || 0) >= 10;
  const isDescValid = (draft.description?.length || 0) >= 10;

  const mediaAnim = useRef(new Animated.Value(isTitleValid ? 1 : 0.3)).current;
  useEffect(() => {
    Animated.timing(mediaAnim, { toValue: isTitleValid ? 1 : 0.3, duration: 400, useNativeDriver: true }).start();
  }, [isTitleValid]);

  const handleTitleChange = (text: string) => { if (text.length <= MAX_TITLE_LENGTH) updateDraft({ title: text }); };

  const startFakeUploadProgress = (uri: string) => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 12) + 8;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setUploadProgress((prev) => ({ ...prev, [uri]: currentProgress }));
    }, 180);
  };

  const pickGallery = async () => {
    if (sizingGallery) return;
    if (draft.images.length >= MAX_IMAGES) {
      return Alert.alert('Limit zdjęć', 'Osiągnięto maksymalny limit 20 zdjęć.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setSizingGallery(true);
      let nextImages = uniqueImages([...draft.images]);
      /** Zawsze start od oczyszczonej mapy — usuwa zombie wpisy blokujące miejsce. */
      let nextSizes = pruneImageByteSizes(nextImages, { ...(draft.imageByteSizes || {}) });
      updateDraft({ imageByteSizes: nextSizes });

      let runningBytes = sumImageBytes(nextImages, nextSizes);

      for (const asset of result.assets) {
        if (nextImages.length >= MAX_IMAGES) break;

        const measured = await estimateBytesForDraftImage(asset.uri, asset.fileSize ?? null);

        if (runningBytes + measured > MAX_BYTES) {
          Alert.alert(
            'Limit miejsca',
            `Po konwersji (np. HEIC→JPEG) zestaw zbliża się do pojemności maksimum ${MAX_MB} MB.` +
              `\nSpróbuj usunąć zdjęcia z listy albo dopisać jeśli jest miejsce, albo prześlij kilka pojedynczych plików.`
          );
          break;
        }

        if (!nextImages.includes(asset.uri)) nextImages.push(asset.uri);
        nextSizes[asset.uri] = measured;
        nextSizes = pruneImageByteSizes(nextImages, nextSizes);
        runningBytes = sumImageBytes(nextImages, nextSizes);
        setUploadProgress((prev) => ({ ...prev, [asset.uri]: 0 }));
        startFakeUploadProgress(asset.uri);
      }

      if (nextImages.length > draft.images.length) {
        updateDraft({ images: uniqueImages(nextImages), imageByteSizes: nextSizes });
      }
    } finally {
      setSizingGallery(false);
    }
  };

  const removeImage = (indexToRemove: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const uriToRemove = displayImages[indexToRemove];
    const newProgress = { ...uploadProgress };
    delete newProgress[uriToRemove];
    setUploadProgress(newProgress);

    const filtered = uniqueImages(displayImages.filter((_: string, i: number) => i !== indexToRemove));
    const mergedSizes = { ...(draft.imageByteSizes || {}) };
    const nextSizes = pruneImageByteSizes(filtered, mergedSizes);

    setDragSnapshot(null);
    updateDraft({ images: filtered, imageByteSizes: nextSizes });
  };

  const handleDragStart = useCallback(() => {
    const next = uniqueImages([...draft.images]);
    dragSnapshotRef.current = next;
    setDragSnapshot(next);
    setIsDraggingGlobal(true);
  }, [draft.images]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingGlobal(false);
    const snap = dragSnapshotRef.current ? uniqueImages(dragSnapshotRef.current) : null;
    if (snap != null) {
      const { draft: d } = useOfferStore.getState();
      const nextSizes = pruneImageByteSizes(snap, d.imageByteSizes || {});
      updateDraft({ images: snap, imageByteSizes: nextSizes });
    }
    dragSnapshotRef.current = null;
    setDragSnapshot(null);
  }, [updateDraft]);

  const handleHoverSwap = useCallback(
    (uri: string, targetIndex: number) => {
      setDragSnapshot((prev) => {
        const arr = [...(prev ?? draft.images)];
        const currentIndex = arr.indexOf(uri);
        if (currentIndex === targetIndex || currentIndex === -1) return prev;
        const next = [...arr];
        const [item] = next.splice(currentIndex, 1);
        next.splice(targetIndex, 0, item);
        dragSnapshotRef.current = next;
        return next;
      });
    },
    [draft.images]
  );

  const pickFloorPlan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 });
    if (!result.canceled) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); updateDraft({ floorPlan: result.assets[0].uri }); }
  };
  const removeFloorPlan = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateDraft({ floorPlan: null }); };

  const generateAI = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.loop(Animated.sequence([ Animated.timing(glowAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }), Animated.timing(glowAnim, { toValue: 0.1, duration: 800, useNativeDriver: true }) ])).start();

    const randomIntro = aiVocabulary.intros[Math.floor(Math.random() * aiVocabulary.intros.length)];
    const randomPoi = aiVocabulary.poi[Math.floor(Math.random() * aiVocabulary.poi.length)];
    const propType = draft.propertyType === 'HOUSE' ? 'dom' : draft.propertyType === 'PLOT' ? 'działkę' : 'apartament';
    const condition = draft.condition === 'READY' ? 'gotowy do wprowadzenia' : draft.condition === 'RENOVATION' ? 'z potencjałem do remontu' : 'w stanie deweloperskim';
    const transactionType = draft.transactionType === 'RENT' ? 'wynajem' : 'sprzedaż';
    const isRestOfCountry = String(draft.city || '').trim() === 'Reszta kraju';
    const district = String(draft.district || '').trim();
    const city = String(draft.city || '').trim();
    const locationName =
      isRestOfCountry
        ? (district && district.toLowerCase() !== 'ogólna' ? district : 'wybranej miejscowości')
        : (district && district.toLowerCase() !== 'ogólna' ? `${city}, ${district}` : (city || 'wybranej miejscowości'));

    const areaNum = Number(String(draft.area || '').replace(/\s/g, '').replace(',', '.')) || 0;
    const priceNum = Number(String(draft.price || '').replace(/\s/g, '')) || 0;
    const adminFeeNum = Number(String(draft.adminFee || draft.rent || '').replace(/\s/g, '')) || 0;
    const depositNum = Number(String(draft.deposit || '').replace(/\s/g, '')) || 0;
    const pricePerSqm = areaNum > 0 ? Math.round(priceNum / areaNum) : 0;
    const avgPrice =
      city === 'Warszawa'
        ? 16500
        : city === 'Łódź'
          ? 8500
          : city === 'Kraków' || city === 'Wrocław' || city === 'Poznań' || city === 'Trójmiasto'
            ? 13000
            : 12000;
    const diffPercent = avgPrice > 0 && pricePerSqm > 0 ? Math.round(((pricePerSqm - avgPrice) / avgPrice) * 100) : 0;

    const marketHeader =
      diffPercent <= -5
        ? 'OKAZJA'
        : diffPercent >= 5
          ? 'EKSKLUZYWNA'
          : 'CENA RYNKOWA';
    const marketNarrativePool =
      diffPercent <= -5
        ? aiVocabulary.marketOccasion
        : diffPercent >= 5
          ? aiVocabulary.marketPremium
          : aiVocabulary.marketFair;
    const marketNarrative = marketNarrativePool[Math.floor(Math.random() * marketNarrativePool.length)];

    const heatingLabel = draft.heating ? String(draft.heating) : 'Nie podano';
    const amenities: string[] = [];
    if (draft.hasBalcony) amenities.push('Balkon / taras');
    if (draft.hasParking) amenities.push('Garaż / parking');
    if (draft.hasStorage) amenities.push('Piwnica / komórka lokatorska');
    if (draft.hasElevator) amenities.push('Winda');
    if (draft.hasGarden) amenities.push('Ogródek');
    if (draft.isFurnished) amenities.push('Umeblowane wnętrze');

    const poiCandidates = [
      "🚇 Komunikacja miejska w wygodnym zasięgu (autobus/tramwaj) — codzienne dojazdy są szybkie i przewidywalne.",
      "🛍 W pobliżu dostępne są punkty usługowe: sklepy, piekarnie, apteki i strefa gastronomiczna.",
      "🌿 W otoczeniu znajdziesz tereny rekreacyjne idealne na spacer, bieganie lub rower po pracy.",
      "☕ Lokalizacja wspiera wygodny styl życia — kawiarnie, restauracje i codzienna infrastruktura są pod ręką.",
      "🚗 Dogodny wyjazd na główne trasy ułatwia poruszanie się po mieście i poza nim.",
      "🏫 Rodzinna infrastruktura (szkoły/przedszkola) jest osiągalna w krótkim czasie."
    ];
    if (city === 'Warszawa') {
      poiCandidates.push("Ⓜ️ W zależności od dzielnicy stacje metra pozostają w praktycznym zasięgu komunikacji miejskiej.");
      poiCandidates.push("🍔 W okolicy nie brakuje rozpoznawalnych marek gastronomicznych oraz punktów typu drive.");
    }
    if (draft.lat && draft.lng) {
      poiCandidates.push("📍 Adres został wskazany pinezką na mapie, co zwiększa precyzję dopasowania względem lokalnych potrzeb klienta.");
    }
    const shuffledPoi = [...poiCandidates].sort(() => Math.random() - 0.5);
    const enrichedPoi = shuffledPoi.slice(0, 3).join('\n');

    let bullets = "";
    if (draft.transactionType) bullets += `\n🔁 Typ transakcji: ${transactionType === 'sprzedaż' ? 'Sprzedaż' : 'Wynajem'}`;
    if (draft.propertyType) {
      const propertyTypeLabel =
        draft.propertyType === 'HOUSE'
          ? 'Dom'
          : draft.propertyType === 'PLOT'
            ? 'Działka'
            : draft.propertyType === 'PREMISES'
              ? 'Lokal'
              : 'Mieszkanie';
      bullets += `\n🏷 Typ nieruchomości: ${propertyTypeLabel}`;
    }
    if (draft.area) bullets += `\n📐 Powierzchnia: ${draft.area} m²`;
    if (draft.plotArea) bullets += `\n🌿 Powierzchnia działki: ${draft.plotArea} m²`;
    if (draft.rooms) bullets += `\n🛏 Pokoje: ${draft.rooms}`;
    if (draft.floor) bullets += `\n🏢 Piętro: ${draft.floor}`;
    if (draft.totalFloors) bullets += `\n🏙 Liczba pięter w budynku: ${draft.totalFloors}`;
    if (draft.yearBuilt || draft.buildYear) bullets += `\n🗓 Rok budowy: ${draft.yearBuilt || draft.buildYear}`;
    if (draft.price) bullets += `\n💰 Cena: ${formatNumber(draft.price)} PLN`;
    if (pricePerSqm > 0) bullets += `\n📊 Cena za m²: ${formatNumber(pricePerSqm)} PLN`;
    if (adminFeeNum > 0 && transactionType === 'sprzedaż') bullets += `\n💶 Czynsz adm.: ${formatNumber(adminFeeNum)} PLN`;
    if (depositNum > 0 && transactionType === 'wynajem') bullets += `\n🔐 Kaucja: ${formatNumber(depositNum)} PLN`;
    if (draft.condition && draft.propertyType !== 'PLOT') {
      const conditionLabel =
        draft.condition === 'READY'
          ? 'Gotowe do wprowadzenia'
          : draft.condition === 'RENOVATION'
            ? 'Do remontu'
            : 'Stan deweloperski';
      bullets += `\n🧱 Stan: ${conditionLabel}`;
    }
    bullets += `\n🔥 Ogrzewanie: ${heatingLabel}`;
    if (draft.city || draft.district) bullets += `\n📍 Lokalizacja: ${locationName}`;
    if (draft.street) bullets += `\n🧭 Adres: ${draft.street}`;
    if (draft.apartmentNumber) bullets += `\n🔢 Numer lokalu: ${draft.apartmentNumber}`;
    if (draft.isExactLocation !== undefined) {
      bullets += `\n🛰 Tryb lokalizacji: ${draft.isExactLocation ? 'Dokładna (pin precyzyjny)' : 'Przybliżona (obszar prywatności)'}`;
    }

    const amenitiesText = amenities.length > 0
      ? amenities.map((item) => `✓ ${item}`).join('\n')
      : '✓ Brak dodatkowych udogodnień zaznaczonych na tym etapie.';

    const marketSpread = pricePerSqm > 0
      ? `\n📌 Cena ofertowa / średnia lokalna: ${formatNumber(pricePerSqm)} vs ${formatNumber(avgPrice)} PLN/m² (${diffPercent > 0 ? '+' : ''}${diffPercent}%)`
      : '';

    const fullText = `${randomIntro}\n\nPrezentujemy wyjątkowy ${propType} na ${transactionType}, zlokalizowany w sercu: ${locationName}. Nieruchomość jest ${condition}, co czyni ją niezwykle atrakcyjną ofertą.\n\n✧ ANALIZA OKOLICY ✧\n${randomPoi}\n${enrichedPoi}\n\n✧ ANALIZA RYNKU ✧\n${marketHeader}\n${marketNarrative}${marketSpread}\n\n✧ UDOGODNIENIA ✧\n${amenitiesText}\n\n✧ KLUCZOWE PARAMETRY ✧${bullets}\n\nZapraszamy do kontaktu w celu umówienia prywatnej prezentacji.`;
    
    updateDraft({ description: '' });
    const words = fullText.split(' ');
    let currentWordIndex = 0; let tempText = '';

    const typingInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        tempText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        updateDraft({ description: tempText });
        if (currentWordIndex % 4 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        currentWordIndex++;
      } else {
        clearInterval(typingInterval); 
        setIsGenerating(false); 
        glowAnim.stopAnimation();
        Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 40); 
  };

  const isDark = theme.glass === 'dark';
  // Obliczamy dynamiczną wysokość kontenera, aby absolutnie ułożone kwadraty nie obcięły się u dołu
  const gridHeight =
    Math.ceil((displayImages.length || 1) / COLUMNS) * (SQUARE_SIZE + GRID_GAP);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView scrollEnabled={!isDraggingGlobal} contentContainerStyle={{ padding: GRID_PADDING }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={5} draft={draft} theme={theme} navigation={navigation} />
        <Text style={{ fontSize: 34, fontWeight: '800', marginBottom: 30, color: theme.text }}>Media i Opis</Text>
        
        <View style={styles.titleSection}>
          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10 }}>Tytuł Oferty</Text>
          <View style={[styles.titleInputBox, { backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF', borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)' }]}>
            <TextInput 
              style={[styles.titleInput, { color: theme.text }]} 
              placeholder="np. Luksusowy apartament z widokiem na skyline" 
              placeholderTextColor={theme.subtitle} 
              value={draft.title} 
              onChangeText={handleTitleChange} 
              maxLength={MAX_TITLE_LENGTH}
            />
          </View>
        </View>

        <Animated.View style={{ opacity: mediaAnim, transform: [{ translateY: mediaAnim.interpolate({ inputRange: [0.3, 1], outputRange: [15, 0] }) }] }} pointerEvents={isTitleValid ? 'auto' : 'none'}>
          
          <View style={[styles.limitsDashboard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.05)' }]}>
            <CapacityBar label="Wgrane Zdjęcia" current={displayImages.length} max={MAX_IMAGES} suffix="Szt." theme={theme} />
            <CapacityBar label="Przestrzeń Dysku" current={usedMB} max={MAX_MB} suffix="MB" theme={theme} />
            {estimatedCount > 0 && (
              <Text style={[styles.capacityHint, { color: theme.subtitle }]}>
                {estimatedCount} {estimatedCount === 1 ? 'plik ma' : 'pliki mają'} rozmiar szacunkowy do czasu pełnego pomiaru.
              </Text>
            )}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 5 }}>Siatka Zdjęć</Text>
          
          {/* NOWY, ABSOLUTNIE POZYCJONOWANY GRID (APPLE-STYLE) */}
          {displayImages.length > 0 && (
            <View style={[styles.gridContainer, { height: gridHeight }]}>
              {displayImages.map((uri: string, index: number) => (
                <DraggableSquare
                  key={uri}
                  uri={uri}
                  index={index}
                  total={displayImages.length}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onHoverSwap={handleHoverSwap}
                  onRemove={removeImage}
                  theme={theme}
                  progress={uploadProgress[uri] ?? 100}
                />
              ))}
            </View>
          )}

          <AppleHover onPress={pickGallery} scaleTo={0.98}>
             <View style={[styles.addMediaBtn, { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)', opacity: sizingGallery ? 0.65 : 1 }]}>
                {sizingGallery ? (
                  <ActivityIndicator color={theme.text} style={{ marginRight: 12 }} />
                ) : (
                  <Ionicons name="camera" size={24} color={theme.text} style={{ marginRight: 10 }} />
                )}
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text }}>
                  {sizingGallery ? 'Liczenie miejsca (konwersja podglądowa)...' : displayImages.length > 0 ? 'Dodaj kolejne zdjęcia' : 'Otwórz galerię'}
                </Text>
             </View>
          </AppleHover>

          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10, marginTop: 15 }}>Plan Nieruchomości</Text>
          <AppleHover onPress={pickFloorPlan} scaleTo={0.98}>
            <View style={[styles.floorPlanContainer, { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)', height: draft.floorPlan ? 220 : 70 }]}>
              {draft.floorPlan ? (
                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Image source={{ uri: draft.floorPlan }} style={{ width: '100%', height: '100%', borderRadius: 16 }} resizeMode="cover" />
                  <Pressable onPress={removeFloorPlan} style={styles.removeFloorPlanBtn}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Ionicons name="map-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>Wgraj rzut poziomy</Text>
                </View>
              )}
            </View>
          </AppleHover>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 15 }}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
               <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>Opis Oferty</Text>
               {!isDescValid && <Text style={{ fontSize: 11, color: Colors.danger, marginLeft: 8 }}>* (min. 10 znaków)</Text>}
            </View>
            <AppleHover onPress={generateAI} scaleTo={1.05}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.aiGlow, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 }}>
                <Ionicons name="sparkles" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13, marginLeft: 6 }}>{isGenerating ? 'Analizuję...' : 'Wygeneruj AI'}</Text>
              </View>
            </AppleHover>
          </View>
          
          <View style={{ position: 'relative' }}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.aiGlow, borderRadius: 24, opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }] }]} />
            <View style={{ backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: isDark ? Colors.premiumBorder : (isDescValid ? Colors.primary : 'rgba(0,0,0,0.05)'), padding: 20, minHeight: 280, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
              <TextInput 
                multiline 
                style={{ fontSize: 15, fontWeight: '500', lineHeight: 24, color: theme.text, textAlignVertical: 'top' }} 
                placeholder="Pozwól AI przeanalizować Twoją nieruchomość i stworzyć idealny opis, lub wpisz go ręcznie..." 
                placeholderTextColor={theme.subtitle} 
                value={draft.description} 
                onChangeText={(t) => updateDraft({ description: t })} 
                editable={!isGenerating} 
              />
            </View>
          </View>

        </Animated.View>

        <AddOfferStepFooterHint
          theme={theme}
          icon="images-outline"
          text="Pierwsze zdjęcie jest okładką na listach — kolejność zmienisz, przeciągając miniatury. Staraj się o dobre światło i czytelne kadry; plan rzutu zwiększa zaufanie do układu lokalu. Opis uzupełnia dane z formularza i powinien odzwierciedlać rzeczywisty stan nieruchomości (także gdy korzystasz z podpowiedzi AI)."
        />
        <View style={{ height: 48 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ 
  titleSection: { marginBottom: 30 },
  titleInputBox: { borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5 },
  titleInput: { fontSize: 16, fontWeight: '600', paddingHorizontal: 20, paddingVertical: 18 },
  
  limitsDashboard: { padding: 18, borderRadius: 20, borderWidth: 1, marginBottom: 25, gap: 16 },
  capacityContainer: { width: '100%' },
  capacityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  capacityLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  capacityValue: { fontSize: 13, fontWeight: '800' },
  capacityTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  capacityFill: { height: '100%', borderRadius: 3 },
  capacityHint: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  gridContainer: { position: 'relative', width: '100%', marginBottom: 20 },
  squareContainer: { position: 'absolute', width: SQUARE_SIZE, height: SQUARE_SIZE, borderRadius: 16, backgroundColor: '#e5e5ea' },
  squareImage: { width: '100%', height: '100%', borderRadius: 16 },
  
  matrixOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 16 },
  dotMatrix: { width: 24, height: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
  matrixDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2 },

  coverBadge: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(16, 185, 129, 0.9)', paddingVertical: 4, alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  coverBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  squareRemoveBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  uploadOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  miniProgressTrack: { width: '70%', height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  miniProgressFill: { height: '100%', backgroundColor: Colors.primary },

  addMediaBtn: { width: '100%', height: 65, borderRadius: 18, borderStyle: 'dashed', borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  floorPlanContainer: { width: '100%', borderRadius: 18, borderStyle: 'dashed', borderWidth: 2 },
  removeFloorPlanBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }
});