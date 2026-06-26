import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getTermsContent } from '@/content/legal/termsContent';

const doc = getTermsContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function TermsPage() {
  return <LegalDocumentView doc={doc} />;
}
