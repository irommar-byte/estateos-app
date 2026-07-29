import React, { useRef } from 'react';
import {
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Camera, FileText, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getChatTheme } from './chatTheme';

export type AttachMenuAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  anchor: AttachMenuAnchor | null;
  labels: { gallery: string; camera: string; file: string };
  onGallery: () => void;
  onCamera: () => void;
  onFile: () => void;
  onDismiss: () => void;
  isDark?: boolean;
};

const ROW_H = 48;
const MENU_W = 248;
/** iOS: native picker must wait until Modal fully tears down or the app freezes. */
const PICKER_DELAY_MS = Platform.OS === 'ios' ? 420 : 180;

export default function ContactAttachMenuPopover({
  visible,
  anchor,
  labels,
  onGallery,
  onCamera,
  onFile,
  onDismiss,
  isDark = true,
}: Props) {
  const { colors } = getChatTheme(isDark);
  const { width: screenW } = useWindowDimensions();
  const launchingRef = useRef(false);
  /** Keep last anchor so Modal can finish dismissing without jumping to null layout. */
  const lastAnchorRef = useRef<AttachMenuAnchor | null>(anchor);
  if (anchor) lastAnchorRef.current = anchor;
  const layoutAnchor = anchor || lastAnchorRef.current;

  if (!visible && !layoutAnchor) return null;
  if (!layoutAnchor) return null;

  const menuHeight = ROW_H * 3 + 14;
  const left = Math.max(12, Math.min(layoutAnchor.x - 4, screenW - MENU_W - 12));
  const top = Math.max(16, layoutAnchor.y - menuHeight - 10);

  const run = (fn: () => void) => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        try {
          fn();
        } finally {
          launchingRef.current = false;
        }
      }, PICKER_DELAY_MS);
    });
  };

  const rows = [
    { key: 'gallery', label: labels.gallery, Icon: ImageIcon, onPress: onGallery },
    { key: 'camera', label: labels.camera, Icon: Camera, onPress: onCamera },
    { key: 'file', label: labels.file, Icon: FileText, onPress: onFile },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={StyleSheet.absoluteFill}>
          <View style={[styles.dim, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.12)' }]} />
        </Animated.View>

        <Animated.View
          entering={ZoomIn.springify().damping(17).stiffness(340).mass(0.85)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.menuWrap,
            {
              top,
              left,
              width: MENU_W,
            },
          ]}
        >
          <BlurView
            intensity={isDark ? 88 : 72}
            tint={isDark ? 'dark' : 'light'}
            style={[styles.menu, !isDark && styles.menuLight]}
          >
            {rows.map((row, index) => (
              <Pressable
                key={row.key}
                onPress={(e) => {
                  e.stopPropagation();
                  run(row.onPress);
                }}
                style={({ pressed }) => [
                  styles.row,
                  index < rows.length - 1 && styles.rowBorder,
                  pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                  <row.Icon size={17} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.textBase }]} numberOfLines={1}>
                  {row.label}
                </Text>
              </Pressable>
            ))}
          </BlurView>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          entering={ZoomIn.springify().damping(18).stiffness(380)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.anchorRing,
            {
              top: layoutAnchor.y - 3,
              left: layoutAnchor.x - 3,
              width: layoutAnchor.width + 6,
              height: layoutAnchor.height + 6,
              borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)',
            },
          ]}
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  dim: { ...StyleSheet.absoluteFillObject },
  menuWrap: {
    position: 'absolute',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  menu: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 6,
  },
  menuLight: {
    borderColor: 'rgba(0,0,0,0.08)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    height: ROW_H,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.22)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  anchorRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
});
