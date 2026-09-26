import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';

type Point = { x: number; y: number };

function pathFromStrokes(strokes: Point[][]) {
  return strokes
    .map((stroke) =>
      stroke
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(' '),
    )
    .join(' ');
}

function SignatureCanvas({
  disabled,
  isDark,
  height,
  onCapture,
}: {
  disabled?: boolean;
  isDark?: boolean;
  height: number;
  onCapture: (dataUrl: string) => void;
}) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const strokesRef = useRef<Point[][]>([]);
  const current = useRef<Point[]>([]);
  const viewRef = useRef<View>(null);
  const rafRef = useRef<number | null>(null);
  const drawing = useRef(false);

  const flush = useCallback(() => {
    rafRef.current = null;
    setStrokes(strokesRef.current.map((s) => s.slice()));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const emitCapture = useCallback(async () => {
    if (!viewRef.current || strokesRef.current.length === 0) {
      onCapture('');
      return;
    }
    try {
      const uri = await captureRef(viewRef, {
        format: 'png',
        result: 'data-uri',
        quality: 1,
      });
      onCapture(String(uri || ''));
    } catch {
      onCapture('');
    }
  }, [onCapture]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          drawing.current = true;
          const { locationX, locationY } = event.nativeEvent;
          current.current = [{ x: locationX, y: locationY }];
          strokesRef.current = [...strokesRef.current, current.current];
          scheduleFlush();
        },
        onPanResponderMove: (event) => {
          if (!drawing.current) return;
          const { locationX, locationY } = event.nativeEvent;
          current.current = [...current.current, { x: locationX, y: locationY }];
          const next = strokesRef.current.slice();
          next[next.length - 1] = current.current;
          strokesRef.current = next;
          scheduleFlush();
        },
        onPanResponderRelease: () => {
          drawing.current = false;
          if (rafRef.current != null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
          setStrokes(strokesRef.current.map((s) => s.slice()));
          void emitCapture();
        },
        onPanResponderTerminate: () => {
          drawing.current = false;
          void emitCapture();
        },
      }),
    [disabled, emitCapture, scheduleFlush],
  );

  const clear = () => {
    current.current = [];
    strokesRef.current = [];
    setStrokes([]);
    onCapture('');
  };

  const empty = strokes.length === 0;

  return (
    <View>
      <View
        ref={viewRef}
        collapsable={false}
        {...pan.panHandlers}
        style={[
          styles.canvas,
          {
            height,
            backgroundColor: '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#d1d5db',
          },
        ]}
      >
        <View style={styles.baseline} pointerEvents="none" />
        <Text style={styles.xMark} pointerEvents="none">
          ✕
        </Text>
        {empty ? (
          <Text style={styles.hint} pointerEvents="none">
            Podpisz czytelnie rysikiem lub palcem
          </Text>
        ) : null}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Path
            d={pathFromStrokes(strokes)}
            stroke="#0f172a"
            strokeWidth={2.8}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Pressable onPress={clear} disabled={disabled || empty} style={styles.clearBtn} hitSlop={8}>
        <Ionicons name="refresh-outline" size={16} color={empty ? '#9ca3af' : '#ef4444'} />
        <Text style={[styles.clearText, empty && { color: '#9ca3af' }]}>Wyczyść</Text>
      </Pressable>
    </View>
  );
}

/**
 * Profesjonalne pole podpisu — otwiera się w modalu (poza ScrollView),
 * żeby rysik nie przewijał karty klienta.
 */
export default function SignaturePad({
  onChange,
  disabled,
  isDark,
  value,
  clientLabel,
}: {
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  isDark?: boolean;
  /** Aktualny podpis (data URL) — do podglądu na karcie. */
  value?: string;
  clientLabel?: string;
  /** @deprecated — modal izoluje rysowanie; zostawione dla kompatybilności. */
  onBeginDrawing?: () => void;
  onEndDrawing?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const canvasH = Math.min(320, Math.max(240, Math.round(winH * 0.38)));

  const openModal = () => {
    if (disabled) return;
    setDraft(value || '');
    setOpen(true);
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  const cancel = () => {
    setDraft(value || '');
    setOpen(false);
  };

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={[styles.sectionLabel, { color: isDark ? '#8e8e93' : '#6b7280' }]}>PODPIS KLIENTA</Text>
      <Pressable
        onPress={openModal}
        disabled={disabled}
        style={[
          styles.previewCard,
          {
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#e5e7eb',
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        {value ? (
          <View style={styles.previewSigned}>
            <View style={styles.previewImgWrap}>
              <Image source={{ uri: value }} style={{ width: '100%', height: 72 }} resizeMode="contain" />
            </View>
            <Text style={[styles.previewCaption, { color: isDark ? '#34C759' : '#059669' }]}>
              Podpis zapisany — dotknij, aby poprawić
            </Text>
          </View>
        ) : (
          <View style={styles.previewEmpty}>
            <View style={styles.previewIcon}>
              <Ionicons name="create-outline" size={22} color="#34C759" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewTitle, { color: isDark ? '#fff' : '#111827' }]}>
                Otwórz pole podpisu
              </Text>
              <Text style={[styles.previewSub, { color: isDark ? '#8e8e93' : '#6b7280' }]}>
                Pełny ekran · stabilny rysik · bez przewijania karty
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#8e8e93' : '#9ca3af'} />
          </View>
        )}
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cancel}
      >
        <View
          style={[
            styles.modalRoot,
            {
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 12,
              backgroundColor: isDark ? '#0a0a0a' : '#f5f5f7',
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Pressable onPress={cancel} hitSlop={12} style={styles.modalNavBtn}>
              <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '700', fontSize: 16 }}>Anuluj</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#111' }]}>Podpis</Text>
            <Pressable
              onPress={confirm}
              disabled={!draft}
              hitSlop={12}
              style={[styles.modalNavBtn, { opacity: draft ? 1 : 0.4 }]}
            >
              <Text style={{ color: '#34C759', fontWeight: '800', fontSize: 16 }}>Gotowe</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDark ? '#141414' : '#fff',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb',
                maxWidth: Math.min(720, winW - 24),
                alignSelf: 'center',
                width: '100%',
              },
            ]}
          >
            <Text style={[styles.docEyebrow, { color: isDark ? '#8e8e93' : '#6b7280' }]}>
              POTWIERDZENIE NA TABLECIE
            </Text>
            <Text style={[styles.docTitle, { color: isDark ? '#fff' : '#111827' }]}>
              {clientLabel ? `Podpis: ${clientLabel}` : 'Podpis klienta'}
            </Text>
            <Text style={[styles.docBody, { color: isDark ? '#a1a1aa' : '#6b7280' }]}>
              Prosimy o czytelny podpis. Pole jest zamrożone — karta pod spodem się nie przewija.
            </Text>

            <SignatureCanvas
              disabled={disabled}
              isDark={isDark}
              height={canvasH}
              onCapture={setDraft}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 88,
    justifyContent: 'center',
  },
  previewEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(52,199,89,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { fontWeight: '800', fontSize: 15 },
  previewSub: { marginTop: 3, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  previewSigned: { padding: 12 },
  previewImgWrap: {
    height: 72,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  previewCaption: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  modalRoot: { flex: 1, paddingHorizontal: 12 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  modalNavBtn: { minWidth: 72 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    flexGrow: 0,
  },
  docEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  docTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  docBody: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  canvas: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  baseline: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cbd5e1',
  },
  xMark: {
    position: 'absolute',
    left: 18,
    bottom: 40,
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  clearBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearText: { color: '#ef4444', fontWeight: '800', fontSize: 13 },
});
