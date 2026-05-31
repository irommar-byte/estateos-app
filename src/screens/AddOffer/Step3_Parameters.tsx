import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, KeyboardAvoidingView, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import AddOfferWheelPickerColumn from './AddOfferWheelPickerColumn';
import type { AddOfferOption } from './AddOfferOptionField';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../../utils/landRegistry';
import { isPolandLocationDraft } from '../../constants/locationEcosystem';
import { useI18n } from '../../i18n';
import { parseDraftDimension } from './validation';
import { buildYearBuiltPickerValues } from '../../lib/offerYearBuilt';

const Colors = { primary: '#10b981' };
const HEATING_OPTIONS = [
  { key: '', labelKey: 'addOffer.step3.heating.none' },
  { key: 'Miejskie', labelKey: 'addOffer.step3.heating.district' },
  { key: 'Gazowe', labelKey: 'addOffer.step3.heating.gas' },
  { key: 'Elektryczne', labelKey: 'addOffer.step3.heating.electric' },
  { key: 'Pompa Ciepła', labelKey: 'addOffer.step3.heating.heatPump' },
  { key: 'Węglowe/Pellet', labelKey: 'addOffer.step3.heating.coalPellet' },
  { key: 'Inne', labelKey: 'addOffer.step3.heating.other' },
] as const;

const ROOMS = ['', ...Array.from({ length: 10 }, (_, i) => (i + 1).toString())];
const FLOORS = ['', 'Parter', ...Array.from({ length: 30 }, (_, i) => (i + 1).toString())];
const YEARS = buildYearBuiltPickerValues();

const buildSqmPickerValues = (ranges: { start: number; end: number; step: number }[]) => {
  const numeric = new Set<number>();
  ranges.forEach(({ start, end, step }) => {
    for (let i = start; i <= end; i += step) numeric.add(i);
  });
  return ['', ...Array.from(numeric).sort((a, b) => a - b).map(String)];
};

/** Mieszkanie / lokal — typowe metraże. */
const UNIT_AREA_SQM = buildSqmPickerValues([
  { start: 15, end: 80, step: 1 },
  { start: 82, end: 120, step: 2 },
  { start: 125, end: 200, step: 5 },
  { start: 210, end: 400, step: 10 },
]);

/** Dom — większe powierzchnie użytkowe. */
const HOUSE_LIVING_AREA_SQM = buildSqmPickerValues([
  { start: 30, end: 150, step: 1 },
  { start: 155, end: 250, step: 5 },
  { start: 260, end: 600, step: 10 },
]);

/** Działka / działka przy domu — krok 10 m². */
const PLOT_AREA_SQM = buildSqmPickerValues([
  { start: 100, end: 2000, step: 10 },
  { start: 2100, end: 10000, step: 100 },
  { start: 11000, end: 50000, step: 500 },
]);

const withCurrentSqmValue = (values: readonly string[], current: string): string[] => {
  const cur = String(current ?? '').trim();
  if (!cur || values.includes(cur)) return [...values];
  if (parseDraftDimension(cur) <= 0) return [...values];
  return [...values, cur].sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return Number(a) - Number(b);
  });
};

const sqmPickerOptions = (
  values: readonly string[],
  current: string,
  t: (key: string) => string,
): AddOfferOption[] =>
  withCurrentSqmValue(values, current).map((v) => ({
    value: v,
    label: v === '' ? t('addOffer.common.pickerEmpty') : `${v} m²`,
  }));

type TogglePillProps = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  field: string;
  active: boolean;
  onToggle: (field: string) => void;
  cardBg: string;
  cardBorder: string;
  shadowOpacity: number;
  textColor: string;
};

