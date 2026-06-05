import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MESSAGE_TAPBACKS } from '../../constants/messageTapbacks';

export type ReactionAnchor = {
  messageId: number | string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMe: boolean;
  currentEmoji?: string | null;
};

type Props = {
  anchor: ReactionAnchor | null;
  onSelect: (emoji: string) => void;
  onDismiss: () => void;
  isDark?: boolean;
};

export default function MessageReactionPicker({ anchor, onSelect, onDismiss, isDark = true }: Props) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  if (!anchor) return null;

  const barWidth = Math.min(screenW - 32, MESSAGE_TAPBACKS.length * 46 + 20);
  const left = Math.max(16, Math.min(anchor.x + anchor.width / 2 - barWidth / 2, screenW - barWidth - 16));
  const preferAbove = anchor.y > screenH * 0.38;
  const top = preferAbove
    ? Math.max(16, anchor.y - 58)
    : Math.min(screenH - 120, anchor.y + anchor.height + 10);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          entering={ZoomIn.springify().damping(18).stiffness(360)}
          exiting={FadeOut.duration(160)}
          style={[styles.barWrap, { top, left, width: barWidth }]}
        >
          <BlurView intensity={isDark ? 92 : 78} tint={isDark ? 'dark' : 'light'} style={[styles.bar, !isDark && styles.barLight]}>
            {MESSAGE_TAPBACKS.map((emoji) => {
              const active = anchor.currentEmoji === emoji;
              return (
                <Pressable
                  key={emoji}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(emoji);
                  }}
                  style={({ pressed }) => [
                    styles.emojiBtn,
                    active && styles.emojiBtnActive,
                    pressed && { transform: [{ scale: 1.18 }] },
                  ]}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </BlurView>
        </Animated.View>

        <Animated.View
          entering={FadeIn.duration(140)}
          exiting={FadeOut.duration(120)}
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              top: anchor.y - 4,
              left: anchor.x - 4,
              width: anchor.width + 8,
              height: anchor.height + 8,
              alignSelf: anchor.isMe ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  barWrap: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(28,28,30,0.92)',
  },
  barLight: {
    borderColor: 'rgba(0,0,0,0.08)',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(52,199,89,0.22)',
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  highlight: {
    position: 'absolute',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(52,199,89,0.55)',
    backgroundColor: 'rgba(52,199,89,0.08)',
  },
});
