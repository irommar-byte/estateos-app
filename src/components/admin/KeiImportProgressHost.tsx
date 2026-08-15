import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  KEI_IMPORT_STEPS,
  KEI_STEP_LABELS,
  type KeiAiRewriteProgress,
} from '../../contracts/keiAmerContract';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  computeKeiItemPercent,
  computeKeiOverallPercent,
  reconcileKeiExportAfterForeground,
  useKeiAmerExportStore,
} from '../../store/useKeiAmerExportStore';

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
    }),
    [isDark],
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(0, Math.min(100, percent))}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function StepPill({
  label,
  done,
  active,
  pulsate,
  accentColor,
  colors,
}: {
  label: string;
  done: boolean;
  active: boolean;
  pulsate?: boolean;
  accentColor: string;
  colors: ReturnType<typeof useKeiTheme>;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulsate || done) {
      pulse.setValue(1);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulsate, done, pulse]);

  return (
    <Animated.View
      style={[
        styles.stepPill,
        {
          opacity: pulse,
          backgroundColor: done
            ? 'rgba(52,199,89,0.16)'
            : active
              ? 'transparent'
              : colors.isDark
                ? 'rgba(120,120,128,0.18)'
                : 'rgba(120,120,128,0.12)',
          borderWidth: active && !done ? 1.5 : 0,
          borderColor: accentColor,
        },
      ]}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: done ? colors.accent : active ? accentColor : colors.tertiary,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

function AiRewritePanel({
  rewrite,
  colors,
}: {
  rewrite: KeiAiRewriteProgress;
  colors: ReturnType<typeof useKeiTheme>;
}) {
  const titleChanged = rewrite.titleBefore.trim() !== rewrite.titleAfter.trim();
  const descChanged = rewrite.descriptionBefore.trim() !== rewrite.descriptionAfter.trim();

  return (
    <View style={[styles.aiPanel, { backgroundColor: colors.cardSecondary, borderColor: colors.separator }]}>
      <View style={styles.aiPanelHeader}>
        {rewrite.working ? (
          <ActivityIndicator size="small" color={colors.accentBlue} />
        ) : (
          <Ionicons
            name={rewrite.rewrittenByAi ? 'sparkles' : 'document-text-outline'}
            size={16}
            color={rewrite.rewrittenByAi ? colors.accentBlue : colors.secondary}
          />
        )}
        <Text style={[styles.aiPanelTitle, { color: colors.text }]}>
          {rewrite.working
            ? 'AI przepisuje opis…'
            : rewrite.rewrittenByAi
              ? 'Opis przepisany przez AI'
              : 'Opis uzupełniony regułami'}
        </Text>
      </View>
      {!rewrite.working && rewrite.skipReason && !rewrite.rewrittenByAi ? (
        <Text style={[styles.aiPanelHint, { color: colors.tertiary }]}>{rewrite.skipReason}</Text>
      ) : null}
      {!rewrite.working ? (
        <>
          <Text style={[styles.aiDiffLabel, { color: colors.secondary }]}>Tytuł</Text>
          <View style={styles.aiDiffRow}>
            <View style={[styles.aiDiffCol, { backgroundColor: colors.card }]}>
              <Text style={[styles.aiDiffTag, { color: colors.tertiary }]}>PRZED</Text>
              <Text style={[styles.aiDiffText, { color: colors.secondary }]}>{rewrite.titleBefore || '—'}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={titleChanged ? colors.accentBlue : colors.tertiary} />
            <View style={[styles.aiDiffCol, { backgroundColor: colors.card }]}>
              <Text style={[styles.aiDiffTag, { color: colors.tertiary }]}>PO</Text>
              <Text style={[styles.aiDiffText, { color: titleChanged ? colors.text : colors.secondary }]}>
                {rewrite.titleAfter || '—'}
              </Text>
            </View>
          </View>
          <Text style={[styles.aiDiffLabel, { color: colors.secondary, marginTop: 10 }]}>Opis</Text>
          <View style={styles.aiDiffRow}>
            <View style={[styles.aiDiffCol, { backgroundColor: colors.card }]}>
              <Text style={[styles.aiDiffTag, { color: colors.tertiary }]}>PRZED</Text>
              <Text style={[styles.aiDiffText, { color: colors.secondary }]} numberOfLines={8}>
                {rewrite.descriptionBefore || '—'}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={descChanged ? colors.accentBlue : colors.tertiary} />
            <View style={[styles.aiDiffCol, { backgroundColor: colors.card }]}>
              <Text style={[styles.aiDiffTag, { color: colors.tertiary }]}>PO</Text>
              <Text style={[styles.aiDiffText, { color: descChanged ? colors.text : colors.secondary }]} numberOfLines={8}>
                {rewrite.descriptionAfter || '—'}
              </Text>
            </View>
          </View>
        </>
      ) : (
        <Text style={[styles.aiPanelHint, { color: colors.secondary }]}>
          Pobrano treść ze źródła — czekam na wynik GPT…
        </Text>
      )}
    </View>
  );
}

/** Apple-style glass capsule — engraved labels blink occasionally while import runs. */
function KeiBackgroundPill({
  percent,
  stageLabel,
  doneCount,
  totalCount,
  isDark,
  onPress,
  onStop,
}: {
  percent: number;
  stageLabel: string;
  doneCount: number;
  totalCount: number;
  isDark: boolean;
  onPress: () => void;
  onStop: () => void;
}) {
  const insets = useSafeAreaInsets();
  const engravedFlash = useRef(new Animated.Value(0.48)).current;
  const engravedColor = isDark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.48)';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4200),
        Animated.timing(engravedFlash, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(engravedFlash, {
          toValue: 0.48,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(220),
        Animated.timing(engravedFlash, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(engravedFlash, {
          toValue: 0.48,
          duration: 480,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [engravedFlash]);

  const capsuleBg = isDark ? 'rgba(22,22,24,0.28)' : 'rgba(255,255,255,0.22)';
  const border = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.pillHost, { bottom: Math.max(insets.bottom, 10) + 58 }]}
    >
      <View style={[styles.pillShadow, { shadowColor: isDark ? '#34C759' : '#000' }]}>
        <View style={styles.pillPress}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={isDark ? 48 : 72} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: capsuleBg }]} />
          )}
          <View style={[styles.pillInner, { backgroundColor: capsuleBg, borderColor: border }]}>
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [styles.pillMainHit, pressed && { opacity: 0.88 }]}
            >
              <View style={[styles.pillDot, { backgroundColor: '#34C759' }]} />
              <Animated.View style={[styles.pillCopy, { opacity: engravedFlash }]}>
                <View style={styles.pillTitleRow}>
                  <Text style={[styles.pillEngravedBrand, { color: engravedColor }]}>KEI</Text>
                  <Text style={[styles.pillEngravedSep, { color: engravedColor }]}>·</Text>
                  <Text style={[styles.pillEngravedPct, { color: engravedColor }]}>{percent}%</Text>
                  <Text style={[styles.pillEngravedCount, { color: engravedColor }]}>
                    {doneCount}/{totalCount}
                  </Text>
                </View>
                <Text style={[styles.pillEngravedStage, { color: engravedColor }]} numberOfLines={1}>
                  {stageLabel}
                </Text>
              </Animated.View>
            </Pressable>
            <Pressable
              onPress={onStop}
              hitSlop={10}
              style={styles.pillStop}
              accessibilityLabel="Zatrzymaj import"
            >
              <Ionicons name="stop-circle" size={26} color="#FF453A" />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Globalny host importu KEI — postęp żyje w store poza ekranem Amer KEI.
 * Zminimalizowany pill jest widoczny w całej aplikacji; powrót pokazuje bieżący etap na żywo.
 */
