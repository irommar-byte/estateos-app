import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getParagonOsTermsContent } from '@/content/legal/paragonosTermsContent';

const doc = getParagonOsTermsContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function ParagonOsTermsPlPage() {
  return <LegalDocumentView doc={doc} />;
}
