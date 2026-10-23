import React, { forwardRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Odstęp między dolnym paskiem a klawiaturą, gdy klawiatura jest otwarta. */
const FOOTER_GAP_ABOVE_KEYBOARD = 8;
/** Odstęp kursora od górnej krawędzi paska akcji. */
const CARET_GAP = 16;

type Props = Omit<ScrollViewProps, 'children'> & {
  children: React.ReactNode;
  /**
   * Pasek akcji (np. Wstecz / Dalej). Przykleja się do klawiatury, więc przyciski
   * są zawsze widoczne — także podczas pisania.
   */
  footer?: React.ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  /** Tło paska akcji — zwykle kolor tła ekranu. */
  footerBackgroundColor?: string;
  footerBorderColor?: string;
};

/**
 * Jedno, wspólne zachowanie formularzy z klawiaturą:
 * - pole, w którym piszesz, zawsze jest widoczne nad klawiaturą (i nad paskiem akcji),
 * - pasek akcji jedzie razem z klawiaturą,
 * - przeciągnięcie listy w dół chowa klawiaturę.
 *
 * Nie łącz z `KeyboardAvoidingView` ani z `automaticallyAdjustKeyboardInsets` —
 * podwójna kompensacja to dokładnie ten błąd, który ten komponent usuwa.
 */
const KeyboardFormLayout = forwardRef<ScrollView, Props>(function KeyboardFormLayout(
  {
    children,
    footer,
    footerStyle,
    footerBackgroundColor,
    footerBorderColor,
    contentContainerStyle,
    ...scrollProps
  },
  ref,
) {
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const footerPaddingBottom = Math.max(12, insets.bottom);

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={(footer ? footerHeight : 0) + CARET_GAP}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <KeyboardStickyView
          // Gdy klawiatura jest otwarta, dolny „safe area” jest pod nią — zdejmujemy go z paska.
          offset={{ closed: 0, opened: Math.max(0, footerPaddingBottom - FOOTER_GAP_ABOVE_KEYBOARD) }}
        >
          <View
            onLayout={(event) => setFooterHeight(Math.round(event.nativeEvent.layout.height))}
            style={[
              styles.footer,
              {
                paddingBottom: footerPaddingBottom,
                backgroundColor: footerBackgroundColor,
                borderTopColor: footerBorderColor,
              },
              footerStyle,
            ]}
          >
            {footer}
          </View>
        </KeyboardStickyView>
      ) : null}
    </View>
  );
});

export default KeyboardFormLayout;

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
