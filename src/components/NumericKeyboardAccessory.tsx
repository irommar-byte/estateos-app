import React from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/** Wspólne ID dla pól `keyboardType="numeric"` — pasek „Gotowe” nad klawiaturą iOS. */
export const ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID = 'estateos-numeric-keyboard-done';

type Props = {
  isDark?: boolean;
};

/**
 * iOS: przycisk „Gotowe” nad klawiaturą numeryczną (brak Enter).
 * Podłącz przez `inputAccessoryViewID={ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID}`.
 */
export default function NumericKeyboardAccessory({ isDark = false }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID}>
      <View style={[styles.bar, isDark ? styles.barDark : styles.barLight]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            Keyboard.dismiss();
          }}
          hitSlop={12}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.65 }]}
        >
          <Text style={styles.doneText}>Gotowe</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barLight: {
    backgroundColor: '#F2F2F7',
    borderTopColor: 'rgba(60,60,67,0.29)',
  },
  barDark: {
    backgroundColor: '#1C1C1E',
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  doneBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0A84FF',
  },
});
