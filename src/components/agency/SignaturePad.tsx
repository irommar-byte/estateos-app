import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

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

export default function SignaturePad({
  onChange,
  disabled,
  isDark,
  onBeginDrawing,
  onEndDrawing,
}: {
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  isDark?: boolean;
  onBeginDrawing?: () => void;
  onEndDrawing?: () => void;
}) {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const current = useRef<Point[]>([]);
  const viewRef = useRef<View>(null);

  const emitCapture = async () => {
    if (!viewRef.current || current.current.length + strokes.length === 0) {
      onChange('');
      return;
    }
    try {
      const uri = await captureRef(viewRef, { format: 'png', result: 'data-uri', quality: 1 });
      onChange(String(uri || ''));
    } catch {
      onChange('');
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        onBeginDrawing?.();
        current.current = [{ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }];
        setStrokes((prev) => [...prev, current.current]);
      },
      onPanResponderMove: (event) => {
        current.current = [...current.current, { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }];
        setStrokes((prev) => {
          const next = [...prev];
          next[next.length - 1] = current.current;
          return next;
        });
      },
      onPanResponderRelease: () => {
        onEndDrawing?.();
        void emitCapture();
      },
      onPanResponderTerminate: () => {
        onEndDrawing?.();
      },
    }),
  ).current;

  const clear = () => {
    current.current = [];
    setStrokes([]);
    onChange('');
  };

  return (
    <View>
      <View
        ref={viewRef}
        collapsable={false}
        {...pan.panHandlers}
        style={[styles.pad, { backgroundColor: '#fff', borderColor: isDark ? '#333' : '#ddd' }]}
      >
        <Svg width="100%" height="100%">
          <Path d={pathFromStrokes(strokes)} stroke="#111827" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <Pressable onPress={clear} style={styles.clear}>
        <Text style={styles.clearText}>Wyczyść podpis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { height: 160, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  clear: { marginTop: 8, alignSelf: 'flex-start' },
  clearText: { color: '#ef4444', fontWeight: '800', fontSize: 12 },
});
