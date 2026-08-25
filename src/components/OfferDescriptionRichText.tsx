import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseListingDescription, type DescriptionSpan } from '../utils/listingDescriptionFormat';

type Props = {
  value: string;
  isDark?: boolean;
};

function InlineSpans({ spans, color }: { spans: DescriptionSpan[]; color: string }) {
  return (
    <Text style={[styles.body, { color }]}>
      {spans.map((span, i) => (
        <Text
          key={`${i}-${span.text.slice(0, 8)}`}
          style={{
            fontWeight: span.bold ? '500' : '300',
            fontStyle: span.italic ? 'italic' : 'normal',
            textDecorationLine: span.underline ? 'underline' : 'none',
            textDecorationColor: 'rgba(196,165,116,0.75)',
          }}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

export default function OfferDescriptionRichText({ value, isDark }: Props) {
  const blocks = parseListingDescription(value);
  const color = isDark ? '#d1d5db' : '#3a3a3c';
  const headingColor = isDark ? '#f5f5f7' : '#1d1d1f';

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === 'separator') {
          return <View key={`sep-${index}`} style={[styles.rule, isDark && { backgroundColor: 'rgba(196,165,116,0.35)' }]} />;
        }
        if (block.type === 'heading') {
          return (
            <Text key={`h-${index}`} style={[styles.heading, { color: headingColor }]}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'bullet' || block.type === 'check') {
          return (
            <View key={`li-${index}`} style={styles.row}>
              <Text style={styles.mark}>{block.type === 'check' ? '✓' : '•'}</Text>
              <View style={{ flex: 1 }}>
                <InlineSpans spans={block.spans} color={color} />
              </View>
            </View>
          );
        }
        return (
          <View key={`p-${index}`} style={styles.paragraph}>
            <InlineSpans spans={block.spans} color={color} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  paragraph: { marginBottom: 2 },
  body: {
    fontSize: 16.5,
    lineHeight: 28,
    fontWeight: '300',
    letterSpacing: 0.25,
    textShadowColor: 'rgba(255,255,255,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  heading: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingRight: 6 },
  mark: {
    width: 16,
    marginTop: 4,
    color: '#c4a574',
    fontSize: 15,
    fontWeight: '400',
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(196,165,116,0.45)',
    marginVertical: 8,
  },
});
