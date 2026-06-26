import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getPrivacyContent } from '@/content/legal/privacyContent';

const doc = getPrivacyContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentView doc={doc} />;
}
