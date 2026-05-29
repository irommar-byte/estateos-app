import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Platform, KeyboardAvoidingView, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useOfferStore } from '../../store/useOfferStore';
import AppleHover from '../../components/AppleHover';
import AddOfferStepper from '../../components/AddOfferStepper';
import AddOfferStepFooterHint from '../../components/AddOfferStepFooterHint';
import AddOfferOptionField, { type AddOfferOption } from './AddOfferOptionField';
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
const YEARS = ['', ...Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - i).toString())];

const formatNumericInput = (text: string) => text.replace(/[^0-9.,]/g, '');

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

type PremiumMetricRowProps = {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  theme: { text: string; subtitle: string };
  cardBg: string;
  cardBorder: string;
  shadowOpacity: number;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

function PremiumMetricRow({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  theme,
  cardBg,
  cardBorder,
  shadowOpacity,
  icon = 'resize-outline',
}: PremiumMetricRowProps) {
  return (
    <View
      style={[
        styles.premiumMetricCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          shadowColor: '#000',
          shadowOpacity,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
      ]}
    >
      <View style={styles.premiumMetricHeader}>
        <View style={[styles.premiumMetricIconWrap, { backgroundColor: `${Colors.primary}18` }]}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.premiumMetricLabel, { color: theme.text }]}>{label}</Text>
          {hint ? (
            <Text style={[styles.premiumMetricHint, { color: theme.subtitle }]}>{hint}</Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.premiumMetricInputRow, { borderColor: cardBorder }]}>
        <TextInput
          style={[styles.premiumMetricInput, { color: theme.text }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.subtitle}
          keyboardType="decimal-pad"
          maxLength={8}
          returnKeyType="done"
        />
        <Text style={[styles.premiumMetricSuffix, { color: value ? theme.text : theme.subtitle }]}>m²</Text>
      </View>
    </View>
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
  const isAreaFilled = areaNum > 0;

  const isRoomsUnlocked = !isPlot && isAreaFilled;
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

  const detailsAnim = useRef(new Animated.Value(isAreaFilled ? 1 : 0)).current;
  const amenitiesAnim = useRef(new Animated.Value(isAmenitiesUnlocked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(detailsAnim, { toValue: isAreaFilled ? 1 : 0, duration: 400, useNativeDriver: false }).start();
  }, [detailsAnim, isAreaFilled]);

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

  useEffect(() => {
    if (isAreaFilled && !wasDetailsUnlockedRef.current) {
      wasDetailsUnlockedRef.current = true;
      setTimeout(() => {
        const y = Math.max(0, detailsYRef.current - 24);
        scrollRef.current?.scrollTo({ y, animated: true });
      }, 480);
    }
    if (!isAreaFilled) wasDetailsUnlockedRef.current = false;
  }, [isAreaFilled]);

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

  const handleAreaChange = useCallback(
    (text: string) => {
      const formatted = formatNumericInput(text);
      if (isPlot) {
        updateDraft({ area: formatted, plotArea: formatted });
        return;
      }
      updateDraft({ area: formatted });
    },
    [isPlot, updateDraft],
  );

  const handleHousePlotAreaChange = useCallback(
    (text: string) => {
      updateDraft({ plotArea: formatNumericInput(text) });
    },
    [updateDraft],
  );

  const areaSectionTitle = isPlot
    ? t('addOffer.step3.sections.plotArea')
    : t('addOffer.step3.sections.area');

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

        {isPlot ? (
          <PremiumMetricRow
            label={areaSectionTitle}
            hint={t('addOffer.step3.hints.plotArea')}
            value={areaValue}
            onChangeText={handleAreaChange}
            placeholder={t('addOffer.step3.placeholders.plotArea')}
            theme={theme}
            cardBg={cardBg}
            cardBorder={cardBorder}
            shadowOpacity={shadowOpacity}
            icon="map-outline"
          />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>{areaSectionTitle}</Text>
            <View
              style={[
                styles.areaBox,
                {
                  backgroundColor: cardBg,
                  borderColor: cardBorder,
                  shadowColor: '#000',
                  shadowOpacity,
                  shadowRadius: 15,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 2,
                },
              ]}
            >
              <TextInput
                style={[styles.areaInput, { color: theme.text }]}
                placeholder={t('addOffer.step3.placeholders.area')}
                placeholderTextColor={theme.subtitle}
                value={areaValue}
                onChangeText={handleAreaChange}
                keyboardType="decimal-pad"
                maxLength={8}
                returnKeyType="done"
              />
              <Text style={[styles.areaUnit, { color: areaValue ? theme.text : theme.subtitle }]}>m²</Text>
            </View>
          </>
        )}

        {isHouse ? (
          <View style={{ marginTop: 24 }}>
            <PremiumMetricRow
              label={t('addOffer.step3.sections.housePlotArea')}
              hint={t('addOffer.step3.hints.housePlotArea')}
              value={plotAreaValue}
              onChangeText={handleHousePlotAreaChange}
              placeholder={t('addOffer.step3.placeholders.housePlotArea')}
              theme={theme}
              cardBg={cardBg}
              cardBorder={cardBorder}
              shadowOpacity={shadowOpacity}
              icon="trail-sign-outline"
            />
          </View>
        ) : null}

        {!isPlot && isAreaFilled ? (
          <Animated.View
            onLayout={(e) => { detailsYRef.current = e.nativeEvent.layout.y; }}
            style={{ opacity: detailsAnim }}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>{t('addOffer.step3.sections.details')}</Text>
            <AddOfferOptionField
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
              <AddOfferOptionField
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
            <AddOfferOptionField
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
          </Animated.View>
        ) : null}

        {!isPlot && isAreaFilled ? (
          <Animated.View
            onLayout={(e) => { amenitiesYRef.current = e.nativeEvent.layout.y; }}
            style={{ opacity: amenitiesAnim }}
            pointerEvents={isAmenitiesUnlocked ? 'auto' : 'none'}
          >
            <Text style={[styles.sectionTitle, { color: theme.subtitle, marginTop: 40 }]}>{t('addOffer.step3.sections.amenities')}</Text>
            <AddOfferOptionField
              title={t('addOffer.step3.sections.heating')}
              value={draft.heating || ''}
              options={heatingOptions}
              disabled={!isAmenitiesUnlocked}
              onChange={(v) => updateDraft({ heating: v })}
              theme={theme}
              cardBg={cardBg}
              cardBorder={cardBorder}
            />

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
  areaBox: { borderRadius: 28, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 130, paddingBottom: 25 },
  areaInput: { fontSize: 65, fontWeight: '800', textAlign: 'center', height: 85, minWidth: 100 },
  areaUnit: { fontSize: 24, fontWeight: '700', marginBottom: 15, marginLeft: 5 },
  premiumMetricCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  premiumMetricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  premiumMetricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumMetricLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  premiumMetricHint: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  premiumMetricInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  premiumMetricInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    paddingVertical: 10,
  },
  premiumMetricSuffix: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
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