export default function KeiImportProgressHost() {
  const insets = useSafeAreaInsets();
  const colors = useKeiTheme();
  const token = useAuthStore((s) => s.token);
  const running = useKeiAmerExportStore((s) => s.running);
  const modalVisible = useKeiAmerExportStore((s) => s.modalVisible);
  const message = useKeiAmerExportStore((s) => s.message);
  const items = useKeiAmerExportStore((s) => s.items);
  const results = useKeiAmerExportStore((s) => s.results);
  const skipped = useKeiAmerExportStore((s) => s.skipped);
  const setModalVisible = useKeiAmerExportStore((s) => s.setModalVisible);
  const cancelExport = useKeiAmerExportStore((s) => s.cancelExport);
  const hydrateFromServer = useKeiAmerExportStore((s) => s.hydrateFromServer);

  const exportScrollRef = useRef<ScrollView>(null);
  const exportCardOffsetsRef = useRef<Record<string, number>>({});

  const overallPercent = computeKeiOverallPercent(items);
  const activeItem = useMemo(() => items.find((item) => item.status === 'active'), [items]);
  const doneCount = useMemo(
    () => items.filter((item) => item.status === 'done' || item.status === 'skipped').length,
    [items],
  );
  const stageLabel = activeItem
    ? [activeItem.stepLabel, activeItem.stepDetail].filter(Boolean).join(' · ')
    : message || 'Import na serwerze…';
  const activeExportIndex = useMemo(
    () => items.findIndex((item) => item.status === 'active'),
    [items],
  );

  const showPill = running && !modalVisible && items.length > 0;
  const showModal = modalVisible && (running || items.length > 0);

  useEffect(() => {
    if (token) void hydrateFromServer(token);
  }, [token, hydrateFromServer]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      reconcileKeiExportAfterForeground();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!modalVisible || activeExportIndex < 0) return;
    const item = items[activeExportIndex];
    if (!item) return;
    const key = `${item.portalUrl}-${item.index}`;
    const scrollToActive = () => {
      const y = exportCardOffsetsRef.current[key];
      if (typeof y !== 'number') return;
      exportScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
    };
    requestAnimationFrame(scrollToActive);
    const t = setTimeout(scrollToActive, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko zmiana aktywnej pozycji / otwarcie
  }, [modalVisible, activeExportIndex]);

  const handleStop = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    cancelExport();
  }, [cancelExport]);

  const handleOpen = useCallback(() => {
    void Haptics.selectionAsync();
    setModalVisible(true);
  }, [setModalVisible]);

  if (!showPill && !showModal) return null;

  return (
    <>
      {showPill ? (
        <KeiBackgroundPill
          percent={overallPercent}
          stageLabel={stageLabel}
          doneCount={doneCount}
          totalCount={items.length}
          isDark={colors.isDark}
          onPress={handleOpen}
          onStop={handleStop}
        />
      ) : null}

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.separator, paddingTop: insets.top + 8 }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Import KEI</Text>
            <View style={styles.modalHeaderActions}>
              {running ? (
                <Pressable onPress={handleStop} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontSize: 17, fontWeight: '700' }}>Zatrzymaj</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={{ color: colors.accentBlue, fontSize: 17, fontWeight: '600' }}>
                  {running ? 'Zminimalizuj' : 'Zamknij'}
                </Text>
              </Pressable>
            </View>
          </View>
          <ScrollView ref={exportScrollRef} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}>
            <Text style={[styles.exportSummary, { color: colors.secondary }]}>{message}</Text>
            <ProgressBar percent={overallPercent} color={colors.accent} />
            <Text style={[styles.percentLabel, { color: colors.text }]}>{overallPercent}%</Text>

            {items.map((item) => (
              <View
                key={`${item.portalUrl}-${item.index}`}
                style={[styles.progressCard, { backgroundColor: colors.card }]}
                onLayout={(e) => {
                  exportCardOffsetsRef.current[`${item.portalUrl}-${item.index}`] = e.nativeEvent.layout.y;
                }}
              >
                <View style={styles.progressCardHeader}>
                  <Text style={[styles.progressAddress, { color: colors.text }]} numberOfLines={2}>
                    {item.address || item.portalUrl}
                  </Text>
                  <Text
                    style={{
                      color:
                        item.status === 'done'
                          ? colors.accent
                          : item.status === 'skipped'
                            ? colors.accentAmber
                            : colors.accentBlue,
                      fontWeight: '700',
                      fontSize: 12,
                    }}
                  >
                    {item.status === 'done'
                      ? 'OK'
                      : item.status === 'skipped'
                        ? 'POMINIĘTO'
                        : item.status === 'active'
                          ? `${computeKeiItemPercent(item)}%`
                          : '…'}
                  </Text>
                </View>
                <Text style={{ color: colors.secondary, fontSize: 13 }}>{item.stepLabel}</Text>
                {item.stepDetail ? (
                  <Text style={{ color: colors.tertiary, fontSize: 12, marginTop: 4 }}>{item.stepDetail}</Text>
                ) : null}
                <View style={styles.stepsRow}>
                  {KEI_IMPORT_STEPS.map((step) => {
                    const done = item.completedSteps.includes(step) || item.status === 'done';
                    const active = item.currentStep === step && item.status === 'active';
                    const isFloorPlanStep = step === 'images' && item.imageProgress?.asFloorPlan;
                    const accentColor = isFloorPlanStep && (active || done) ? colors.accentOrange : colors.accentBlue;
                    return (
                      <StepPill
                        key={step}
                        label={
                          step === 'images' && (active || done) && item.imageProgress?.asFloorPlan
                            ? 'Rzut'
                            : KEI_STEP_LABELS[step]
                        }
                        done={done}
                        active={active}
                        pulsate={running && active && !done}
                        accentColor={accentColor}
                        colors={colors}
                      />
                    );
                  })}
                </View>
                {item.aiRewrite ? <AiRewritePanel rewrite={item.aiRewrite} colors={colors} /> : null}
                {item.status === 'done' && item.publicUrl ? (
                  <View style={styles.resultLinks}>
                    <Pressable onPress={() => void Linking.openURL(item.publicUrl!)}>
                      <Text style={{ color: colors.accentBlue, fontWeight: '600' }}>Podgląd oferty</Text>
                    </Pressable>
                    {item.editUrl ? (
                      <Pressable onPress={() => void Linking.openURL(item.editUrl!)}>
                        <Text style={{ color: colors.accentBlue, fontWeight: '600' }}>Edycja</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                {item.reason ? (
                  <Text style={{ color: colors.accentAmber, fontSize: 12, marginTop: 6 }}>{item.reason}</Text>
                ) : null}
              </View>
            ))}

            {results.length > 0 ? (
              <View style={[styles.resultBox, { backgroundColor: 'rgba(52,199,89,0.1)' }]}>
                <Text style={{ color: colors.accent, fontWeight: '800' }}>
                  Zaimportowano: {results.length}
                  {skipped > 0 ? ` · Pominięto: ${skipped}` : ''}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillHost: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 80,
    elevation: 80,
  },
  pillShadow: {
    borderRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  pillPress: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 10,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pillMainHit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillCopy: { flex: 1, minWidth: 0 },
  pillTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  pillEngravedBrand: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  pillEngravedSep: { fontSize: 12, fontWeight: '600' },
  pillEngravedPct: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  pillEngravedCount: { fontSize: 11, fontWeight: '700', marginLeft: 2 },
  pillEngravedStage: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pillStop: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  aiDiffLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  aiDiffRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  aiDiffCol: { flex: 1, borderRadius: 10, padding: 8 },
  aiDiffTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  aiDiffText: { fontSize: 12, lineHeight: 17 },
  resultBox: { borderRadius: 14, padding: 14, marginTop: 8 },
});
