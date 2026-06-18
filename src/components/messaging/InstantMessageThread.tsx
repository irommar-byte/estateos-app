import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Check, CheckCheck, Plus, Send, X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getChatTheme } from './chatTheme';
import MessageReactionPicker, { type ReactionAnchor } from './MessageReactionPicker';
import { groupedReactionEmojis } from '../../utils/contactMessageReactions';
import { parseContactMessageParts } from '../../utils/contactAttachment';
import ContactMessageAttachment from './ContactMessageAttachment';
import ContactAttachMenuPopover, { type AttachMenuAnchor } from './ContactAttachMenuPopover';
import {
  createContactAttachmentPickers,
  type ContactAttachLabels,
  type ContactPendingFile,
} from '../../utils/contactAttachMenu';

export type IMThreadMessage = {
  id: number | string;
  senderId: number | string;
  content: string;
  attachment?: string | null;
  createdAt: string;
  isRead?: boolean;
  reactions?: Record<string, string>;
};

function TypingDot({ delay, dotStyle }: { delay: number; dotStyle: object }) {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withDelay(
        delay,
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
          withTiming(0, { duration: 600 }),
        ),
      ),
      -1,
      true,
    );
  }, [delay, translateY]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  return <Animated.View style={[dotStyle, anim]} />;
}

type Props = {
  messages: IMThreadMessage[];
  currentUserId: number;
  loading?: boolean;
  peerTyping?: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  placeholder: string;
  onReact?: (messageId: number | string, emoji: string | null) => void;
  isDark?: boolean;
  attachmentMenu?: {
    labels: ContactAttachLabels;
    onPick: (file: ContactPendingFile) => void;
    usageBytes: number;
    limitBytes: number;
    disabled?: boolean;
  };
  pendingAttachment?: {
    name: string;
    uri: string;
    mimeType: string;
    size?: number;
  } | null;
  onClearPendingAttachment?: () => void;
};

