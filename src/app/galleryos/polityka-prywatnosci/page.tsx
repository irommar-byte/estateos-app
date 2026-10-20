import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getGalleryOsPrivacyContent } from '@/content/legal/galleryosPrivacyContent';

const doc = getGalleryOsPrivacyContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function GalleryOsPrivacyPlPage() {
  return <LegalDocumentView doc={doc} />;
}
