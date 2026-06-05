import React, { useEffect, useRef, useState } from 'react';
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
import { Check, CheckCheck, Send } from 'lucide-react-native';
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
import { CHAT_COLORS, chatThreadStyles as styles } from './chatTheme';
import MessageReactionPicker, { type ReactionAnchor } from './MessageReactionPicker';
import { groupedReactionEmojis } from '../../utils/contactMessageReactions';

export type IMThreadMessage = {
  id: number | string;
  senderId: number | string;
  content: string;
  createdAt: string;
  isRead?: boolean;
  reactions?: Record<string, string>;
};

function TypingDot({ delay }: { delay: number }) {
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
  return <Animated.View style={[styles.typingDot, anim]} />;
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
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const lastAutoScrolledMessageIdRef = useRef<string | number | null>(null);
  const bubbleRefs = useRef<Record<string, View | null>>({});
  const [reactionAnchor, setReactionAnchor] = useState<ReactionAnchor | null>(null);

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

  const canSend = Boolean(draft.trim()) && !sending;
  const reactionsEnabled = Boolean(onReact);

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
        <ActivityIndicator color={CHAT_COLORS.primary} />
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
          const body = String(msg.content || '').trim();
          if (!body) return null;
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
                    <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{body}</Text>
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
                      <CheckCheck size={14} color={CHAT_COLORS.primary} />
                    ) : (
                      <Check size={14} color={CHAT_COLORS.textMuted} />
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
              <TypingDot delay={0} />
              <TypingDot delay={150} />
              <TypingDot delay={300} />
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>

      <BlurView intensity={80} tint="dark" style={styles.inputArea}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder={placeholder}
            placeholderTextColor={CHAT_COLORS.textMuted}
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
              <Send size={18} color={canSend ? '#fff' : 'rgba(255,255,255,0.4)'} />
            )}
          </Pressable>
        </View>
      </BlurView>

      <MessageReactionPicker
        anchor={reactionAnchor}
        onSelect={handleReactionSelect}
        onDismiss={closeReactionPicker}
      />
    </>
  );
}
