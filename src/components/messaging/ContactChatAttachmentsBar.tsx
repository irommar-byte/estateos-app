import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, FileText, Paperclip } from 'lucide-react-native';
import { formatContactBytes, MAX_CONTACT_FILE_BYTES } from '../../utils/contactAttachment';
import type { ContactThreadAttachmentsInfo } from '../../services/contactService';
import { getChatTheme } from './chatTheme';

type Props = {
  info: ContactThreadAttachmentsInfo | null;
  loading: boolean;
  open: boolean;
  onToggle: () => void;
  isDark?: boolean;
};

export default function ContactChatAttachmentsBar({ info, loading, open, onToggle, isDark = true }: Props) {
  const { colors } = getChatTheme(isDark);
  const usageBytes = info?.usageBytes ?? 0;
  const limitBytes = info?.limitBytes ?? 100 * 1024 * 1024;
  const usagePct = Math.min(100, limitBytes > 0 ? (usageBytes / limitBytes) * 100 : 0);
  const remaining = Math.max(0, limitBytes - usageBytes);
  const barColor = usagePct > 90 ? '#FF3B30' : usagePct > 70 ? '#FF9F0A' : colors.primary;

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border, backgroundColor: isDark ? colors.background : colors.surface }]}>
      <View style={styles.usageBlock}>
        <View style={styles.usageHeader}>
          <Text style={[styles.usageLabel, { color: colors.textMuted }]}>Załączniki rozmowy</Text>
          <Text style={[styles.usageValue, { color: colors.textMuted }]}>
            {formatContactBytes(usageBytes)} / {formatContactBytes(limitBytes)}
          </Text>
        </View>
        <View style={[styles.track, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={[styles.fill, { width: `${usagePct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Max {formatContactBytes(MAX_CONTACT_FILE_BYTES)} na plik · pozostało {formatContactBytes(remaining)}
        </Text>
      </View>

      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.toggleBtn,
          {
            borderColor: colors.border,
            backgroundColor: pressed
              ? isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)'
              : isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
          },
        ]}
      >
        <Paperclip size={14} color={colors.textBase} />
        <Text style={[styles.toggleText, { color: colors.textBase }]}>Pokaż załączniki</Text>
        {open ? <ChevronUp size={14} color={colors.textMuted} /> : <ChevronDown size={14} color={colors.textMuted} />}
      </Pressable>

      {open ? (
        <View style={styles.listWrap}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Ładowanie…</Text>
            </View>
          ) : !info?.attachments?.length ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Brak załączników w tej rozmowie.</Text>
          ) : (
            info.attachments.map((att) => (
              <Pressable
                key={`${att.messageId}-${att.url}`}
                onPress={() => void Linking.openURL(att.url)}
                style={({ pressed }) => [
                  styles.attRow,
                  {
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.04)'
                      : isDark
                        ? colors.surfaceElevated
                        : '#F2F2F7',
                  },
                ]}
              >
                <View style={[styles.attIcon, { backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)' }]}>
                  <FileText size={16} color={colors.primary} />
                </View>
                <View style={styles.attInfo}>
                  <Text style={[styles.attName, { color: colors.textBase }]} numberOfLines={1}>
                    {att.name}
                  </Text>
                  <Text style={[styles.attMeta, { color: colors.textMuted }]}>
                    {formatContactBytes(att.size)} · {new Date(att.createdAt).toLocaleDateString('pl-PL')}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  usageBlock: { gap: 4 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usageLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  usageValue: { fontSize: 10, fontWeight: '700' },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  hint: { fontSize: 9, marginTop: 2 },
  toggleBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  listWrap: { gap: 8, maxHeight: 176 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  loadingText: { fontSize: 12 },
  emptyText: { fontSize: 12, paddingVertical: 6 },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attInfo: { flex: 1, minWidth: 0 },
  attName: { fontSize: 13, fontWeight: '600' },
  attMeta: { fontSize: 10, marginTop: 2 },
});
