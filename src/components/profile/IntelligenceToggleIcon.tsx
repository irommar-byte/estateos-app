import React from 'react';
import IntelligenceBrainMark from '../discovery/IntelligenceBrainMark';

type Props = {
  enabled: boolean;
  size?: number;
};

/**
 * Profile Intelligence toggle glyph — quiet grey brain off,
 * Siri oil + white brain when EstateOS™ Intelligence is on.
 */
export default function IntelligenceToggleIcon({ enabled, size = 36 }: Props) {
  return <IntelligenceBrainMark size={size} living={enabled} softGlyph />;
}
