import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OfferDescriptionRichText from './OfferDescriptionRichText';
import {
  DESCRIPTION_EMOJI_PRESETS,
  type EditorialMarkKind,
  insertEditorialMark,
} from '../utils/listingDescriptionFormat';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  isDark?: boolean;
  disabled?: boolean;
  maxLength?: number;
  minHeight?: number;
};

type Mode = 'edit' | 'preview';

const HISTORY_LIMIT = 48;

function ToolbarChip({
  label,
  icon,
  active,
  disabled,
  onPress,
  isDark,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
  isDark?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        isDark ? styles.chipDark : styles.chipLight,
        active && (isDark ? styles.chipActiveDark : styles.chipActiveLight),
        pressed && { opacity: 0.62 },
        disabled && { opacity: 0.35 },
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={active ? '#10b981' : isDark ? '#e5e7eb' : '#3a3a3c'}
        />
      ) : (
        <Text
          style={[
            styles.chipLabel,
            { color: active ? '#10b981' : isDark ? '#f5f5f7' : '#1d1d1f' },
            label === 'I' && { fontStyle: 'italic' },
            (label === 'B' || label === 'U') && { fontWeight: '700' },
            label === 'U' && { textDecorationLine: 'underline' },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default function ListingDescriptionEditor({
  value,
  onChange,
  placeholder,
  isDark = false,
  disabled = false,
  maxLength,
  minHeight = 240,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<Mode>('edit');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const historyRef = useRef<string[]>([value]);
  const historyIndexRef = useRef(0);
  const skipHistoryRef = useRef(false);
  const externalSyncRef = useRef(false);

  const palette = {
    shell: isDark ? 'rgba(18,18,20,0.96)' : 'rgba(255,255,255,0.98)',
    shellBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    toolbar: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    toolbarBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    field: isDark ? '#141416' : '#F7F8FA',
    fieldBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
    text: isDark ? '#f5f5f7' : '#1d1d1f',
    muted: isDark ? '#9ca3af' : '#6b7280',
    accent: '#10b981',
    gold: '#c4a574',
  };

  useEffect(() => {
    if (externalSyncRef.current) {
      externalSyncRef.current = false;
      historyRef.current = [value];
      historyIndexRef.current = 0;
      return;
    }
    const current = historyRef.current[historyIndexRef.current];
    if (current === value) return;
    externalSyncRef.current = true;
    historyRef.current = [value];
    historyIndexRef.current = 0;
  }, [value]);

  const commit = useCallback(
    (next: string, pushHistory = true) => {
      const capped = maxLength ? next.slice(0, maxLength) : next;
      if (pushHistory && !skipHistoryRef.current) {
        const trimmed = historyRef.current.slice(0, historyIndexRef.current + 1);
        if (trimmed[trimmed.length - 1] !== capped) {
          trimmed.push(capped);
          if (trimmed.length > HISTORY_LIMIT) trimmed.shift();
          historyRef.current = trimmed;
          historyIndexRef.current = trimmed.length - 1;
          setHistoryTick((tick) => tick + 1);
        }
      }
      skipHistoryRef.current = false;
      onChange(capped);
    },
    [maxLength, onChange],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    skipHistoryRef.current = true;
    setHistoryTick((tick) => tick + 1);
    onChange(historyRef.current[historyIndexRef.current] || '');
  }, [onChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    skipHistoryRef.current = true;
    setHistoryTick((tick) => tick + 1);
    onChange(historyRef.current[historyIndexRef.current] || '');
  }, [onChange]);

  const applyMark = useCallback(
    (kind: EditorialMarkKind, emoji?: string) => {
      const next = insertEditorialMark(value, selection, kind, emoji);
      commit(next.text);
      setSelection({ start: next.start, end: next.end });
      setMode('edit');
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [commit, selection, value],
  );

  const switchMode = (next: Mode) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(next);
    setEmojiOpen(false);
  };

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;
  void historyTick;
  const charCount = value.length;

  return (
    <View style={[styles.shell, { backgroundColor: palette.shell, borderColor: palette.shellBorder }]}>
      <View style={[styles.modeRow, { borderBottomColor: palette.toolbarBorder }]}>
        <View style={[styles.segment, { backgroundColor: palette.toolbar }]}>
          <Pressable
            onPress={() => switchMode('edit')}
            style={[styles.segmentBtn, mode === 'edit' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentLabel, { color: mode === 'edit' ? palette.text : palette.muted }]}>
              Edytuj
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode('preview')}
            style={[styles.segmentBtn, mode === 'preview' && styles.segmentBtnActive]}
          >
            <Text style={[styles.segmentLabel, { color: mode === 'preview' ? palette.text : palette.muted }]}>
              Podgląd
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.count, { color: palette.muted }]}>
          {maxLength ? `${charCount}/${maxLength}` : charCount}
        </Text>
      </View>

      {mode === 'edit' ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.toolbar, { borderBottomColor: palette.toolbarBorder }]}
            keyboardShouldPersistTaps="handled"
          >
            <ToolbarChip label="B" disabled={disabled} isDark={isDark} onPress={() => applyMark('bold')} />
            <ToolbarChip label="I" disabled={disabled} isDark={isDark} onPress={() => applyMark('italic')} />
            <ToolbarChip label="U" disabled={disabled} isDark={isDark} onPress={() => applyMark('underline')} />
            <View style={[styles.divider, { backgroundColor: palette.toolbarBorder }]} />
            <ToolbarChip
              label="H"
              disabled={disabled}
              isDark={isDark}
              onPress={() => applyMark('heading')}
            />
            <ToolbarChip icon="list" disabled={disabled} isDark={isDark} onPress={() => applyMark('bullet')} />
            <ToolbarChip icon="checkmark" disabled={disabled} isDark={isDark} onPress={() => applyMark('check')} />
            <ToolbarChip icon="remove" disabled={disabled} isDark={isDark} onPress={() => applyMark('separator')} />
            <View style={[styles.divider, { backgroundColor: palette.toolbarBorder }]} />
            <ToolbarChip
              icon="happy-outline"
              disabled={disabled}
              isDark={isDark}
              active={emojiOpen}
              onPress={() => setEmojiOpen((open) => !open)}
            />
            <ToolbarChip icon="arrow-undo" disabled={disabled || !canUndo} isDark={isDark} onPress={undo} />
            <ToolbarChip icon="arrow-redo" disabled={disabled || !canRedo} isDark={isDark} onPress={redo} />
          </ScrollView>

          {emojiOpen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
              keyboardShouldPersistTaps="handled"
            >
              {DESCRIPTION_EMOJI_PRESETS.map((emoji) => (
                <Pressable
                  key={emoji}
                  disabled={disabled}
                  onPress={() => applyMark('emoji', emoji)}
                  style={({ pressed }) => [styles.emojiBtn, pressed && { opacity: 0.55 }]}
                >
                  <Text style={styles.emojiGlyph}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <TextInput
            ref={inputRef}
            multiline
            editable={!disabled}
            maxLength={maxLength}
            value={value}
            onChangeText={(text) => commit(text)}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder={placeholder}
            placeholderTextColor={palette.muted}
            textAlignVertical="top"
            style={[
              styles.input,
              {
                minHeight,
                color: palette.text,
                backgroundColor: palette.field,
                borderColor: palette.fieldBorder,
              },
            ]}
          />
        </>
      ) : (
        <ScrollView
          style={{ minHeight }}
          contentContainerStyle={styles.previewBody}
          keyboardShouldPersistTaps="handled"
        >
          {value.trim() ? (
            <OfferDescriptionRichText value={value} isDark={isDark} />
          ) : (
            <Text style={[styles.previewEmpty, { color: palette.muted }]}>
              {placeholder || 'Podgląd sformatowanego opisu pojawi się tutaj.'}
            </Text>
          )}
        </ScrollView>
      )}

      <View style={[styles.footer, { borderTopColor: palette.toolbarBorder }]}>
        <Text style={[styles.footerHint, { color: palette.muted }]}>
          Sekcje · listy · ✓ · **pogrubienie** · emoty
        </Text>
        <View style={[styles.footerDot, { backgroundColor: palette.accent }]} />
        <Text style={[styles.footerHint, { color: palette.gold }]}>EstateOS Editorial</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.14)',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  count: {
    fontSize: 12,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    minWidth: 36,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  chipLight: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  chipDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActiveLight: {
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  chipActiveDark: {
    backgroundColor: 'rgba(16,185,129,0.18)',
  },
  chipLabel: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    marginHorizontal: 2,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  emojiGlyph: {
    fontSize: 20,
  },
  input: {
    margin: 12,
    marginTop: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '300',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  previewBody: {
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  previewEmpty: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 26,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerHint: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginLeft: 'auto',
  },
});
