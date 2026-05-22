import type { AppLocale, TranslationParams, TranslationTree } from './types';
import { en } from './locales/en';
import { pl } from './locales/pl';
import { ru } from './locales/ru';

const bundles: Record<AppLocale, TranslationTree> = { pl, en, ru };

let currentLocale: AppLocale = 'pl';
const listeners = new Set<() => void>();

export function getAppLocale(): AppLocale {
  return currentLocale;
}

export function setAppLocale(locale: AppLocale): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  listeners.forEach((fn) => fn());
}

export function subscribeAppLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function lookup(tree: TranslationTree, key: string): string | undefined {
  const parts = key.split('.');
  let node: string | string[] | TranslationTree | undefined = tree;
  for (const part of parts) {
    if (node == null || typeof node === 'string' || Array.isArray(node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = params[name];
    return v == null ? '' : String(v);
  });
}

/** Tłumaczenie po kluczu kropkowym; brak klucza → zwraca klucz (łatwe debugowanie). */
export function t(key: string, params?: TranslationParams): string {
  const primary = lookup(bundles[currentLocale], key);
  if (primary != null) return interpolate(primary, params);
  const chain: AppLocale[] =
    currentLocale === 'ru' ? ['en', 'pl'] : currentLocale === 'en' ? ['pl'] : ['en'];
  for (const loc of chain) {
    const fb = lookup(bundles[loc], key);
    if (fb != null) return interpolate(fb, params);
  }
  return key;
}
