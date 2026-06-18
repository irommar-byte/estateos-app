import { Platform, StyleSheet } from 'react-native';

export type ChatThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  textBase: string;
  textMuted: string;
  border: string;
  inputBarBg: string;
  sendIconIdle: string;
  backPressed: string;
};

const CHAT_COLORS_DARK: ChatThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  primary: '#34C759',
  textBase: '#FFFFFF',
  textMuted: 'rgba(235, 235, 245, 0.6)',
  border: 'rgba(255, 255, 255, 0.1)',
  inputBarBg: 'transparent',
  sendIconIdle: 'rgba(255,255,255,0.4)',
  backPressed: 'rgba(255,255,255,0.1)',
};

const CHAT_COLORS_LIGHT: ChatThemeColors = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#34C759',
  textBase: '#000000',
  textMuted: 'rgba(60, 60, 67, 0.55)',
  border: 'rgba(0, 0, 0, 0.08)',
  inputBarBg: 'rgba(255, 255, 255, 0.96)',
  sendIconIdle: 'rgba(60, 60, 67, 0.35)',
  backPressed: 'rgba(0, 0, 0, 0.06)',
};

/** @deprecated Użyj `getChatTheme(isDark).colors` */
export const CHAT_COLORS = CHAT_COLORS_DARK;

export function getChatTheme(isDark: boolean) {
  const colors = isDark ? CHAT_COLORS_DARK : CHAT_COLORS_LIGHT;
  const styles = StyleSheet.create({
    chatScrollView: { flex: 1, backgroundColor: colors.background },
    chatScrollContent: { padding: 16, paddingBottom: 40 },
    msgWrapper: { marginBottom: 16, maxWidth: '82%' },
    msgMe: { alignSelf: 'flex-end' },
    msgThem: { alignSelf: 'flex-start' },
    msgBubble: { padding: 12, borderRadius: 20 },
    msgBubbleMe: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
      ...(isDark
        ? {}
        : {
            shadowColor: '#34C759',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.22,
            shadowRadius: 6,
            elevation: 3,
          }),
    },
    msgBubbleThem: {
      backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
      borderBottomLeftRadius: 4,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(0,0,0,0.06)',
          }),
    },
    msgText: { color: isDark ? colors.textBase : '#1C1C1E', fontSize: 16, lineHeight: 22 },
    msgTextMe: { color: '#000000', fontWeight: '500' },
    msgFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, alignSelf: 'flex-end' },
    msgTime: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
    reactionPill: {
      marginTop: -6,
      marginBottom: 2,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
      alignSelf: 'flex-start',
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 1,
          }),
    },
    reactionPillMe: { alignSelf: 'flex-end' },
    reactionPillThem: { alignSelf: 'flex-start' },
    reactionPillText: { fontSize: 15, lineHeight: 18 },
    typingBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    typingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
      marginHorizontal: 2,
    },
    inputArea: {
      paddingTop: 12,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBarBg,
      borderTopWidth: isDark ? 0 : StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 8,
          }),
    },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    textInput: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      backgroundColor: isDark ? colors.surfaceElevated : '#EFEFF4',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      color: colors.textBase,
      fontSize: 16,
      ...(isDark
        ? {}
        : {
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: 'rgba(0,0,0,0.06)',
          }),
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? colors.surfaceElevated : '#E5E5EA',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    sendBtnActive: { backgroundColor: colors.primary },
    attachBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 2,
    },
    pendingChip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 8,
      gap: 8,
    },
    pendingPreview: { flex: 1, minWidth: 0 },
    pendingChipClear: { padding: 4, marginTop: 4 },
    loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  });

  const headerStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? colors.background : colors.surface,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 3,
          }),
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,
    },
    backButtonPressed: { backgroundColor: colors.backPressed },
    headerTextContainer: { flex: 1, marginLeft: 8 },
    headerSubtitle: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 2,
    },
    headerTitle: {
      color: colors.textBase,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    headerSpacer: { width: 44 },
  });

  return { colors, styles, headerStyles, isDark };
}

/** @deprecated Użyj `getChatTheme(isDark).styles` */
export const chatThreadStyles = getChatTheme(true).styles;
