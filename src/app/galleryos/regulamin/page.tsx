import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getGalleryOsTermsContent } from '@/content/legal/galleryosTermsContent';

const doc = getGalleryOsTermsContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function GalleryOsTermsPlPage() {
  return <LegalDocumentView doc={doc} />;
}
