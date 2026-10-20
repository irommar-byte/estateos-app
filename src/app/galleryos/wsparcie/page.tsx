import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getGalleryOsSupportContent } from '@/content/legal/galleryosSupportContent';

const doc = getGalleryOsSupportContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function GalleryOsSupportPlPage() {
  return <LegalDocumentView doc={doc} />;
}
