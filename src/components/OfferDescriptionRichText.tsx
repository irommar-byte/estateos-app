import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { parseListingDescription, type DescriptionSpan } from '../utils/listingDescriptionFormat';

type Props = {
  value: string;
  isDark?: boolean;
  compact?: boolean;
};

function InlineSpans({
  spans,
  color,
  compact,
}: {
  spans: DescriptionSpan[];
  color: string;
  compact?: boolean;
}) {
  return (
    <Text style={[styles.body, compact && styles.bodyCompact, { color }]}>
      {spans.map((span, i) => (
        <Text
          key={`${i}-${span.text.slice(0, 8)}`}
          style={{
            fontWeight: span.bold ? '600' : '300',
            fontStyle: span.italic ? 'italic' : 'normal',
            textDecorationLine: span.underline ? 'underline' : 'none',
            textDecorationColor: 'rgba(196,165,116,0.8)',
          }}
        >
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

export default function OfferDescriptionRichText({ value, isDark, compact }: Props) {
  const blocks = parseListingDescription(value);
  const color = isDark ? '#d1d5db' : '#3a3a3c';
  const headingColor = isDark ? '#f5f5f7' : '#1d1d1f';
  const introColor = isDark ? '#e5e7eb' : '#2c2c2e';

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap}>
      {blocks.map((block, index) => {
        if (block.type === 'separator') {
          return (
            <View
              key={`sep-${index}`}
              style={[styles.ruleWrap, compact && styles.ruleWrapCompact]}
            >
              <View style={[styles.rule, isDark && { backgroundColor: 'rgba(196,165,116,0.32)' }]} />
            </View>
          );
        }
        if (block.type === 'heading') {
          return (
            <Text
              key={`h-${index}`}
              style={[styles.heading, compact && styles.headingCompact, { color: headingColor }]}
            >
              {block.text}
            </Text>
          );
        }
        if (block.type === 'bullet' || block.type === 'check') {
          return (
            <View key={`li-${index}`} style={[styles.row, compact && styles.rowCompact]}>
              <View style={styles.markWrap}>
                <Text style={[styles.mark, block.type === 'check' && styles.markCheck]}>
                  {block.type === 'check' ? '✓' : '•'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <InlineSpans spans={block.spans} color={color} compact={compact} />
              </View>
            </View>
          );
        }
        const isIntro = index === 0;
        return (
          <View key={`p-${index}`} style={[styles.paragraph, compact && styles.paragraphCompact]}>
            <InlineSpans
              spans={block.spans}
              color={isIntro ? introColor : color}
              compact={compact}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  paragraph: { marginBottom: 6 },
  paragraphCompact: { marginBottom: 4 },
  body: {
    fontSize: 17,
    lineHeight: 29,
    fontWeight: '300',
    letterSpacing: 0.25,
  },
  bodyCompact: {
    fontSize: 15,
    lineHeight: 24,
  },
  heading: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.1,
    textTransform: 'uppercase',
  },
  headingCompact: {
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 1.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingRight: 4,
    marginBottom: 4,
  },
  rowCompact: { marginBottom: 2 },
  markWrap: {
    width: 18,
    alignItems: 'center',
    paddingTop: 3,
  },
  mark: {
    color: '#c4a574',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  markCheck: {
    fontSize: 15,
  },
  ruleWrap: {
    marginVertical: 12,
    alignItems: 'center',
  },
  ruleWrapCompact: { marginVertical: 8 },
  rule: {
    width: '72%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(196,165,116,0.42)',
  },
});
