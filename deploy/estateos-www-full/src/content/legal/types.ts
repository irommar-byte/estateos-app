export type LegalLocale = 'pl' | 'en' | 'uk';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocumentContent = {
  locale: LegalLocale;
  metaTitle: string;
  metaDescription: string;
  canonical: string;
  title: string;
  updatedLabel: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  relatedLinks: { label: string; href: string }[];
  localeLinks: { label: string; href: string }[];
};
