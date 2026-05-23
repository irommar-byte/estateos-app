export type AppLocale = 'pl' | 'en' | 'ru';

export type TranslationParams = Record<string, string | number | null | undefined>;

/** Wspólny typ funkcji tłumaczenia w serwisach i hookach. */
export type TranslateFn = (key: string, params?: TranslationParams) => string;

export type TranslationTree = {
  [key: string]: string | string[] | TranslationTree;
};
