import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import {
  KEI_AUTO_INTERVALS_MIN,
  KEI_AUTO_MAX_COUNT,
  KEI_FALLBACK_APARTMENT_AREA_RANGES,
  KEI_FALLBACK_DISTRICTS,
  KEI_FALLBACK_HOUSE_AREA_RANGES,
  KEI_FALLBACK_RENT_PRICE_RANGES,
  KEI_FALLBACK_SALE_PRICE_RANGES,
  KEI_MAX_SELECT,
  KEI_PAGE_SIZE,
  keiAutoIntervalLabel,
  keiFallbackDatePresets,
  type KeiAutoImportConfig,
  type KeiFloorPlanSelection,
  type KeiPreviewListing,
  type KeiPropertyKind,
  type KeiSearchFacetsResponse,
  type KeiTransactionKind,
} from '../contracts/keiAmerContract';
import {
  keiAmerFetchAutoImport,
  keiAmerFetchFacets,
  keiAmerFetchPreview,
  keiAmerPeekImageUrl,
  keiAmerPeekListing,
  keiAmerRefreshSession,
  keiAmerSaveAutoImport,
} from '../services/keiAmerService';
import { useKeiAmerExportStore } from '../store/useKeiAmerExportStore';
import NumericKeyboardAccessory, {
  ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID,
} from '../components/NumericKeyboardAccessory';
import KeiSearchFilters from '../components/admin/KeiSearchFilters';

type LastImagePeek = {
  loading: boolean;
  error: string;
  imageUrls: string[];
  suggestedFloorPlanIndex: number | null;
  suggestedFloorPlan: boolean;
  imageCount: number;
};

function useKeiTheme() {
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  return useMemo(
    () => ({
      isDark,
      bg: isDark ? '#000000' : '#F2F2F7',
      card: isDark ? '#1C1C1E' : '#FFFFFF',
      cardSecondary: isDark ? '#2C2C2E' : '#F2F2F7',
      text: isDark ? '#FFFFFF' : '#000000',
      secondary: isDark ? '#8E8E93' : '#6C6C70',
      tertiary: isDark ? '#636366' : '#AEAEB2',
      separator: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)',
      accent: '#34C759',
      accentOrange: '#FF9500',
      accentBlue: '#007AFF',
      accentAmber: '#FF9F0A',
      danger: '#FF453A',
      segmentBg: isDark ? '#2C2C2E' : '#E5E5EA',
      segmentActive: isDark ? '#636366' : '#FFFFFF',
    }),
    [isDark],
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  colors,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ id: T; label: string }>;
  colors: ReturnType<typeof useKeiTheme>;
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: colors.segmentBg }]}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(opt.id);
            }}
            style={[styles.segment, active && { backgroundColor: colors.segmentActive }]}
          >
            <Text style={[styles.segmentText, { color: active ? colors.text : colors.secondary }]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ScheduleBubbleSwitch({
  value,
  onValueChange,
  accent,
  trackOff,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  accent: string;
  trackOff: string;
}) {
  const bubbles = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!value) {
      bubbles.forEach((b) => b.setValue(0));
      return;
    }
    const loops = bubbles.map((bubble, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 280),
          Animated.timing(bubble, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bubble, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [value, bubbles]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 56,
        height: 32,
        borderRadius: 16,
        backgroundColor: value ? accent : trackOff,
        justifyContent: 'center',
        overflow: 'hidden',
        paddingHorizontal: 3,
      }}
    >
      {value
        ? bubbles.map((bubble, index) => (
            <Animated.View
              key={index}
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.78)',
                top: 6 + (index % 3) * 6,
                opacity: bubble.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.9, 0.55, 0] }),
                transform: [
                  {
                    translateX: bubble.interpolate({ inputRange: [0, 1], outputRange: [4, 42] }),
                  },
                  {
                    scale: bubble.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.6, 1.15, 0.7] }),
                  },
                ],
              }}
            />
          ))
        : null}
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: '#fff',
          alignSelf: value ? 'flex-end' : 'flex-start',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      />
    </Pressable>
  );
}

