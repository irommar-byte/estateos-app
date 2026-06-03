import React from 'react';
import { StyleSheet } from 'react-native';
import ScrollingNewsLine from './ScrollingNewsLine';

type Props = {
  text: string;
};

/** Zielony pasek TV-news — jedna linia, zawsze przewija całość. */
export default function GreenNewsTicker({ text }: Props) {
  return (
    <ScrollingNewsLine
      text={text}
      textStyle={styles.text}
      height={32}
      backgroundColor="#059669"
      borderBottomRadius={14}
      pxPerSec={48}
    />
  );
}

const styles = StyleSheet.create({
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
