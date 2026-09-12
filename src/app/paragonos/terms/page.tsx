import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getParagonOsTermsContent } from '@/content/legal/paragonosTermsContent';

const doc = getParagonOsTermsContent('en');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function ParagonOsTermsEnPage() {
  return <LegalDocumentView doc={doc} />;
}
