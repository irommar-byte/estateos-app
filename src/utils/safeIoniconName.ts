import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const IONICON_ALIASES: Record<string, IoniconName> = {
  'checkmark-seal': 'shield-checkmark',
  'checkmark-seal-outline': 'shield-checkmark-outline',
  'checkmark-done-circle': 'checkmark-done-circle',
};

export function safeIoniconName(name: unknown, fallback: IoniconName = 'ellipse'): IoniconName {
  const raw = String(name || '').trim();
  if (!raw) return fallback;
  const aliased = IONICON_ALIASES[raw];
  if (aliased) return aliased;
  return raw as IoniconName;
}
