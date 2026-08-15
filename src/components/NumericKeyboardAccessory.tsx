import React, { useEffect } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useResolvedTheme } from '../store/useThemeStore';

/** Jedno ID dla wszystkich pól — cyfry i zwykły tekst. */
export const ESTATEOS_KEYBOARD_DONE_ID = 'estateos-keyboard-done';
/** Alias wsteczny — ten sam pasek co dla tekstu. */
export const ESTATEOS_NUMERIC_KEYBOARD_ACCESSORY_ID = ESTATEOS_KEYBOARD_DONE_ID;

function installTextInputDoneAccessory() {
  if (Platform.OS !== 'ios') return;
  const TI = TextInput as typeof TextInput & { defaultProps?: Record<string, unknown> };
  TI.defaultProps = {
    ...(TI.defaultProps || {}),
    inputAccessoryViewID: ESTATEOS_KEYBOARD_DONE_ID,
  };
}

installTextInputDoneAccessory();

type Props = {
  isDark?: boolean;
};

function DoneBar({ isDark }: { isDark: boolean }) {
  return (
    <View style={[styles.bar, isDark ? styles.barDark : styles.barLight]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          Keyboard.dismiss();
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Gotowe"
        style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.65 }]}
      >
        <Text style={styles.doneText}>Gotowe</Text>
      </Pressable>
    </View>
  );
}

/**
 * iOS: „Gotowe” nad każdą klawiaturą (numeryczna nie ma Enter, tekstowa ma Return = nowa linia).
 * Podłącz przez `inputAccessoryViewID` albo defaultProps z tego modułu.
 * Wewnątrz `Modal` trzeba zamontować ten komponent — pasek z App.tsx nie wchodzi do natywnego okna modala.
 */
export default function NumericKeyboardAccessory({ isDark }: Props) {
  const themeDark = useResolvedTheme() === 'dark';
  const dark = isDark ?? themeDark;

  useEffect(() => {
    installTextInputDoneAccessory();
  }, []);

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={ESTATEOS_KEYBOARD_DONE_ID}>
      <DoneBar isDark={dark} />
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
