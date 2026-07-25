import { Easing } from 'react-native';

export const DISCOVERY_MOTION = {
  breathe: 320,
  commit: 380,
  spatialPush: 460,
  glassSettle: 240,
  honor: 600,
  island: 220,
} as const;

export const DISCOVERY_EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const DISCOVERY_EASE_IN_OUT = Easing.bezier(0.4, 0, 0.2, 1);

export const DISCOVERY_COLORS = {
  black: '#040405',
  gold: '#D4AF37',
  ivory: '#F4E8CC',
  green: '#32D74B',
  red: '#FF3B30',
  glassDark: 'rgba(14,14,16,0.74)',
  glassBorder: 'rgba(255,255,255,0.18)',
  textMuted: 'rgba(244,232,204,0.72)',
} as const;
