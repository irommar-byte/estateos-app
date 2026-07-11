import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput, KeyboardAvoidingView, Platform, ScrollView, Animated, Alert, PanResponder, ActivityIndicator, useWindowDimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import { AddOfferFieldHint } from '../../components/AddOfferValidation';
import {
  ADD_OFFER_DESC_MAX,
  ADD_OFFER_DESC_MIN,
  ADD_OFFER_TITLE_MAX,
  ADD_OFFER_TITLE_MIN,
  resolvePlotAreaForSubmit,
} from './validation';
import {
  OFFER_MEDIA_MAX_IMAGES,
  OFFER_MEDIA_UPLOAD_CAP_BYTES,
  OFFER_MEDIA_UPLOAD_CAP_MB,
  estimateBytesForDraftImage,
  sumEstimatedUploadBytes,
  pruneImageByteSizes,
  canAcceptDraftImage,
  formatMediaCapacityAlert,
} from '../../utils/offerMediaCapacity';
import { REST_OF_COUNTRY_CITY } from '../../constants/locationEcosystem';
import { getAppLocale, t, useI18n } from '../../i18n';
import RoomScanModal, { isRoomScanSupportedOnDevice } from '../../components/roomScan/RoomScanModal';
import ProPhotoSessionModal from '../../components/ProPhotoSessionModal';
import type { RoomScanDraftAssets } from '../../types/roomScan';
import { pl } from '../../i18n/locales/pl';
import { en } from '../../i18n/locales/en';
import { useAuthStore } from '../../store/useAuthStore';
import { generateListingDescriptionWithGpt } from '../../services/offerDescriptionAiService';

const Colors = { primary: '#10b981', aiGlow: '#8b5cf6', danger: '#ef4444', premiumDark: '#1C1C1E', premiumBorder: 'rgba(255,255,255,0.08)' };

function getAddOfferAiCopy() {
  return getAppLocale() === 'en' ? en.addOffer.step5.ai : pl.addOffer.step5.ai;
}

const HEATING_LABEL_KEYS: Record<string, string> = {
  '': 'addOffer.step3.heating.none',
  Miejskie: 'addOffer.step3.heating.district',
  Gazowe: 'addOffer.step3.heating.gas',
  Elektryczne: 'addOffer.step3.heating.electric',
  'Pompa Ciepła': 'addOffer.step3.heating.heatPump',
  'Węglowe/Pellet': 'addOffer.step3.heating.coalPellet',
  Inne: 'addOffer.step3.heating.other',
};
const MAX_TITLE_LENGTH = 70;
const MAX_IMAGES = OFFER_MEDIA_MAX_IMAGES;
const MAX_MB = OFFER_MEDIA_UPLOAD_CAP_MB;
const MAX_BYTES = OFFER_MEDIA_UPLOAD_CAP_BYTES;

