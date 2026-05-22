export type AppLocale = 'pl' | 'en' | 'ru';

export type TranslationParams = Record<string, string | number | null | undefined>;

export type TranslationTree = {
  [key: string]: string | string[] | TranslationTree;
};