function TogglePill({
  label,
  icon,
  field,
  active,
  onToggle,
  cardBg,
  cardBorder,
  shadowOpacity,
  textColor,
}: TogglePillProps) {
  return (
    <AppleHover
      onPress={() => onToggle(field)}
      style={[
        styles.pill,
        {
          backgroundColor: active ? Colors.primary : cardBg,
          borderColor: active ? Colors.primary : cardBorder,
          shadowColor: active ? Colors.primary : '#000',
          shadowOpacity: active ? 0.3 : shadowOpacity,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: active ? 4 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={18} color={active ? '#fff' : textColor} style={{ marginRight: 6 }} />
        <Text style={[styles.pillText, { color: active ? '#fff' : textColor }]}>{label}</Text>
      </View>
    </AppleHover>
  );
}

export default function Step3_Parameters({ theme }: { theme: any }) {
  const { t } = useI18n();
  const { draft, updateDraft, setCurrentStep } = useOfferStore();
  const navigation = useNavigation<any>();
  useFocusEffect(useCallback(() => { setCurrentStep(3); }, [setCurrentStep]));

  const isDark = theme.glass === 'dark';
  const cardBg = isDark ? '#1a1a1c' : '#ffffff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const shadowOpacity = isDark ? 0 : 0.06;

  const scrollRef = useRef<ScrollView>(null);
  const detailsYRef = useRef<number>(0);
  const amenitiesYRef = useRef<number>(0);
  const wasDetailsUnlockedRef = useRef<boolean>(false);
  const wasAmenitiesUnlockedRef = useRef<boolean>(false);
  const isPlot = draft.propertyType === 'PLOT';
  const isHouse = draft.propertyType === 'HOUSE';
  const needsFloor = !isHouse && !isPlot;

  const areaValue = String(draft.area ?? '');
  const plotAreaValue = String(draft.plotArea ?? '');
  const areaNum = parseDraftDimension(areaValue);
  const plotAreaNum = parseDraftDimension(plotAreaValue);
  const isAreaFilled = areaNum > 0;
  const isPlotAreaFilled = plotAreaNum > 0;
  const isHouseParamsComplete = isAreaFilled && isPlotAreaFilled;
  const isPrimaryParamsComplete = isPlot ? isAreaFilled : isHouse ? isHouseParamsComplete : isAreaFilled;

  const isRoomsUnlocked = !isPlot && isPrimaryParamsComplete;
  const isFloorUnlocked = needsFloor && isRoomsUnlocked && !!draft.rooms;
  const isYearUnlocked = isPlot
    ? false
    : isHouse
      ? isRoomsUnlocked && !!draft.rooms
      : isFloorUnlocked && !!String(draft.floor ?? '').trim();

  const isAmenitiesUnlocked =
    !isPlot && isYearUnlocked && !!(draft.yearBuilt || draft.buildYear);
  const showLandRegistryVerification = isPolandLocationDraft(draft);
  const landRegistryRaw = String(draft.landRegistryNumber || '').trim();
  const isLandRegistryValid = isValidLandRegistryNumber(landRegistryRaw);
  const landRegistrySuggestions = getLandRegistryPrefixSuggestions(landRegistryRaw);
  const selectedCourt = getCourtByLandRegistryPrefix(landRegistryRaw);

  const detailsAnim = useRef(new Animated.Value(isPrimaryParamsComplete ? 1 : 0)).current;
  const amenitiesAnim = useRef(new Animated.Value(isAmenitiesUnlocked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(detailsAnim, { toValue: isPrimaryParamsComplete ? 1 : 0, duration: 400, useNativeDriver: false }).start();
  }, [detailsAnim, isPrimaryParamsComplete]);

  useEffect(() => {
    Animated.timing(amenitiesAnim, {
      toValue: isAmenitiesUnlocked ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [amenitiesAnim, isAmenitiesUnlocked]);

  const roomOptions = useMemo<AddOfferOption[]>(
    () =>
      ROOMS.map((r) => ({
        value: r,
        label: r === '' ? t('addOffer.common.pickerEmpty') : r,
      })),
    [t],
  );

  const floorOptions = useMemo<AddOfferOption[]>(
    () =>
      FLOORS.map((f) => ({
        value: f,
        label:
          f === ''
            ? t('addOffer.common.pickerEmpty')
            : f.toLowerCase() === 'parter'
              ? t('addOffer.common.groundFloor')
              : f,
      })),
    [t],
  );

  const yearOptions = useMemo<AddOfferOption[]>(
    () =>
      YEARS.map((y) => ({
        value: y,
        label: y === '' ? t('addOffer.common.pickerEmpty') : y,
      })),
    [t],
  );

  const heatingOptions = useMemo<AddOfferOption[]>(
    () =>
      HEATING_OPTIONS.map((opt) => ({
        value: opt.key,
        label: t(opt.labelKey),
      })),
    [t],
  );

  const areaSqmValues = useMemo(() => {
    if (isPlot) return PLOT_AREA_SQM;
    if (isHouse) return HOUSE_LIVING_AREA_SQM;
    return UNIT_AREA_SQM;
  }, [isHouse, isPlot]);

  const areaOptions = useMemo(
    () => sqmPickerOptions(areaSqmValues, areaValue, t),
    [areaSqmValues, areaValue, t],
  );

  const housePlotAreaOptions = useMemo(
    () => sqmPickerOptions(PLOT_AREA_SQM, plotAreaValue, t),
    [plotAreaValue, t],
  );

  useEffect(() => {
    if (isPrimaryParamsComplete && !wasDetailsUnlockedRef.current) {
      wasDetailsUnlockedRef.current = true;
      setTimeout(() => {
        const y = Math.max(0, detailsYRef.current - 24);
        scrollRef.current?.scrollTo({ y, animated: true });
      }, 480);
    }
    if (!isPrimaryParamsComplete) wasDetailsUnlockedRef.current = false;
  }, [isPrimaryParamsComplete]);

  useEffect(() => {
    if (isAmenitiesUnlocked && !wasAmenitiesUnlockedRef.current) {
      wasAmenitiesUnlockedRef.current = true;
      setTimeout(() => {
        const y = Math.max(0, amenitiesYRef.current - 24);
        scrollRef.current?.scrollTo({ y, animated: true });
      }, 480);
    }
    if (!isAmenitiesUnlocked) wasAmenitiesUnlockedRef.current = false;
  }, [isAmenitiesUnlocked]);

  const handleTogglePill = useCallback(
    (field: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      updateDraft({ [field]: !draft[field] });
    },
    [draft, updateDraft],
  );

  const handleAreaPickerChange = useCallback(
    (value: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (isPlot) {
        updateDraft({ area: value, plotArea: value });
        return;
      }
      updateDraft({ area: value });
    },
    [isPlot, updateDraft],
  );

  const handleHousePlotAreaPickerChange = useCallback(
    (value: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateDraft({ plotArea: value });
    },
    [updateDraft],
  );

  const areaSectionTitle = isPlot
    ? t('addOffer.step3.sections.plotArea')
    : t('addOffer.step3.sections.area');
  const wheelHintLabel = t('addOffer.step3.wheelHint');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ marginTop: 50 }} />
        <AddOfferStepper currentStep={3} draft={draft} theme={theme} navigation={navigation} />

        <Text style={[styles.header, { color: theme.text }]}>{t('addOffer.step3.header')}</Text>

        <View style={styles.areaPickerWrap}>
          <AddOfferWheelPickerColumn
            title={areaSectionTitle}
            value={areaValue}
            options={areaOptions}
            onChange={handleAreaPickerChange}
            showScrollHint={!isAreaFilled}
            scrollHintLabel={wheelHintLabel}
            theme={theme}
            cardBg={cardBg}
            cardBorder={cardBorder}
          />
        </View>

        {isHouse ? (
          <View style={[styles.areaPickerWrap, { marginTop: 24 }]}>
            <AddOfferWheelPickerColumn
              title={t('addOffer.step3.sections.housePlotArea')}
              value={plotAreaValue}
              options={housePlotAreaOptions}
              onChange={handleHousePlotAreaPickerChange}
              showScrollHint={isAreaFilled && !isPlotAreaFilled}
              scrollHintLabel={wheelHintLabel}
              theme={theme}
              cardBg={cardBg}
              cardBorder={cardBorder}
            />
          </View>
        ) : null}

        {!isPlot && isPrimaryParamsComplete ? (
          <View onLayout={(e) => { detailsYRef.current = e.nativeEvent.layout.y; }}>
            <Animated.View style={{ opacity: detailsAnim }}>
              <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>{t('addOffer.step3.sections.details')}</Text>
            </Animated.View>
            <View style={styles.triplePickerWrapper}>
              <AddOfferWheelPickerColumn
                title={t('addOffer.step3.pickers.rooms')}
                value={draft.rooms || ''}
                options={roomOptions}
                disabled={!isRoomsUnlocked}
                onChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  updateDraft({ rooms: v });
                }}
                theme={theme}
                cardBg={cardBg}
                cardBorder={cardBorder}
              />
              {needsFloor ? (
                <AddOfferWheelPickerColumn
                  title={t('addOffer.step3.pickers.floor')}
                  value={draft.floor || ''}
                  options={floorOptions}
                  disabled={!isFloorUnlocked}
                  onChange={(v) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    updateDraft({ floor: v });
                  }}
                  theme={theme}
                  cardBg={cardBg}
                  cardBorder={cardBorder}
                />
              ) : null}
              <AddOfferWheelPickerColumn
                title={t('addOffer.step3.pickers.year')}
                value={draft.yearBuilt || draft.buildYear || ''}
                options={yearOptions}
                disabled={!isYearUnlocked}
                onChange={(v) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  updateDraft({ buildYear: v, yearBuilt: v });
                }}
                theme={theme}
                cardBg={cardBg}
                cardBorder={cardBorder}
              />
            </View>
          </View>
        ) : null}

        {!isPlot && isPrimaryParamsComplete && isAmenitiesUnlocked ? (
          <View onLayout={(e) => { amenitiesYRef.current = e.nativeEvent.layout.y; }}>
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>{t('addOffer.step3.sections.amenities')}</Text>
            <View style={styles.heatingPickerWrap}>
              <AddOfferWheelPickerColumn
                title={t('addOffer.step3.sections.heating')}
                value={draft.heating || ''}
                options={heatingOptions}
                onChange={(v) => updateDraft({ heating: v })}
                theme={theme}
                cardBg={cardBg}
                cardBorder={cardBorder}
              />
            </View>
          </View>
        ) : null}

        {!isPlot && isPrimaryParamsComplete ? (
          <Animated.View
            style={{ opacity: amenitiesAnim }}
            pointerEvents={isAmenitiesUnlocked ? 'auto' : 'none'}
          >
            <AppleHover
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateDraft({ isFurnished: !draft.isFurnished });
              }}
              style={[styles.premiumRow, { backgroundColor: cardBg, borderColor: cardBorder, shadowColor: '#000', shadowOpacity, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 }]}
            >
              <View>
                <Text style={[styles.premiumRowTitle, { color: theme.text }]}>{t('addOffer.step3.furnished')}</Text>
                <Text style={[styles.premiumRowSubtitle, { color: theme.subtitle }]}>
                  {draft.isFurnished ? t('addOffer.common.yes') : t('addOffer.common.no')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={[styles.booleanLabel, { color: draft.isFurnished ? Colors.primary : theme.subtitle }]}>
                  {draft.isFurnished ? t('addOffer.common.yes') : t('addOffer.common.no')}
                </Text>
                <View pointerEvents="none">
                  <Ionicons name={draft.isFurnished ? 'checkmark-circle' : 'close-circle-outline'} size={18} color={draft.isFurnished ? Colors.primary : theme.subtitle} />
                </View>
              </View>
            </AppleHover>

            <View style={styles.pillsContainer}>
              <TogglePill label={t('addOffer.step3.amenities.balcony')} icon="sunny-outline" field="hasBalcony" active={!!draft.hasBalcony} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
              <TogglePill label={t('addOffer.step3.amenities.parking')} icon="car-sport-outline" field="hasParking" active={!!draft.hasParking} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
              <TogglePill label={t('addOffer.step3.amenities.storage')} icon="cube-outline" field="hasStorage" active={!!draft.hasStorage} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
              <TogglePill label={t('addOffer.step3.amenities.elevator')} icon="arrow-up-circle-outline" field="hasElevator" active={!!draft.hasElevator} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
              <TogglePill label={t('addOffer.step3.amenities.garden')} icon="leaf-outline" field="hasGarden" active={!!draft.hasGarden} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
              <TogglePill label={t('addOffer.step3.amenities.twoLevel')} icon="layers-outline" field="isTwoLevel" active={!!draft.isTwoLevel} onToggle={handleTogglePill} cardBg={cardBg} cardBorder={cardBorder} shadowOpacity={shadowOpacity} textColor={theme.text} />
            </View>

            {showLandRegistryVerification ? (
              <>
                <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 20 }]}>{t('addOffer.step3.sections.landRegistry')}</Text>
                <View style={[styles.docsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <TextInput
                    style={[styles.docsInput, { color: theme.text, borderBottomColor: cardBorder }]}
                    placeholder={t('addOffer.step3.placeholders.apartmentNumber')}
                    placeholderTextColor={theme.subtitle}
                    value={draft.apartmentNumber || ''}
                    onChangeText={(value) => updateDraft({ apartmentNumber: value })}
                  />
                  <TextInput
                    style={[styles.docsInput, { color: theme.text }]}
                    placeholder={t('addOffer.step3.placeholders.landRegistryNumber')}
                    placeholderTextColor={theme.subtitle}
                    value={draft.landRegistryNumber || ''}
                    onChangeText={(value) => updateDraft({ landRegistryNumber: normalizeLandRegistryNumber(value) })}
                    onFocus={() => {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 280);
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  {landRegistrySuggestions.length > 0 && !isLandRegistryValid ? (
                    <View style={[styles.suggestionsWrap, { borderColor: cardBorder, backgroundColor: isDark ? '#111214' : '#F8FAFC' }]}>
                      {landRegistrySuggestions.map((item) => (
                        <Pressable
                          key={item.prefix}
                          style={styles.suggestionRow}
                          onPress={() =>
                            updateDraft({
                              landRegistryNumber: applyLandRegistryPrefix(String(draft.landRegistryNumber || ''), item.prefix),
                            })
                          }
                        >
                          <Text style={[styles.suggestionPrefix, { color: theme.text }]}>{item.prefix}</Text>
                          <Text style={[styles.suggestionCourt, { color: theme.subtitle }]} numberOfLines={1}>
                            {item.courtName}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {selectedCourt ? (
                    <Text style={[styles.docsCourtText, { color: theme.subtitle }]}>
                      {t('addOffer.step3.landRegistry.courtPrefix')} {selectedCourt.courtName}
                    </Text>
                  ) : null}
                  {landRegistryRaw ? (
                    <Text style={[styles.docsValidationText, { color: isLandRegistryValid ? '#34C759' : '#FF3B30' }]}>
                      {isLandRegistryValid
                        ? t('addOffer.step3.landRegistry.validFormat')
                        : t('addOffer.step3.landRegistry.invalidFormat')}
                    </Text>
                  ) : null}
                  <Text style={[styles.docsPrivacyText, { color: theme.subtitle }]}>
                    {t('addOffer.step3.landRegistry.privacy')}
                  </Text>
                </View>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        <AddOfferStepFooterHint
          theme={theme}
          icon="options-outline"
          text={
            showLandRegistryVerification
              ? t('addOffer.step3.footerHint.withLandRegistry')
              : t('addOffer.step3.footerHint.withoutLandRegistry')
          }
        />
        <View style={{ height: 200 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  header: { fontSize: 40, fontWeight: '800', marginBottom: 30, letterSpacing: -1.2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.5, marginLeft: 4 },
  areaPickerWrap: {
    marginBottom: 8,
  },
  triplePickerWrapper: {
    flexDirection: 'row',
    gap: 12,
    height: Platform.OS === 'ios' ? 200 : 80,
    marginBottom: 8,
  },
  heatingPickerWrap: {
    marginBottom: 16,
  },
  premiumRow: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumRowTitle: { fontSize: 15, fontWeight: '700' },
  premiumRowSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  booleanLabel: { fontSize: 14, fontWeight: '800' },
  pillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pill: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 14, fontWeight: '700' },
  docsCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 12,
    marginTop: 4,
  },
  docsInput: {
    minHeight: 46,
    fontSize: 15,
    fontWeight: '600',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  docsPrivacyText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  docsValidationText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  suggestionsWrap: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  suggestionPrefix: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  suggestionCourt: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  docsCourtText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
});
