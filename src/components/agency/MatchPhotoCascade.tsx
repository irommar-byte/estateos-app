import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLS = 3;
const ROWS_IN_HALF = 2;
const GAP = 7;
const PAD = 10;
const STAGGER_IN = 180;
const STAGGER_OUT = 120;
const FLY_MS = 720;
const FOLD_MS = 520;

export type CascadeOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default function MatchPhotoCascade({
  visible,
  images,
  origin,
  onClose,
}: {
  visible: boolean;
  images: string[];
  origin?: CascadeOrigin | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [shown, setShown] = useState(visible);
  const closingRef = useRef(false);
  const anims = useRef<Animated.Value[]>([]);

  if (anims.current.length !== images.length) {
    anims.current = images.map((_, index) => anims.current[index] ?? new Animated.Value(0));
  }

  const flyIn = () => {
    closingRef.current = false;
    anims.current.forEach((value) => value.setValue(0));
    Animated.stagger(
      STAGGER_IN,
      anims.current.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: FLY_MS,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  const foldAway = (done: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setEnlarged(null);
    Animated.stagger(
      STAGGER_OUT,
      [...anims.current].reverse().map((value) =>
        Animated.timing(value, {
          toValue: 0,
          duration: FOLD_MS,
          easing: Easing.bezier(0.45, 0, 1, 1),
          useNativeDriver: true,
        }),
      ),
    ).start(({ finished }) => {
      closingRef.current = false;
      if (finished) done();
    });
  };

  useEffect(() => {
    if (visible) {
      setShown(true);
      flyIn();
      return;
    }
    if (shown) {
      foldAway(() => setShown(false));
    }
  }, [visible]);

  const requestClose = () => {
    foldAway(() => {
      setShown(false);
      onClose();
    });
  };

  const areaH = height * 0.5;
  const innerW = width - PAD * 2;
  const tileW = (innerW - GAP * (COLS - 1)) / COLS;
  const tileH = (areaH - PAD - GAP * (ROWS_IN_HALF - 1)) / ROWS_IN_HALF;

  return (
    <Modal visible={shown} transparent animationType="fade" onRequestClose={requestClose}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (enlarged) setEnlarged(null);
          else requestClose();
        }}
      >
        {enlarged ? (
          <View pointerEvents="box-none" style={[styles.enlargedWrap, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={() => undefined}>
              <Image
                source={{ uri: enlarged }}
                contentFit="contain"
                style={{
                  width: width - 24,
                  height: height * 0.72,
                  borderRadius: 16,
                }}
              />
            </Pressable>
          </View>
        ) : (
          <View
            pointerEvents="box-none"
            style={{
              paddingTop: insets.top + 8,
              paddingHorizontal: PAD,
              height: areaH + insets.top + 8,
            }}
          >
            <ScrollView
              pointerEvents="box-none"
              scrollEnabled={images.length > COLS * ROWS_IN_HALF}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.grid} pointerEvents="box-none">
                {images.map((uri, index) => {
                  const progress = anims.current[index];
                  const col = index % COLS;
                  const row = Math.floor(index / COLS);
                  const destX = PAD + col * (tileW + GAP);
                  const destY = insets.top + 8 + row * (tileH + GAP);
                  const fromX = origin
                    ? origin.x + origin.width / 2 - (destX + tileW / 2)
                    : -28;
                  const fromY = origin
                    ? origin.y + origin.height / 2 - (destY + tileH / 2)
                    : -36;
                  const fromScale = origin ? Math.min(0.34, origin.width / Math.max(tileW, 1)) : 0.22;
                  const fromRotate = index % 2 === 0 ? -8 : 7;
                  return (
                    <Animated.View
                      key={`${uri}-${index}`}
                      style={{
                        width: tileW,
                        height: tileH,
                        opacity: progress,
                        transform: [
                          {
                            translateY: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [fromY, 0],
                            }),
                          },
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [fromX, 0],
                            }),
                          },
                          {
                            scale: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [fromScale, 1],
                            }),
                          },
                          {
                            rotate: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [`${fromRotate}deg`, '0deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <Pressable onPress={() => setEnlarged(uri)} style={styles.tile}>
                        <Image source={{ uri }} contentFit="contain" style={styles.tileImage} />
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  enlargedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  tile: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});