export default function AdminKeiAmerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const colors = useKeiTheme();

  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);
  const [sessionMessage, setSessionMessage] = useState('');

  const [propertyKind, setPropertyKind] = useState<KeiPropertyKind>('apartment');
  const [transactionKind, setTransactionKind] = useState<KeiTransactionKind>('sale');
  const [browseMode, setBrowseMode] = useState<'feed' | 'search'>('feed');
  const [districtId, setDistrictId] = useState('');
  const [priceRangeId, setPriceRangeId] = useState('');
  const [areaRangeId, setAreaRangeId] = useState('');
  const [datePresetId, setDatePresetId] = useState('');
  const [facets, setFacets] = useState<KeiSearchFacetsResponse | null>(null);
  const [facetsLoading, setFacetsLoading] = useState(false);
  const [facetsError, setFacetsError] = useState('');
  const [targetUserId, setTargetUserId] = useState('55');
  const [commission, setCommission] = useState('2');
  const [autoCount, setAutoCount] = useState('1');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState(60);
  const [scheduleCount, setScheduleCount] = useState('3');
  const [scheduleUserId, setScheduleUserId] = useState('55');
  const [scheduleCommission, setScheduleCommission] = useState('2');
  const [scheduleProperty, setScheduleProperty] = useState<KeiPropertyKind>('apartment');
  const [scheduleTransaction, setScheduleTransaction] = useState<KeiTransactionKind>('sale');
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [scheduleLastRun, setScheduleLastRun] = useState<string | null>(null);
  const [scheduleLastError, setScheduleLastError] = useState<string | null>(null);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [listings, setListings] = useState<KeiPreviewListing[]>([]);

  const [selected, setSelected] = useState<Record<string, KeiPreviewListing>>({});
  const [floorPlanSelections, setFloorPlanSelections] = useState<Record<string, KeiFloorPlanSelection>>({});
  const [lastImagePeeks, setLastImagePeeks] = useState<Record<string, LastImagePeek>>({});
  const [importedExpanded, setImportedExpanded] = useState(false);

  const exportRunning = useKeiAmerExportStore((s) => s.running);
  const setExportVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const startKeiExport = useKeiAmerExportStore((s) => s.startExport);
  const cancelKeiExport = useKeiAmerExportStore((s) => s.cancelExport);
  const hydrateExport = useKeiAmerExportStore((s) => s.hydrateFromServer);

  const peekInflight = useRef(new Set<string>());
  const numericInputProps =
    Platform.OS === 'ios' ? { inputAccessoryViewID: ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID } : {};

  const districtOptions = facets?.districts?.length ? facets.districts : KEI_FALLBACK_DISTRICTS;
  const priceOptions = facets?.priceRanges?.length
    ? facets.priceRanges
    : transactionKind === 'rent'
      ? KEI_FALLBACK_RENT_PRICE_RANGES
      : KEI_FALLBACK_SALE_PRICE_RANGES;
  const areaOptions = facets?.areaRanges?.length
    ? facets.areaRanges
    : propertyKind === 'house'
      ? KEI_FALLBACK_HOUSE_AREA_RANGES
      : KEI_FALLBACK_APARTMENT_AREA_RANGES;
  const dateOptions = useMemo(
    () => (facets?.datePresets?.length ? facets.datePresets : keiFallbackDatePresets()),
    [facets],
  );

  const selectedDistrict = useMemo(
    () => districtOptions.find((opt) => opt.id === districtId),
    [districtOptions, districtId],
  );
  const selectedPrice = useMemo(
    () => priceOptions.find((opt) => opt.id === priceRangeId),
    [priceOptions, priceRangeId],
  );
  const selectedArea = useMemo(
    () => areaOptions.find((opt) => opt.id === areaRangeId),
    [areaOptions, areaRangeId],
  );
  const selectedDate = useMemo(
    () => dateOptions.find((opt) => opt.id === datePresetId),
    [dateOptions, datePresetId],
  );

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const availableListings = useMemo(
    () => listings.filter((l) => !l.blockedReason && !l.alreadyImported),
    [listings],
  );
  const importedListings = useMemo(
    () => listings.filter((l) => l.alreadyImported || l.blockedReason === 'imported'),
    [listings],
  );
  const inactiveListings = useMemo(
    () => listings.filter((l) => l.blockedReason === 'inactive'),
    [listings],
  );

  const resolveFloorPlanSelection = useCallback(
    (portalUrl: string): KeiFloorPlanSelection => {
      if (portalUrl in floorPlanSelections) return floorPlanSelections[portalUrl];
      const peek = lastImagePeeks[portalUrl];
      const idx = peek?.suggestedFloorPlanIndex;
      return {
        enabled: idx != null,
        imageIndex: idx ?? 0,
      };
    },
    [floorPlanSelections, lastImagePeeks],
  );

  const loadFacets = useCallback(async () => {
    if (!token || !sessionOk) return;
    setFacetsLoading(true);
    setFacetsError('');
    try {
      const res = await keiAmerFetchFacets(token, { propertyKind, transactionKind });
      setFacets(res);
      setDistrictId((prev) => (res.districts.some((opt) => opt.id === prev) ? prev : ''));
      setPriceRangeId((prev) => (res.priceRanges.some((opt) => opt.id === prev) ? prev : ''));
      setAreaRangeId((prev) => (res.areaRanges.some((opt) => opt.id === prev) ? prev : ''));
      setDatePresetId((prev) => (res.datePresets.some((opt) => opt.id === prev) ? prev : ''));
    } catch (e) {
      setFacets(null);
      setFacetsError(e instanceof Error ? e.message : 'Nie udało się pobrać list z KEI');
    } finally {
      setFacetsLoading(false);
    }
  }, [token, sessionOk, propertyKind, transactionKind]);

  const loadSession = useCallback(async () => {
    if (!token) return;
    setSessionLoading(true);
    try {
      const res = await keiAmerRefreshSession(token, true);
      setSessionOk(res.loggedIn);
      setSessionMessage(res.message);
    } catch (e) {
      setSessionOk(false);
      setSessionMessage(e instanceof Error ? e.message : 'Błąd sesji KEI');
    } finally {
      setSessionLoading(false);
    }
  }, [token]);

  const applyScheduleConfig = useCallback((config: KeiAutoImportConfig) => {
    setScheduleEnabled(config.enabled);
    setScheduleInterval(config.intervalMinutes);
    setScheduleCount(String(config.count));
    setScheduleUserId(String(config.targetUserId));
    setScheduleCommission(String(config.agentCommissionPercent));
    setScheduleProperty(config.propertyKind);
    setScheduleTransaction(config.transactionKind);
    setScheduleLastRun(config.lastRunAt);
    setScheduleLastError(
      config.lastError && /after['’]? was called outside a request scope/i.test(config.lastError)
        ? null
        : config.lastError,
    );
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!token) return;
    try {
      const res = await keiAmerFetchAutoImport(token);
      if (res.config) applyScheduleConfig(res.config);
    } catch {
      /* ignore */
    }
  }, [token, applyScheduleConfig]);

  const saveSchedule = useCallback(
    async (patch?: { enabled?: boolean }) => {
      if (!token) return;
      setScheduleSaving(true);
      setScheduleMessage('');
      try {
        const res = await keiAmerSaveAutoImport(token, {
          enabled: patch?.enabled ?? scheduleEnabled,
          intervalMinutes: scheduleInterval,
          count: Number(scheduleCount),
          targetUserId: Number(scheduleUserId),
          agentCommissionPercent: Number(scheduleCommission),
          propertyKind: scheduleProperty,
          transactionKind: scheduleTransaction,
        });
        applyScheduleConfig(res.config);
        setScheduleMessage(
          res.config.enabled ? 'Harmonogram zapisany — import działa na serwerze.' : 'Harmonogram wyłączony.',
        );
      } catch (e) {
        setScheduleMessage(e instanceof Error ? e.message : 'Nie udało się zapisać harmonogramu.');
      } finally {
        setScheduleSaving(false);
      }
    },
    [
      token,
      scheduleEnabled,
      scheduleInterval,
      scheduleCount,
      scheduleUserId,
      scheduleCommission,
      scheduleProperty,
      scheduleTransaction,
      applyScheduleConfig,
    ],
  );

  const loadPreview = useCallback(
    async (nextPage = 1) => {
      if (!token || !sessionOk) return;
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const res = await keiAmerFetchPreview(token, {
          propertyKind,
          transactionKind,
          page: nextPage,
          pageSize: KEI_PAGE_SIZE,
          mode: browseMode,
          district: browseMode === 'search' ? selectedDistrict?.district : undefined,
          minPrice: browseMode === 'search' ? selectedPrice?.minPrice : undefined,
          maxPrice: browseMode === 'search' ? selectedPrice?.maxPrice : undefined,
          minArea: browseMode === 'search' ? selectedArea?.minArea : undefined,
          maxArea: browseMode === 'search' ? selectedArea?.maxArea : undefined,
          dateFrom: browseMode === 'search' ? selectedDate?.dateFrom : undefined,
          dateTo: browseMode === 'search' ? selectedDate?.dateTo : undefined,
          verify: browseMode === 'search',
        });
        setListings(res.listings || []);
        setPreviewMessage(res.message || '');
        setHasNextPage(res.hasNextPage);
        setPage(res.page);
      } catch (e) {
        setPreviewError(e instanceof Error ? e.message : 'Nie udało się pobrać listy');
      } finally {
        setPreviewLoading(false);
      }
    },
    [
      token,
      sessionOk,
      propertyKind,
      transactionKind,
      browseMode,
      selectedDistrict,
      selectedPrice,
      selectedArea,
      selectedDate,
    ],
  );

  const peekLastImage = useCallback(
    async (portalUrl: string) => {
      if (!token || !portalUrl || peekInflight.current.has(portalUrl)) return;
      peekInflight.current.add(portalUrl);
      setLastImagePeeks((prev) => ({
        ...prev,
        [portalUrl]: { loading: true, error: '', imageUrls: [], suggestedFloorPlanIndex: null, suggestedFloorPlan: false, imageCount: 0 },
      }));
      try {
        const res = await keiAmerPeekListing(token, portalUrl);
        const suggestedIdx =
          res.suggestedFloorPlanIndex ??
          (res.suggestedFloorPlan && res.imageUrls?.length ? res.imageUrls.length - 1 : null);
        setLastImagePeeks((prev) => ({
          ...prev,
          [portalUrl]: {
            loading: false,
            error: '',
            imageUrls: res.imageUrls || [],
            suggestedFloorPlanIndex: suggestedIdx,
            suggestedFloorPlan: suggestedIdx != null,
            imageCount: res.imageCount,
          },
        }));
        if (suggestedIdx != null && !(portalUrl in floorPlanSelections)) {
          setFloorPlanSelections((prev) => ({
            ...prev,
            [portalUrl]: { enabled: true, imageIndex: suggestedIdx },
          }));
        }
      } catch (e) {
        setLastImagePeeks((prev) => ({
          ...prev,
          [portalUrl]: {
            loading: false,
            error: e instanceof Error ? e.message : 'Błąd podglądu',
            imageUrls: [],
            suggestedFloorPlanIndex: null,
            suggestedFloorPlan: false,
            imageCount: 0,
          },
        }));
      } finally {
        peekInflight.current.delete(portalUrl);
      }
    },
    [token, floorPlanSelections],
  );

  const toggleSelection = useCallback(
    (item: KeiPreviewListing) => {
      if (item.alreadyImported || item.blockedReason) {
        Alert.alert(
          'Niedostępne do importu',
          item.portalCheckReason ||
            (item.blockedReason === 'inactive'
              ? 'Ogłoszenie nieaktualne na portalu źródłowym.'
              : item.blockedReason === 'outreach'
                ? 'Wysłano już zaproszenie właściciela.'
                : 'Oferta jest już w bazie.'),
        );
        return;
      }
      void Haptics.selectionAsync();
      setSelected((prev) => {
        const next = { ...prev };
        if (next[item.portalUrl]) {
          delete next[item.portalUrl];
        } else {
          if (Object.keys(next).length >= KEI_MAX_SELECT) {
            Alert.alert('Limit wyboru', `Możesz wybrać maksymalnie ${KEI_MAX_SELECT} ogłoszeń.`);
            return prev;
          }
          next[item.portalUrl] = item;
          void peekLastImage(item.portalUrl);
        }
        return next;
      });
    },
    [peekLastImage],
  );

  const autoSelectByCount = useCallback(async () => {
    if (!token) return;
    const count = Math.max(1, Math.min(KEI_MAX_SELECT, Number(autoCount) || 1));
    setPreviewLoading(true);
    try {
      const res = await keiAmerFetchPreview(token, {
        propertyKind,
        transactionKind,
        page: 1,
        pageSize: 25,
        selectionPool: true,
      });
      const picks = (res.listings || []).filter((l) => !l.alreadyImported).slice(0, count);
      const map: Record<string, KeiPreviewListing> = {};
      for (const row of picks) map[row.portalUrl] = row;
      setSelected(map);
      setAutoCount(String(picks.length));
      for (const row of picks) void peekLastImage(row.portalUrl);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Auto-wybór', e instanceof Error ? e.message : 'Nie udało się');
    } finally {
      setPreviewLoading(false);
    }
  }, [token, propertyKind, transactionKind, autoCount, peekLastImage]);

  const handleExport = useCallback(() => {
    if (!token || selectedList.length === 0 || exportRunning) return;
    const userId = Number(targetUserId);
    const comm = Number(commission);
    if (!Number.isFinite(userId) || userId <= 0) {
      Alert.alert('Konfiguracja', 'Podaj poprawne ID użytkownika docelowego.');
      return;
    }

    const alreadyInDb = selectedList.filter((row) => row.alreadyImported || row.blockedReason);
    if (alreadyInDb.length > 0) {
      Alert.alert(
        'Niedostępne w wyborze',
        `${alreadyInDb.length} ogłoszeń jest zablokowanych (duplikat / outreach / nieaktualne). Odznacz je przed importem.`,
      );
      return;
    }

    const floorPlanPayload: Record<string, KeiFloorPlanSelection> = {};
    for (const row of selectedList) {
      floorPlanPayload[row.portalUrl] = resolveFloorPlanSelection(row.portalUrl);
    }

    const initialItems = selectedList.map((row, index) => ({
      index,
      keiListingId: row.keiId,
      portalUrl: row.portalUrl,
      address: row.address,
      status: index === 0 ? ('active' as const) : ('pending' as const),
      completedSteps: [],
      currentStep: index === 0 ? ('check_duplicate' as const) : null,
      stepLabel: index === 0 ? 'Sprawdzanie duplikatu…' : 'Oczekuje w kolejce…',
    }));

    startKeiExport(
      token,
      {
        targetUserId: userId,
        agentCommissionPercent: Number.isFinite(comm) ? comm : 2,
        propertyKind,
        transactionKind,
        selections: selectedList.map((row) => ({
          keiId: row.keiId,
          portalUrl: row.portalUrl,
          address: row.address,
        })),
        floorPlanSelections: floorPlanPayload,
      },
      initialItems,
      () => {
        setSelected({});
        void loadPreview(page);
      },
    );
  }, [
    token,
    selectedList,
    exportRunning,
    targetUserId,
    commission,
    propertyKind,
    transactionKind,
    resolveFloorPlanSelection,
    startKeiExport,
    loadPreview,
    page,
  ]);

  useEffect(() => {
    void loadSession();
    void loadSchedule();
  }, [loadSession, loadSchedule]);

  useEffect(() => {
    if (sessionOk) void loadFacets();
  }, [sessionOk, loadFacets]);

  useEffect(() => {
    if (token) void hydrateExport(token);
  }, [token, hydrateExport]);

  useEffect(() => {
    if (sessionOk && !exportRunning && browseMode === 'feed') {
      setSelected({});
      setPage(1);
      void loadPreview(1);
    }
  }, [sessionOk, propertyKind, transactionKind, exportRunning, browseMode, loadPreview]);

  const handleStopExport = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    cancelKeiExport();
  }, [cancelKeiExport]);

  const handleOpenExportModal = useCallback(() => {
    void Haptics.selectionAsync();
    setExportVisible(true);
  }, [setExportVisible]);

  // Wyjście z ekranu nie przerywa importu — tylko minimalizuje modal (pill zostaje globalnie).
  useEffect(() => {
    return () => {
      const state = useKeiAmerExportStore.getState();
      if (state.running) state.setModalVisible(false);
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={[styles.navBar, { paddingTop: insets.top + 8, borderBottomColor: colors.separator }]}>
        <Pressable
          onPress={() => {
            void Haptics.selectionAsync();
            navigation.goBack();
          }}
          style={styles.navBack}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={28} color={colors.accentBlue} />
          <Text style={[styles.navBackText, { color: colors.accentBlue }]}>Profil</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: colors.text }]}>Amer KEI</Text>
        <Pressable onPress={() => void Promise.all([loadSession(), loadFacets()])} style={styles.navAction} hitSlop={12}>
          {sessionLoading ? (
            <ActivityIndicator size="small" color={colors.accentBlue} />
          ) : (
            <Ionicons name="refresh" size={22} color={colors.accentBlue} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        refreshControl={
          <RefreshControl
            refreshing={previewLoading}
            onRefresh={() => {
              void loadSession().then(() => Promise.all([loadFacets(), loadPreview(page)]));
            }}
            tintColor={colors.accentBlue}
          />
        }
      >
        <View style={[styles.sessionBanner, { backgroundColor: sessionOk ? 'rgba(52,199,89,0.12)' : 'rgba(255,69,58,0.12)' }]}>
          <Ionicons
            name={sessionOk ? 'checkmark-circle' : 'alert-circle'}
            size={22}
            color={sessionOk ? colors.accent : colors.danger}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.sessionTitle, { color: colors.text }]}>
              {sessionOk ? 'Połączono z amer.kei.pl' : 'Brak sesji KEI'}
            </Text>
            <Text style={[styles.sessionSubtitle, { color: colors.secondary }]} numberOfLines={3}>
              {sessionMessage || (sessionLoading ? 'Logowanie…' : '—')}
            </Text>
          </View>
        </View>

        <View style={styles.sectionPad}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>TRYB LISTY</Text>
          <SegmentedControl
            value={browseMode}
            onChange={(mode) => {
              setBrowseMode(mode);
              setSelected({});
              setListings([]);
              setPreviewMessage('');
            }}
            options={[
              { id: 'feed', label: 'Aktualne' },
              { id: 'search', label: 'Wyszukiwanie' },
            ]}
            colors={colors}
          />
        </View>

        <View style={styles.sectionPad}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>TRANSAKCJA</Text>
          <SegmentedControl
            value={transactionKind}
            onChange={setTransactionKind}
            options={[
              { id: 'sale', label: 'Kupno' },
              { id: 'rent', label: 'Wynajem' },
            ]}
            colors={colors}
          />
        </View>

        <View style={styles.sectionPad}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>TYP NIERUCHOMOŚCI</Text>
          <SegmentedControl
            value={propertyKind}
            onChange={setPropertyKind}
            options={[
              { id: 'apartment', label: 'Mieszkania' },
              { id: 'house', label: 'Domy' },
            ]}
            colors={colors}
          />
        </View>

        {browseMode === 'search' ? (
          <View style={styles.sectionPad}>
            <Text style={[styles.sectionLabel, { color: colors.secondary }]}>
              FILTRY WYSZUKIWANIA (także starsze oferty)
            </Text>
            <KeiSearchFilters
              colors={colors}
              loading={facetsLoading}
              error={facetsError}
              facets={facets}
              districtId={districtId}
              priceRangeId={priceRangeId}
              areaRangeId={areaRangeId}
              datePresetId={datePresetId}
              onSelectDistrict={setDistrictId}
              onSelectPrice={setPriceRangeId}
              onSelectArea={setAreaRangeId}
              onSelectDate={setDatePresetId}
              searchLoading={previewLoading}
              propertyKind={propertyKind}
              transactionKind={transactionKind}
              onSearch={() => {
                Keyboard.dismiss();
                setSelected({});
                void loadPreview(1);
              }}
            />
          </View>
        ) : null}

        <View style={styles.sectionPad}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>KONFIGURACJA EKSPORTU</Text>
          <View style={[styles.configCard, { backgroundColor: colors.card }]}>
            <View style={styles.configRow}>
              <Text style={[styles.configLabel, { color: colors.secondary }]}>ID użytkownika</Text>
              <TextInput
                value={targetUserId}
                onChangeText={setTargetUserId}
                keyboardType="number-pad"
                {...numericInputProps}
                style={[styles.configInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
              />
            </View>
            <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
            <View style={styles.configRow}>
              <Text style={[styles.configLabel, { color: colors.secondary }]}>Prowizja %</Text>
              <TextInput
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
                {...numericInputProps}
                style={[styles.configInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.sectionPad}>
          <View style={[styles.autoImportShell, { borderColor: scheduleEnabled ? 'rgba(52,199,89,0.55)' : colors.separator, backgroundColor: colors.isDark ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.06)' }]}>
            <View style={styles.autoImportHead}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setScheduleExpanded((v) => !v);
                }}
                style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sectionLabel, { color: colors.secondary, marginBottom: 4 }]}>
                    AUTOMATYCZNY IMPORT
                  </Text>
                  <Text style={[styles.autoImportLead, { color: colors.text }]} numberOfLines={2}>
                    {scheduleEnabled
                      ? 'Załączony — serwer importuje sam, niezależnie od przycisku Importuj.'
                      : 'Wyłączony — tylko ręczny import z listy poniżej.'}
                  </Text>
                </View>
                <Ionicons
                  name={scheduleExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.secondary}
                  style={{ marginRight: 8 }}
                />
              </Pressable>
              <ScheduleBubbleSwitch
                value={scheduleEnabled}
                onValueChange={(enabled) => {
                  void Haptics.selectionAsync();
                  setScheduleEnabled(enabled);
                  void saveSchedule({ enabled });
                }}
                accent={colors.accent}
                trackOff={colors.segmentBg}
              />
            </View>

            {scheduleExpanded ? (
              <View style={[styles.configCard, { backgroundColor: colors.card, marginTop: 10 }]}>
                <Text style={[styles.hint, { color: colors.tertiary, paddingHorizontal: 14, marginTop: 10, marginBottom: 8 }]}>
                  Osobny kanał od ręcznego „Importuj”. Jeśli jeden już trwa, drugi czeka. Aplikację możesz zamknąć.
                </Text>
                <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
                  <Text style={[styles.configLabel, { color: colors.secondary, width: 'auto' }]}>Interwał</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {KEI_AUTO_INTERVALS_MIN.map((min) => {
                      const active = scheduleInterval === min;
                      return (
                        <Pressable
                          key={min}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setScheduleInterval(min);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 10,
                            backgroundColor: active ? colors.accent : colors.cardSecondary,
                          }}
                        >
                          <Text style={{ color: active ? '#000' : colors.text, fontWeight: '700', fontSize: 13 }}>
                            {keiAutoIntervalLabel(min)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
                <View style={styles.configRow}>
                  <Text style={[styles.configLabel, { color: colors.secondary }]}>Ilość</Text>
                  <TextInput
                    value={scheduleCount}
                    onChangeText={setScheduleCount}
                    keyboardType="number-pad"
                    {...numericInputProps}
                    style={[styles.configInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
                  />
                </View>
                <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
                <View style={styles.configRow}>
                  <Text style={[styles.configLabel, { color: colors.secondary }]}>ID użytkownika</Text>
                  <TextInput
                    value={scheduleUserId}
                    onChangeText={setScheduleUserId}
                    keyboardType="number-pad"
                    {...numericInputProps}
                    style={[styles.configInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
                  />
                </View>
                <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
                <View style={styles.configRow}>
                  <Text style={[styles.configLabel, { color: colors.secondary }]}>Prowizja %</Text>
                  <TextInput
                    value={scheduleCommission}
                    onChangeText={setScheduleCommission}
                    keyboardType="decimal-pad"
                    {...numericInputProps}
                    style={[styles.configInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
                  />
                </View>
                <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
                <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={[styles.configLabel, { color: colors.secondary, width: 'auto', marginBottom: 8 }]}>
                    Nieruchomość
                  </Text>
                  <SegmentedControl
                    value={scheduleProperty}
                    onChange={setScheduleProperty}
                    options={[
                      { id: 'apartment', label: 'Mieszkanie' },
                      { id: 'house', label: 'Dom' },
                    ]}
                    colors={colors}
                  />
                </View>
                <View style={[styles.configDivider, { backgroundColor: colors.separator }]} />
                <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                  <Text style={[styles.configLabel, { color: colors.secondary, width: 'auto', marginBottom: 8 }]}>
                    Transakcja
                  </Text>
                  <SegmentedControl
                    value={scheduleTransaction}
                    onChange={setScheduleTransaction}
                    options={[
                      { id: 'sale', label: 'Sprzedaż' },
                      { id: 'rent', label: 'Najem' },
                    ]}
                    colors={colors}
                  />
                </View>
                <View style={{ padding: 14, paddingTop: 4 }}>
                  <Pressable
                    onPress={() => void saveSchedule()}
                    disabled={scheduleSaving}
                    style={[styles.autoBtn, { backgroundColor: colors.accent }]}
                  >
                    {scheduleSaving ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={[styles.autoBtnText, { color: '#000' }]}>Zapisz harmonogram</Text>
                    )}
                  </Pressable>
                  {scheduleLastRun ? (
                    <Text style={[styles.hint, { color: colors.tertiary }]}>
                      Ostatni start: {new Date(scheduleLastRun).toLocaleString('pl-PL')}
                    </Text>
                  ) : null}
                  {scheduleLastError ? (
                    <Text style={[styles.hint, { color: colors.accentAmber }]}>{scheduleLastError}</Text>
                  ) : null}
                  {scheduleMessage ? (
                    <Text style={[styles.hint, { color: colors.accent }]}>{scheduleMessage}</Text>
                  ) : null}
                  <Text style={[styles.hint, { color: colors.tertiary }]}>Max {KEI_AUTO_MAX_COUNT} ogłoszeń na cykl.</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionPad}>
          <Text style={[styles.sectionLabel, { color: colors.secondary }]}>SZYBKI WYBÓR</Text>
          <View style={[styles.autoRow, { backgroundColor: colors.card }]}>
            <TextInput
              value={autoCount}
              onChangeText={setAutoCount}
              keyboardType="number-pad"
              {...numericInputProps}
              style={[styles.autoInput, { color: colors.text, backgroundColor: colors.cardSecondary }]}
            />
            <Pressable
              onPress={() => void autoSelectByCount()}
              style={[styles.autoBtn, { backgroundColor: colors.accentBlue }]}
            >
              <Text style={styles.autoBtnText}>Wybierz najnowsze</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: colors.tertiary }]}>
            Import działa na serwerze EstateOS — możesz zamknąć aplikację; postęp wczyta się na każdym urządzeniu.
            Wybierz do {KEI_MAX_SELECT} ogłoszeń z Warszawy (OtoDom, OLX, Nieruchomości-Online).
          </Text>
        </View>

        {previewError ? (
          <View style={styles.sectionPad}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{previewError}</Text>
          </View>
        ) : null}

        {previewMessage ? (
          <Text style={[styles.previewMessage, { color: colors.secondary }]}>{previewMessage}</Text>
        ) : null}

        {importedListings.length > 0 ? (
          <View style={styles.sectionPad}>
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setImportedExpanded((v) => !v);
              }}
              style={[styles.importedHeader, { backgroundColor: 'rgba(255,159,10,0.12)' }]}
            >
              <Ionicons name={importedExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.accentAmber} />
              <Text style={[styles.importedTitle, { color: colors.text }]}>
                Już w bazie ({importedListings.length})
              </Text>
            </Pressable>
            {importedExpanded
              ? importedListings.map((item) => (
                  <View key={item.portalUrl} style={[styles.listingRow, { backgroundColor: colors.card, opacity: 0.72 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listingMeta, { color: colors.tertiary }]}>
                        {item.date} · {item.transactionLabel} · {item.sourceLabel}
                      </Text>
                      <Text style={[styles.listingAddress, { color: colors.secondary }]} numberOfLines={2}>
                        {item.address}
                      </Text>
                      {item.existingOfferId ? (
                        <Text style={[styles.importedBadge, { color: colors.accentAmber }]}>Oferta #{item.existingOfferId}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              : null}
          </View>
        ) : null}

        <View style={styles.sectionPad}>
          <View style={styles.listHeader}>
            <Text style={[styles.sectionLabel, { color: colors.secondary, marginBottom: 0 }]}>
              DOSTĘPNE ({availableListings.length})
            </Text>
            <Pressable onPress={() => void loadPreview(page)}>
              <Ionicons name="reload" size={18} color={colors.accentBlue} />
            </Pressable>
          </View>

          {availableListings.map((item) => {
            const isSelected = Boolean(selected[item.portalUrl]);
            const peek = lastImagePeeks[item.portalUrl];
            const floorPlanSel = resolveFloorPlanSelection(item.portalUrl);
            const asFloorPlan = floorPlanSel.enabled;
            return (
              <View key={item.portalUrl}>
              <Pressable
                onPress={() => toggleSelection(item)}
                style={[
                  styles.listingRow,
                  {
                    backgroundColor: isSelected ? 'rgba(52,199,89,0.08)' : colors.card,
                    borderColor: isSelected ? colors.accent : colors.separator,
                    borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                    marginBottom: isSelected ? 0 : 10,
                    borderBottomLeftRadius: isSelected ? 0 : 16,
                    borderBottomRightRadius: isSelected ? 0 : 16,
                  },
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                      borderColor: isSelected ? colors.accent : colors.tertiary,
                    },
                  ]}
                >
                  {isSelected ? <Ionicons name="checkmark" size={14} color="#000" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listingMeta, { color: colors.tertiary }]}>
                    {item.date} · {item.transactionLabel} · {item.sourceLabel}
                    {asFloorPlan ? ' · RZUT' : ''}
                  </Text>
                  <Text style={[styles.listingAddress, { color: colors.text }]} numberOfLines={2}>
                    {item.address || 'Brak adresu'}
                  </Text>
                  <Text style={[styles.listingPrice, { color: colors.secondary }]}>
                    {item.price || '—'} · {item.area ? `${item.area} m²` : '—'}
                    {item.portalActive === true ? ' · portal OK' : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void Linking.openURL(item.portalUrl)}
                  hitSlop={10}
                  style={styles.externalBtn}
                >
                  <Ionicons name="open-outline" size={18} color={colors.accentBlue} />
                </Pressable>
              </Pressable>

              {isSelected ? (
                <View
                  style={[
                    styles.floorPlanCard,
                    {
                      backgroundColor: colors.cardSecondary,
                      marginTop: 0,
                      marginBottom: 10,
                      borderWidth: 1.5,
                      borderTopWidth: 0,
                      borderColor: colors.accent,
                      borderBottomLeftRadius: 16,
                      borderBottomRightRadius: 16,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.floorPlanTitle, { color: colors.text }]}>Które zdjęcie to rzut?</Text>
                    <Text style={[styles.floorPlanHint, { color: colors.secondary }]}>
                      {peek?.loading
                        ? 'Ładowanie zdjęć z portalu…'
                        : peek?.error
                          ? peek.error
                          : peek?.imageCount
                            ? `${peek.imageCount} zdj. · dotknij miniaturę z planem (żółte = sugerowane)`
                            : 'Brak podglądu zdjęć'}
                    </Text>

                    {!peek || peek.loading ? (
                      <View style={[styles.peekPlaceholder, { width: '100%', height: 72, marginTop: 10 }]}>
                        <ActivityIndicator color={colors.accentBlue} />
                      </View>
                    ) : (peek.imageUrls?.length ?? 0) > 0 && token ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.floorPlanStrip}
                      >
                        {peek.imageUrls.map((_, imageIndex) => {
                          const picked = floorPlanSel.enabled && floorPlanSel.imageIndex === imageIndex;
                          const suggested = peek.suggestedFloorPlanIndex === imageIndex;
                          return (
                            <Pressable
                              key={`${item.portalUrl}-${imageIndex}`}
                              onPress={() => {
                                void Haptics.selectionAsync();
                                setFloorPlanSelections((prev) => ({
                                  ...prev,
                                  [item.portalUrl]: { enabled: true, imageIndex },
                                }));
                              }}
                              style={[
                                styles.floorPlanThumbWrap,
                                picked && styles.floorPlanThumbPicked,
                                suggested && !picked && styles.floorPlanThumbSuggested,
                              ]}
                            >
                              <Image
                                source={{
                                  uri: keiAmerPeekImageUrl(item.portalUrl, imageIndex),
                                  headers: { Authorization: `Bearer ${token}` },
                                }}
                                style={styles.floorPlanThumb}
                                contentFit="cover"
                              />
                              <Text style={styles.floorPlanThumbLabel}>{imageIndex + 1}</Text>
                              {suggested ? (
                                <View style={styles.floorPlanSuggestedBadge}>
                                  <Text style={styles.floorPlanSuggestedText}>?</Text>
                                </View>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <View style={[styles.peekPlaceholder, { width: '100%', height: 72, marginTop: 10 }]}>
                        <Ionicons name="image-outline" size={28} color={colors.tertiary} />
                      </View>
                    )}

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>Zapisz jako rzut (plan)</Text>
                        {asFloorPlan ? (
                          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                            Zdjęcie #{floorPlanSel.imageIndex + 1} → sekcja planu
                          </Text>
                        ) : (
                          <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                            Tylko galeria — bez planu
                          </Text>
                        )}
                      </View>
                      <Switch
                        value={asFloorPlan}
                        onValueChange={(enabled) => {
                          void Haptics.selectionAsync();
                          setFloorPlanSelections((prev) => ({
                            ...prev,
                            [item.portalUrl]: {
                              enabled,
                              imageIndex: floorPlanSel.imageIndex,
                            },
                          }));
                        }}
                        trackColor={{ false: colors.segmentBg, true: colors.accent }}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
              </View>
            );
          })}

          <View style={styles.pager}>
            {Array.from({ length: page + (hasNextPage ? 1 : 0) }, (_, i) => i + 1).map((p) => (
              <Pressable
                key={p}
                onPress={() => void loadPreview(p)}
                style={[
                  styles.pageBtn,
                  {
                    backgroundColor: p === page ? colors.accent : colors.cardSecondary,
                  },
                ]}
              >
                <Text style={{ color: p === page ? '#000' : colors.text, fontWeight: '700' }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, borderTopColor: colors.separator }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
        )}
        {exportRunning ? (
          <View style={styles.exportDockRow}>
            <Pressable
              onPress={handleOpenExportModal}
              style={[styles.exportBtn, styles.exportBtnDock, { backgroundColor: colors.accent, flex: 1 }]}
            >
              <Ionicons name="expand-outline" size={18} color="#000" />
              <Text style={[styles.exportBtnText, { flex: 1 }]} numberOfLines={1}>
                Pokaż postęp importu
              </Text>
            </Pressable>
            <Pressable
              onPress={handleStopExport}
              style={[styles.exportStopBtn, { backgroundColor: colors.cardSecondary }]}
              accessibilityLabel="Zatrzymaj import"
              hitSlop={8}
            >
              <Ionicons name="stop-circle" size={32} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={selectedList.length === 0 || !sessionOk}
            onPress={() => void handleExport()}
            style={[
              styles.exportBtn,
              {
                backgroundColor: selectedList.length > 0 && sessionOk ? colors.accent : colors.cardSecondary,
                opacity: selectedList.length === 0 ? 0.5 : 1,
              },
            ]}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#000" />
            <Text style={styles.exportBtnText}>Importuj ({selectedList.length})</Text>
          </Pressable>
        )}
      </View>
      <NumericKeyboardAccessory isDark={colors.isDark} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: { flexDirection: 'row', alignItems: 'center', minWidth: 88 },
  navBackText: { fontSize: 17, marginLeft: -4 },
  navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  navAction: { minWidth: 44, alignItems: 'flex-end' },
  sessionBanner: {
    margin: 16,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  sessionTitle: { fontSize: 16, fontWeight: '700' },
  sessionSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  sectionPad: { paddingHorizontal: 16, marginBottom: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segment: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '600' },
  configCard: { borderRadius: 16, overflow: 'hidden' },
  configRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  configLabel: { width: 110, fontSize: 14 },
  configInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 16, fontWeight: '600' },
  configDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },
  autoRow: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, alignItems: 'center' },
  autoInput: { width: 56, borderRadius: 10, paddingVertical: 10, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  autoBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  autoBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { fontSize: 12, marginTop: 8, lineHeight: 17 },
  errorText: { fontSize: 14, fontWeight: '600' },
  previewMessage: { paddingHorizontal: 16, marginBottom: 8, fontSize: 13 },
  importedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, marginBottom: 8 },
  importedTitle: { fontSize: 15, fontWeight: '700' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingMeta: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  listingAddress: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  listingPrice: { fontSize: 13, marginTop: 4 },
  importedBadge: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  externalBtn: { padding: 6 },
  floorPlanCard: { padding: 12, borderRadius: 14, marginBottom: 10, marginTop: -4 },
  floorPlanStrip: { gap: 8, paddingVertical: 10 },
  floorPlanThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  floorPlanThumbPicked: { borderColor: '#FF9500', borderWidth: 3 },
  floorPlanThumbSuggested: { borderColor: 'rgba(255,149,0,0.45)' },
  floorPlanThumb: { width: '100%', height: '100%' },
  floorPlanThumbLabel: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
  },
  floorPlanSuggestedBadge: {
    position: 'absolute',
    top: 2,
    left: 4,
    backgroundColor: '#FF9500',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  floorPlanSuggestedText: { color: '#000', fontSize: 9, fontWeight: '900' },
  peekImage: { width: 72, height: 72, borderRadius: 12 },
  peekImageFloorPlan: { borderWidth: 2, borderColor: '#FF9500' },
  peekPlaceholder: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  floorPlanTitle: { fontSize: 14, fontWeight: '700' },
  floorPlanHint: { fontSize: 12, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pager: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 },
  pageBtn: { minWidth: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    overflow: 'hidden',
  },
  autoImportShell: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 12,
  },
  autoImportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoImportLead: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  exportDockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportBtnDock: { paddingHorizontal: 14, justifyContent: 'flex-start' },
  exportStopBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  exportSummary: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  progressTrack: { height: 8, borderRadius: 99, backgroundColor: 'rgba(120,120,128,0.2)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  percentLabel: { fontSize: 28, fontWeight: '800', marginVertical: 12 },
  progressCard: { borderRadius: 16, padding: 14, marginBottom: 12 },
  progressCardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  progressAddress: { flex: 1, fontSize: 15, fontWeight: '700' },
  stepsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  stepPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  resultLinks: { flexDirection: 'row', gap: 16, marginTop: 10 },
  aiPanel: { marginTop: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  aiPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiPanelTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  aiPanelHint: { fontSize: 12, lineHeight: 17 },
  aiDiffLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 6 },
  aiDiffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  aiDiffCol: { flex: 1, borderRadius: 10, padding: 8 },
  aiDiffTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  aiDiffText: { fontSize: 12, lineHeight: 17 },
  resultBox: { borderRadius: 14, padding: 14, marginTop: 8 },
});