function countUnknownImageSizes(uris: string[], sizes: Record<string, number> | undefined): number {
  const map = sizes || {};
  return uris.reduce((acc, uri) => acc + (typeof map[uri] === 'number' && map[uri] > 0 ? 0 : 1), 0);
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

const GRID_PADDING = 20;
const GRID_GAP = 12;
const COLUMNS = 3;

const squareSizeForWidth = (screenWidth: number) =>
  (screenWidth - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

const getPositionForSize = (index: number, squareSize: number) => ({
  x: (index % COLUMNS) * (squareSize + GRID_GAP),
  y: Math.floor(index / COLUMNS) * (squareSize + GRID_GAP),
});

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const read = await ImagePicker.getMediaLibraryPermissionsAsync();
  const hasAccess =
    read.granted ||
    read.accessPrivileges === 'all' ||
    read.accessPrivileges === 'limited';
  if (hasAccess) return true;

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const ok =
    requested.granted ||
    requested.accessPrivileges === 'all' ||
    requested.accessPrivileges === 'limited';
  if (ok) return true;

  Alert.alert(
    t('addOffer.step5.alerts.photoAccess.title'),
    t('addOffer.step5.alerts.photoAccess.message'),
    [
      { text: t('addOffer.common.cancel'), style: 'cancel' },
      { text: t('addOffer.common.settings'), onPress: () => Linking.openSettings() },
    ],
  );
  return false;
}

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
  squareSize,
}: any) => {
  const pos = useRef(new Animated.ValueXY(getPositionForSize(index, squareSize))).current;
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
        toValue: getPositionForSize(index, squareSize),
        useNativeDriver: true,
        friction: 9,
        tension: 68,
      }).start();
    }
  }, [index, pos, squareSize]);

  const finishDrag = useCallback(() => {
    setIsActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(pos, {
        toValue: getPositionForSize(indexRef.current, squareSize),
        useNativeDriver: true,
        friction: 9,
        tension: 85,
      }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start(() => {
      onDragEndRef.current();
    });
    isDragging.current = false;
  }, [pos, scaleAnim, squareSize]);

  const finishDragRef = useRef(finishDrag);
  finishDragRef.current = finishDrag;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        /** Od razu łapiemy dotyk na kafelku (bez fazy capture), żeby ScrollView / stack nie wygrał przed ruchem. */
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
        /** Nie oddajemy respondenta nawigacji „w tył” w trakcie przeciągania zdjęcia. */
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
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
          const startPos = getPositionForSize(initialIndex.current, squareSize);
          const currentX = startPos.x + gestureState.dx;
          const currentY = startPos.y + gestureState.dy;

          pos.setValue({ x: currentX, y: currentY });

          const cellStride = squareSize + GRID_GAP;
          const centerX = currentX + squareSize / 2;
          const centerY = currentY + squareSize / 2;
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
    [pos, scaleAnim, squareSize]
  );

  // Unikalny stos przy nakładaniu się kafelków w trakcie animacji (równy zIndex = losowa kolejność malowania).
  const stackOrder = isActive ? 1000 : 10 + index;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.squareContainer,
        {
          width: squareSize,
          height: squareSize,
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
          <Text style={styles.coverBadgeText}>{t('addOffer.step5.coverBadge')}</Text>
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

const formatNumber = (value: number | string): string =>
  String(value || '')
    .replace(/\D/g, '')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function Step5_Media({ theme }: { theme: any }) {
  const { t: translate, locale } = useI18n();
  const token = useAuthStore((s) => s.token);
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const squareSize = useMemo(() => squareSizeForWidth(screenWidth), [screenWidth]);
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
  const [isGeneratingGpt, setIsGeneratingGpt] = useState(false);
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [sizingGallery, setSizingGallery] = useState(false);
  /** Kolejność podczas przeciągania — bez ciągłego zapisu do Zustand (brak „skakania”). */
  const [dragSnapshot, setDragSnapshot] = useState<string[] | null>(null);
  const dragSnapshotRef = useRef<string[] | null>(null);
  const [roomScanOpen, setRoomScanOpen] = useState(false);
  const [proPhotoSessionOpen, setProPhotoSessionOpen] = useState(false);
  const roomScanAvailable = isRoomScanSupportedOnDevice();

  const draftImages = Array.isArray(draft.images) ? draft.images : [];
  const displayImages = dragSnapshot ?? draftImages;
  const imageSizes: Record<string, number> = draft.imageByteSizes || {};
  const usedMB =
    sumEstimatedUploadBytes(displayImages, imageSizes) / (1024 * 1024);
  const estimatedCount = countUnknownImageSizes(displayImages, imageSizes);

  const titleLength = (draft.title || '').trim().length;
  const descLength = (draft.description || '').trim().length;
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
    if (draftImages.length >= MAX_IMAGES) {
      return Alert.alert(
        translate('addOffer.step5.alerts.photoLimit.title'),
        translate('addOffer.step5.alerts.photoLimit.message'),
      );
    }

    try {
      const permitted = await ensureMediaLibraryPermission();
      if (!permitted) return;

      const slotsLeft = Math.max(1, MAX_IMAGES - draftImages.length);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: slotsLeft,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSizingGallery(true);
      let nextImages = uniqueImages([...draftImages]);
      /** Zawsze start od oczyszczonej mapy — usuwa zombie wpisy blokujące miejsce. */
      let nextSizes = pruneImageByteSizes(nextImages, { ...(draft.imageByteSizes || {}) });
      updateDraft({ imageByteSizes: nextSizes });

      let runningBytes = sumEstimatedUploadBytes(nextImages, nextSizes);

      for (const asset of result.assets) {
        if (nextImages.length >= MAX_IMAGES) break;

        const measured = await estimateBytesForDraftImage(asset.uri, asset.fileSize ?? null);

        const accept = canAcceptDraftImage({
          currentUris: nextImages,
          sizes: nextSizes,
          newEstimatedBytes: measured,
          pickerReportedBytes: asset.fileSize ?? null,
          newUri: asset.uri,
        });
        if (!accept.ok) {
          Alert.alert(translate('addOffer.step5.alerts.storageLimit.title'), formatMediaCapacityAlert(accept.reason));
          break;
        }

        if (!nextImages.includes(asset.uri)) nextImages.push(asset.uri);
        nextSizes[asset.uri] = measured;
        nextSizes = pruneImageByteSizes(nextImages, nextSizes);
        runningBytes = sumEstimatedUploadBytes(nextImages, nextSizes);
        setUploadProgress((prev) => ({ ...prev, [asset.uri]: 0 }));
        startFakeUploadProgress(asset.uri);
      }

      if (nextImages.length > draftImages.length) {
        updateDraft({ images: uniqueImages(nextImages), imageByteSizes: nextSizes });
      }
    } catch (err: any) {
      Alert.alert(
        translate('addOffer.step5.alerts.addPhotosFailed.title'),
        String(err?.message || '').trim() || translate('addOffer.step5.alerts.addPhotosFailed.message'),
      );
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
    try {
      const permitted = await ensureMediaLibraryPermission();
      if (!permitted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateDraft({ floorPlan: result.assets[0].uri, floorPlan3d: null, floorPlanScanMeta: null });
      }
    } catch (err: any) {
      Alert.alert(
        translate('addOffer.step5.alerts.floorPlanFailed.title'),
        String(err?.message || '').trim() || translate('addOffer.step5.alerts.floorPlanFailed.message'),
      );
    }
  };
  const removeFloorPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateDraft({ floorPlan: null, floorPlan3d: null, floorPlanScanMeta: null });
  };

  const handleRoomScanComplete = (assets: RoomScanDraftAssets) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateDraft({
      floorPlan: assets.floorPlanPngUri,
      floorPlan3d: assets.floorPlan3dUri,
      floorPlanScanMeta: JSON.stringify(assets.scanMeta),
    });
    setRoomScanOpen(false);
  };

  const isDescriptionBusy = isGenerating || isGeneratingGpt;

  const startDescriptionTyping = (fullText: string, onDone: () => void) => {
    updateDraft({ description: '' });
    const words = fullText.split(' ');
    let currentWordIndex = 0;
    let tempText = '';

    const typingInterval = setInterval(() => {
      if (currentWordIndex < words.length) {
        tempText += (currentWordIndex === 0 ? '' : ' ') + words[currentWordIndex];
        updateDraft({ description: tempText });
        if (currentWordIndex % 4 === 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        currentWordIndex++;
      } else {
        clearInterval(typingInterval);
        onDone();
      }
    }, 36);
  };

  const stopGlowAnimation = () => {
    glowAnim.stopAnimation();
    Animated.timing(glowAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  };

  const startGlowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.1, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  };

  const generateGptDescription = async () => {
    if (isDescriptionBusy) return;

    const hasBasics =
      String(draft.propertyType || '').trim() ||
      String(draft.city || '').trim() ||
      String(draft.area || '').trim() ||
      String(draft.price || '').trim();
    if (!hasBasics) {
      Alert.alert(
        translate('addOffer.step5.ai.gptErrorTitle'),
        translate('addOffer.step5.ai.gptInsufficientData'),
      );
      return;
    }
    if (!token) {
      Alert.alert(
        translate('addOffer.step5.ai.gptErrorTitle'),
        translate('addOffer.step5.ai.gptRequiresLogin'),
      );
      return;
    }

    setIsGeneratingGpt(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startGlowAnimation();

    try {
      const { description } = await generateListingDescriptionWithGpt(token, { ...draft }, locale);
      startDescriptionTyping(description, () => {
        setIsGeneratingGpt(false);
        stopGlowAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      });
    } catch (err: any) {
      setIsGeneratingGpt(false);
      stopGlowAnimation();
      Alert.alert(
        translate('addOffer.step5.ai.gptErrorTitle'),
        String(err?.message || translate('addOffer.step5.ai.gptInsufficientData')),
      );
    }
  };

  const generateAI = () => {
    if (isDescriptionBusy) return;
    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    startGlowAnimation();

    const ai = getAddOfferAiCopy();
    const randomIntro = ai.intros[Math.floor(Math.random() * ai.intros.length)];
    const randomPoi = ai.poi[Math.floor(Math.random() * ai.poi.length)];
    const propType =
      draft.propertyType === 'HOUSE'
        ? ai.propertyType.house
        : draft.propertyType === 'PLOT'
          ? ai.propertyType.plot
          : ai.propertyType.flat;
    const condition =
      draft.condition === 'READY'
        ? ai.condition.ready
        : draft.condition === 'RENOVATION'
          ? ai.condition.renovation
          : ai.condition.developer;
    const transactionType = draft.transactionType === 'RENT' ? ai.transaction.rent : ai.transaction.sell;
    const isRestOfCountry = String(draft.city || '').trim() === REST_OF_COUNTRY_CITY;
    const district = String(draft.district || '').trim();
    const city = String(draft.city || '').trim();
    const locationName =
      isRestOfCountry
        ? district && district.toLowerCase() !== 'ogólna'
          ? district
          : ai.locationFallback
        : district && district.toLowerCase() !== 'ogólna'
          ? `${city}, ${district}`
          : city || ai.locationFallback;

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
      diffPercent <= -5 ? ai.marketHeader.bargain : diffPercent >= 5 ? ai.marketHeader.premium : ai.marketHeader.fair;
    const marketNarrativePool =
      diffPercent <= -5 ? ai.marketOccasion : diffPercent >= 5 ? ai.marketPremium : ai.marketFair;
    const marketNarrative = marketNarrativePool[Math.floor(Math.random() * marketNarrativePool.length)];

    const heatingKey = String(draft.heating || '');
    const heatingLabel = translate(HEATING_LABEL_KEYS[heatingKey] || 'addOffer.step3.heating.none');
    const amenities: string[] = [];
    if (draft.hasBalcony) amenities.push(ai.amenities.balcony);
    if (draft.hasParking) amenities.push(ai.amenities.parking);
    if (draft.hasStorage) amenities.push(ai.amenities.storage);
    if (draft.hasElevator) amenities.push(ai.amenities.elevator);
    if (draft.hasGarden) amenities.push(ai.amenities.garden);
    if (draft.isFurnished) amenities.push(ai.amenities.furnished);

    const poiCandidates = [...ai.poiCandidates];
    if (city === 'Warszawa') {
      poiCandidates.push(...ai.poiWarsaw);
    }
    if (draft.lat && draft.lng) {
      poiCandidates.push(ai.poiPin);
    }
    const shuffledPoi = [...poiCandidates].sort(() => Math.random() - 0.5);
    const enrichedPoi = shuffledPoi.slice(0, 3).join('\n');

    let bullets = '';
    if (draft.transactionType) {
      bullets += `\n${ai.bullets.transaction} ${
        draft.transactionType === 'SELL' ? ai.transactionLabels.sell : ai.transactionLabels.rent
      }`;
    }
    if (draft.propertyType) {
      const propertyTypeLabel =
        draft.propertyType === 'HOUSE'
          ? ai.propertyTypeLabels.house
          : draft.propertyType === 'PLOT'
            ? ai.propertyTypeLabels.plot
            : draft.propertyType === 'PREMISES'
              ? ai.propertyTypeLabels.premises
              : ai.propertyTypeLabels.flat;
      bullets += `\n${ai.bullets.propertyType} ${propertyTypeLabel}`;
    }
    const plotAreaForAi = resolvePlotAreaForSubmit(draft);
    if (draft.propertyType === 'PLOT') {
      if (plotAreaForAi) bullets += `\n${ai.bullets.plotArea} ${plotAreaForAi} m²`;
    } else {
      if (draft.area) bullets += `\n${ai.bullets.area} ${draft.area} m²`;
      if (draft.propertyType === 'HOUSE' && plotAreaForAi) {
        bullets += `\n${ai.bullets.plotArea} ${plotAreaForAi} m²`;
      }
    }
    if (draft.rooms) bullets += `\n${ai.bullets.rooms} ${draft.rooms}`;
    if (draft.floor) bullets += `\n${ai.bullets.floor} ${draft.floor}`;
    if (draft.totalFloors) bullets += `\n${ai.bullets.totalFloors} ${draft.totalFloors}`;
    if (draft.yearBuilt || draft.buildYear) {
      bullets += `\n${ai.bullets.yearBuilt} ${draft.yearBuilt || draft.buildYear}`;
    }
    if (draft.price) bullets += `\n${ai.bullets.price} ${formatNumber(draft.price)} PLN`;
    if (pricePerSqm > 0) bullets += `\n${ai.bullets.pricePerSqm} ${formatNumber(pricePerSqm)} PLN`;
    if (adminFeeNum > 0 && draft.transactionType === 'SELL') {
      bullets += `\n${ai.bullets.adminFee} ${formatNumber(adminFeeNum)} PLN`;
    }
    if (depositNum > 0 && draft.transactionType === 'RENT') {
      bullets += `\n${ai.bullets.deposit} ${formatNumber(depositNum)} PLN`;
    }
    if (draft.condition && draft.propertyType !== 'PLOT') {
      const conditionLabel =
        draft.condition === 'READY'
          ? ai.conditionLabels.ready
          : draft.condition === 'RENOVATION'
            ? ai.conditionLabels.renovation
            : ai.conditionLabels.developer;
      bullets += `\n${ai.bullets.condition} ${conditionLabel}`;
    }
    bullets += `\n${ai.bullets.heating} ${heatingLabel}`;
    if (draft.city || draft.district) bullets += `\n${ai.bullets.location} ${locationName}`;
    if (draft.street) bullets += `\n${ai.bullets.address} ${draft.street}`;
    if (draft.apartmentNumber) bullets += `\n${ai.bullets.apartmentNumber} ${draft.apartmentNumber}`;
    if (draft.isExactLocation !== undefined) {
      bullets += `\n${ai.bullets.locationMode} ${
        draft.isExactLocation ? ai.locationMode.exact : ai.locationMode.approximate
      }`;
    }

    const amenitiesText =
      amenities.length > 0 ? amenities.map((item) => `✓ ${item}`).join('\n') : ai.amenities.none;

    const marketSpread =
      pricePerSqm > 0
        ? `\n${translate('addOffer.step5.ai.marketSpread', {
            offerPrice: formatNumber(pricePerSqm),
            avgPrice: formatNumber(avgPrice),
            sign: diffPercent > 0 ? '+' : '',
            percent: diffPercent,
          })}`
        : '';

    const fullText = translate('addOffer.step5.ai.bodyTemplate', {
      intro: randomIntro,
      propertyType: propType,
      transaction: transactionType,
      location: locationName,
      condition,
      neighborhoodSection: ai.sections.neighborhood,
      randomPoi,
      enrichedPoi,
      marketSection: ai.sections.market,
      marketHeader,
      marketNarrative,
      marketSpread,
      amenitiesSection: ai.sections.amenities,
      amenitiesText,
      parametersSection: ai.sections.parameters,
      bullets,
    });
    
    startDescriptionTyping(fullText, () => {
      setIsGenerating(false);
      stopGlowAnimation();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const isDark = theme.glass === 'dark';
  // Obliczamy dynamiczną wysokość kontenera, aby absolutnie ułożone kwadraty nie obcięły się u dołu
  const gridHeight =
    Math.ceil((displayImages.length || 1) / COLUMNS) * (squareSize + GRID_GAP);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView scrollEnabled={!isDraggingGlobal} contentContainerStyle={{ padding: GRID_PADDING }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={5} draft={draft} theme={theme} navigation={navigation} />
        <Text style={{ fontSize: 34, fontWeight: '800', marginBottom: 30, color: theme.text }}>{translate('addOffer.step5.header')}</Text>
        
        <View style={[styles.limitsDashboard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.05)' }]}>
            <CapacityBar label={translate('addOffer.step5.capacity.photos')} current={displayImages.length} max={MAX_IMAGES} suffix={translate('addOffer.step5.capacity.suffixPhotos')} theme={theme} />
            <CapacityBar label={translate('addOffer.step5.capacity.diskSpace')} current={usedMB} max={MAX_MB} suffix={translate('addOffer.step5.capacity.suffixMb')} theme={theme} />
            {estimatedCount > 0 && (
              <Text style={[styles.capacityHint, { color: theme.subtitle }]}>
                {translate('addOffer.step5.capacity.estimatedSizeHint', {
                  count: estimatedCount,
                  filesLabel:
                    estimatedCount === 1
                      ? translate('addOffer.step5.capacity.estimatedSizeFileOne')
                      : translate('addOffer.step5.capacity.estimatedSizeFileMany'),
                })}
              </Text>
            )}
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 5 }}>
            {translate('addOffer.step5.sections.addPhotos')}
          </Text>

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
                  squareSize={squareSize}
                />
              ))}
            </View>
          )}

          <View style={styles.mediaActionsRow}>
            <View style={styles.mediaActionFlex}>
              <AppleHover onPress={pickGallery} scaleTo={0.98}>
                <View
                  style={[
                    styles.addMediaBtn,
                    styles.mediaActionBtn,
                    { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)', opacity: sizingGallery ? 0.65 : 1 },
                  ]}
                >
                  {sizingGallery ? (
                    <ActivityIndicator color={theme.text} style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="camera" size={22} color={theme.text} style={{ marginRight: 8 }} />
                  )}
                  <Text style={[styles.mediaActionText, { color: theme.text }]} numberOfLines={2}>
                    {sizingGallery
                      ? translate('addOffer.step5.gallery.sizing')
                      : displayImages.length > 0
                        ? translate('addOffer.step5.gallery.addMore')
                        : translate('addOffer.step5.gallery.open')}
                  </Text>
                </View>
              </AppleHover>
            </View>
            <View style={styles.mediaActionFlex}>
              <AppleHover onPress={() => setProPhotoSessionOpen(true)} scaleTo={0.98}>
                <View
                  style={[
                    styles.proSessionBtn,
                    styles.mediaActionBtn,
                    {
                      borderColor: isDark ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.25)',
                      backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.06)',
                    },
                  ]}
                >
                  <Ionicons name="sparkles" size={20} color="#a855f7" style={{ marginRight: 8 }} />
                  <Text style={[styles.mediaActionText, { color: theme.text }]} numberOfLines={3}>
                    {translate('addOffer.step5.proSession.cta')}
                  </Text>
                </View>
              </AppleHover>
            </View>
          </View>

          <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10, marginTop: 15 }}>
            {translate('addOffer.step5.sections.floorPlan')}
          </Text>

          {roomScanAvailable ? (
            <AppleHover onPress={() => setRoomScanOpen(true)} scaleTo={0.98}>
              <View
                style={[
                  styles.roomScanCta,
                  {
                    borderColor: isDark ? 'rgba(56,189,248,0.35)' : 'rgba(14,165,233,0.35)',
                    backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(240,249,255,0.95)',
                  },
                ]}
              >
                <View style={styles.roomScanIconWrap}>
                  <Ionicons name="scan-outline" size={22} color="#0ea5e9" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
                      {translate('addOffer.step5.floorPlan.scan')}
                    </Text>
                    <View style={styles.roomScanBadge}>
                      <Text style={styles.roomScanBadgeText}>{translate('addOffer.step5.floorPlan.scanBadge')}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: theme.subtitle, marginTop: 4, lineHeight: 17 }}>
                    {translate('addOffer.step5.floorPlan.scanHint')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.subtitle} />
              </View>
            </AppleHover>
          ) : null}

          <AppleHover onPress={pickFloorPlan} scaleTo={0.98}>
            <View style={[styles.floorPlanContainer, { borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)', height: draft.floorPlan ? 220 : 70, marginTop: roomScanAvailable ? 10 : 0 }]}>
              {draft.floorPlan ? (
                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <Image source={{ uri: draft.floorPlan }} style={{ width: '100%', height: '100%', borderRadius: 16 }} resizeMode="cover" />
                  {draft.floorPlan3d ? (
                    <View style={styles.scannedBadge}>
                      <Ionicons name="cube-outline" size={12} color="#e0f2fe" />
                      <Text style={styles.scannedBadgeText}>{translate('addOffer.step5.floorPlan.scanned')}</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={removeFloorPlan} style={styles.removeFloorPlanBtn}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Ionicons name="map-outline" size={24} color={theme.text} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{translate('addOffer.step5.floorPlan.upload')}</Text>
                </View>
              )}
            </View>
          </AppleHover>

          <RoomScanModal
            visible={roomScanOpen}
            onClose={() => setRoomScanOpen(false)}
            onComplete={handleRoomScanComplete}
          />

          <View style={styles.titleSection}>
            <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle, marginBottom: 10, marginTop: 8 }}>
              {translate('addOffer.step5.sections.title')}
            </Text>
            <View
              style={[
                styles.titleInputBox,
                {
                  backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF',
                  borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.1)',
                },
              ]}
            >
              <TextInput
                style={[styles.titleInput, { color: theme.text }]}
                placeholder={translate('addOffer.step5.titlePlaceholder')}
                placeholderTextColor={theme.subtitle}
                value={draft.title}
                onChangeText={handleTitleChange}
                maxLength={MAX_TITLE_LENGTH}
              />
            </View>
            <AddOfferFieldHint
              current={titleLength}
              min={ADD_OFFER_TITLE_MIN}
              max={ADD_OFFER_TITLE_MAX}
            />
          </View>

          <ProPhotoSessionModal
            visible={proPhotoSessionOpen}
            onClose={() => setProPhotoSessionOpen(false)}
            theme={theme}
            draft={{
              city: draft.city,
              district: draft.district,
              street: draft.street,
              propertyType: draft.propertyType,
              transactionType: draft.transactionType,
            }}
          />

          <View style={{ marginTop: 20, marginBottom: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', textTransform: 'uppercase', color: theme.subtitle }}>
              {translate('addOffer.step5.sections.description')}
            </Text>
            <View style={styles.aiButtonsRow}>
              <View style={styles.aiButtonFlex}>
                <AppleHover onPress={generateAI} scaleTo={1.03}>
                  <View style={[styles.aiTemplateBtn, styles.aiButtonFlexInner]}>
                    <Ionicons name="flash-outline" size={16} color="#ffffff" />
                    <Text style={styles.aiBtnText} numberOfLines={1}>
                      {isGenerating ? translate('addOffer.step5.ai.generating') : translate('addOffer.step5.ai.generate')}
                    </Text>
                  </View>
                </AppleHover>
              </View>
              <View style={styles.aiButtonFlex}>
                <AppleHover onPress={generateGptDescription} scaleTo={1.03}>
                  <View style={[styles.aiGptBtn, styles.aiButtonFlexInner]}>
                    <Ionicons name="sparkles" size={16} color="#ffffff" />
                    <Text style={styles.aiBtnText} numberOfLines={1}>
                      {isGeneratingGpt ? translate('addOffer.step5.ai.generatingGpt') : translate('addOffer.step5.ai.generateGpt')}
                    </Text>
                  </View>
                </AppleHover>
              </View>
            </View>
          </View>
          
          <View style={{ position: 'relative' }}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: Colors.aiGlow, borderRadius: 24, opacity: glowAnim, transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] }) }] }]} />
            <View
              style={{
                backgroundColor: isDark ? Colors.premiumDark : '#FFFFFF',
                borderRadius: 24,
                borderWidth: 1,
                borderColor: isDark ? Colors.premiumBorder : 'rgba(0,0,0,0.05)',
                padding: 20,
                minHeight: 280,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
              }}
            >
              <TextInput
                multiline
                style={{ fontSize: 15, fontWeight: '500', lineHeight: 24, color: theme.text, textAlignVertical: 'top' }}
                placeholder={translate('addOffer.step5.ai.descriptionPlaceholder')}
                placeholderTextColor={theme.subtitle}
                value={draft.description}
                onChangeText={(text) => updateDraft({ description: text })}
                editable={!isDescriptionBusy}
                maxLength={ADD_OFFER_DESC_MAX}
              />
            </View>
          </View>
          {descLength > 0 && descLength < ADD_OFFER_DESC_MIN ? (
            <AddOfferFieldHint current={descLength} min={ADD_OFFER_DESC_MIN} max={ADD_OFFER_DESC_MAX} />
          ) : null}

        <AddOfferStepFooterHint
          theme={theme}
          icon="images-outline"
          text={translate('addOffer.step5.footerHint')}
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
  squareContainer: { position: 'absolute', borderRadius: 16, backgroundColor: '#e5e5ea' },
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

  mediaActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  mediaActionFlex: { flex: 1, minWidth: 0 },
  mediaActionBtn: { width: '100%', minHeight: 78, paddingHorizontal: 12, paddingVertical: 14 },
  mediaActionText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  addMediaBtn: { borderRadius: 18, borderStyle: 'dashed', borderWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  proSessionBtn: { borderRadius: 18, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  floorPlanContainer: { width: '100%', borderRadius: 18, borderStyle: 'dashed', borderWidth: 2 },
  roomScanCta: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomScanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(14,165,233,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomScanBadge: {
    backgroundColor: 'rgba(14,165,233,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roomScanBadgeText: { color: '#0284c7', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  scannedBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scannedBadgeText: { color: '#e0f2fe', fontSize: 11, fontWeight: '800' },
  removeFloorPlanBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  aiButtonsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 12,
  },
  aiButtonFlex: { flex: 1, minWidth: 0 },
  aiButtonFlexInner: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  aiTemplateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  aiGptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.aiGlow,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  aiBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12, flexShrink: 1 },
});