export default function InstantMessageThread({
  messages,
  currentUserId,
  loading = false,
  peerTyping = false,
  draft,
  onDraftChange,
  onSend,
  sending = false,
  placeholder,
  onReact,
  isDark = true,
  attachmentMenu,
  pendingAttachment,
  onClearPendingAttachment,
}: Props) {
  const { colors, styles } = useMemo(() => getChatTheme(isDark), [isDark]);
  const scrollRef = useRef<ScrollView>(null);
  const attachBtnRef = useRef<View>(null);
  const lastAutoScrolledMessageIdRef = useRef<string | number | null>(null);
  const bubbleRefs = useRef<Record<string, View | null>>({});
  const [reactionAnchor, setReactionAnchor] = useState<ReactionAnchor | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachAnchor, setAttachAnchor] = useState<AttachMenuAnchor | null>(null);

  const pickers = useMemo(() => {
    if (!attachmentMenu) return null;
    return createContactAttachmentPickers(
      attachmentMenu.labels,
      attachmentMenu.onPick,
      attachmentMenu.usageBytes,
      attachmentMenu.limitBytes,
    );
  }, [attachmentMenu]);

  const openAttachMenu = () => {
    if (!attachmentMenu || attachmentMenu.disabled || sending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    attachBtnRef.current?.measureInWindow((x, y, width, height) => {
      setAttachAnchor({ x, y, width, height });
      setAttachMenuOpen(true);
    });
  };

  useEffect(() => {
    lastAutoScrolledMessageIdRef.current = null;
  }, [currentUserId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastId = messages[messages.length - 1]?.id;
    if (lastId === undefined || lastId === null) return;
    if (lastId === lastAutoScrolledMessageIdRef.current) return;
    lastAutoScrolledMessageIdRef.current = lastId;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages]);

  const canSend = Boolean((draft.trim() || pendingAttachment) && !sending);
  const reactionsEnabled = Boolean(onReact);

  const inputRow = (
    <View>
      {pendingAttachment ? (
        <View style={[styles.pendingChip, { backgroundColor: isDark ? colors.surfaceElevated : '#EFEFF4' }]}>
          <View style={styles.pendingPreview}>
            <ContactMessageAttachment
              attachment={{
                url: pendingAttachment.uri,
                name: pendingAttachment.name,
                mimeType: pendingAttachment.mimeType,
                size: pendingAttachment.size ?? 0,
              }}
              isMe
              isDark={isDark}
              compact
            />
          </View>
          {onClearPendingAttachment ? (
            <Pressable onPress={onClearPendingAttachment} hitSlop={8} style={styles.pendingChipClear}>
              <X size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.inputRow}>
        {attachmentMenu ? (
          <View ref={attachBtnRef} collapsable={false}>
            <Pressable
              style={[styles.attachBtn, { backgroundColor: isDark ? colors.surfaceElevated : '#E5E5EA' }]}
              onPress={openAttachMenu}
              disabled={attachmentMenu.disabled || sending}
            >
              <Plus size={20} color={attachmentMenu.disabled ? colors.sendIconIdle : colors.textBase} />
            </Pressable>
          </View>
        ) : null}
        <TextInput
        style={styles.textInput}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={draft}
        onChangeText={onDraftChange}
        multiline
        returnKeyType="send"
        blurOnSubmit={false}
        submitBehavior="submit"
        onSubmitEditing={() => {
          if (canSend) onSend();
        }}
        onFocus={() => {
          closeReactionPicker();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
        }}
      />
      <Pressable
        style={[styles.sendBtn, canSend && styles.sendBtnActive]}
        onPress={onSend}
        disabled={!canSend}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Send size={18} color={canSend ? '#fff' : colors.sendIconIdle} />
        )}
      </Pressable>
      </View>
    </View>
  );

  const openReactionPicker = (msg: IMThreadMessage, isMe: boolean) => {
    if (!reactionsEnabled || !onReact) return;
    const numericId = Number(msg.id);
    if (!Number.isFinite(numericId) || numericId <= 0) return;

    const ref = bubbleRefs.current[String(msg.id)];
    ref?.measureInWindow((x, y, width, height) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setReactionAnchor({
        messageId: msg.id,
        x,
        y,
        width,
        height,
        isMe,
        currentEmoji: msg.reactions?.[String(currentUserId)] ?? null,
      });
    });
  };

  const closeReactionPicker = () => {
    setReactionAnchor(null);
  };

  const handleReactionSelect = (emoji: string) => {
    if (!reactionAnchor || !onReact) return;
    const current = reactionAnchor.currentEmoji;
    onReact(reactionAnchor.messageId, current === emoji ? null : emoji);
    closeReactionPicker();
  };

  if (loading) {
    return (
      <View style={styles.loaderCenter}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.chatScrollView}
        contentContainerStyle={styles.chatScrollContent}
        showsVerticalScrollIndicator
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        bounces
        onContentSizeChange={() => {
          if (messages.length === 0) return;
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {messages.map((msg, index) => {
          const isMe = String(msg.senderId ?? '') === String(currentUserId);
          const { text, attachment } = parseContactMessageParts(msg);
          if (!text && !attachment) return null;
          const reactionEmojis = groupedReactionEmojis(msg.reactions ?? {});
          const isLifted = reactionAnchor?.messageId === msg.id;

          return (
            <Animated.View
              key={String(msg.id)}
              entering={FadeInDown.delay(Math.min(index * 15, 120)).springify()}
              style={[styles.msgWrapper, isMe ? styles.msgMe : styles.msgThem]}
            >
              <View
                ref={(node) => {
                  bubbleRefs.current[String(msg.id)] = node;
                }}
                collapsable={false}
              >
                <Pressable
                  delayLongPress={320}
                  onLongPress={() => openReactionPicker(msg, isMe)}
                  disabled={!reactionsEnabled}
                  style={({ pressed }) => [
                    isLifted && { transform: [{ scale: 1.03 }] },
                    pressed && reactionsEnabled && { opacity: 0.92 },
                  ]}
                >
                  <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleThem]}>
                    {text ? (
                      <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{text}</Text>
                    ) : null}
                    {attachment ? (
                      <ContactMessageAttachment attachment={attachment} isMe={isMe} isDark={isDark} />
                    ) : null}
                  </View>
                </Pressable>
              </View>

              {reactionEmojis.length > 0 ? (
                <View style={[styles.reactionPill, isMe ? styles.reactionPillMe : styles.reactionPillThem]}>
                  <Text style={styles.reactionPillText}>{reactionEmojis.join(' ')}</Text>
                </View>
              ) : null}

              <View style={styles.msgFooter}>
                <Text style={styles.msgTime}>
                  {new Date(msg.createdAt).toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {isMe ? (
                  <View style={{ marginLeft: 4 }}>
                    {msg.isRead ? (
                      <CheckCheck size={14} color={colors.primary} />
                    ) : (
                      <Check size={14} color={colors.textMuted} />
                    )}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          );
        })}

        {peerTyping ? (
          <Animated.View entering={FadeIn} style={[styles.msgWrapper, styles.msgThem]}>
            <View style={[styles.msgBubble, styles.msgBubbleThem, styles.typingBubble]}>
              <TypingDot delay={0} dotStyle={styles.typingDot} />
              <TypingDot delay={150} dotStyle={styles.typingDot} />
              <TypingDot delay={300} dotStyle={styles.typingDot} />
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      {isDark ? (
        <BlurView intensity={80} tint="dark" style={styles.inputArea}>
          {inputRow}
        </BlurView>
      ) : (
        <View style={styles.inputArea}>{inputRow}</View>
      )}

      <MessageReactionPicker
        anchor={reactionAnchor}
        onSelect={handleReactionSelect}
        onDismiss={closeReactionPicker}
        isDark={isDark}
      />

      {attachmentMenu && pickers ? (
        <ContactAttachMenuPopover
          visible={attachMenuOpen}
          anchor={attachAnchor}
          labels={{
            gallery: attachmentMenu.labels.gallery,
            camera: attachmentMenu.labels.camera,
            file: attachmentMenu.labels.file,
          }}
          onGallery={pickers.pickGallery}
          onCamera={pickers.pickCamera}
          onFile={pickers.pickFile}
          onDismiss={() => setAttachMenuOpen(false)}
          isDark={isDark}
        />
      ) : null}
    </>
  );
}
