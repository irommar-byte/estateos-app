import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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

export default function MatchPhotoCascade({
  visible,
  images,
  onClose,
}: {
  visible: boolean;
  images: string[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const anims = useRef<Animated.Value[]>([]);

  if (anims.current.length !== images.length) {
    anims.current = images.map((_, index) => anims.current[index] ?? new Animated.Value(0));
  }

  useEffect(() => {
    if (!visible) {
      setEnlarged(null);
      anims.current.forEach((value) => value.setValue(0));
      return;
    }
    anims.current.forEach((value) => value.setValue(0));
    Animated.stagger(
      75,
      anims.current.map((value) =>
        Animated.spring(value, {
          toValue: 1,
          friction: 7,
          tension: 64,
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [visible, images.length]);

  const areaH = height * 0.5;
  const innerW = width - PAD * 2;
  const tileW = (innerW - GAP * (COLS - 1)) / COLS;
  const tileH = (areaH - PAD - GAP * (ROWS_IN_HALF - 1)) / ROWS_IN_HALF;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
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
                              outputRange: [-24, 0],
                            }),
                          },
                          {
                            translateX: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-16, 0],
                            }),
                          },
                          {
                            scale: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.78, 1],
                            }),
                          },
                        ],
                      }}
                    >
                      <Pressable onPress={() => setEnlarged(uri)} style={styles.tile}>
                        <Image source={{ uri }} contentFit="cover" style={styles.tileImage} />
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
    backgroundColor: '#1C1C1E',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
});
