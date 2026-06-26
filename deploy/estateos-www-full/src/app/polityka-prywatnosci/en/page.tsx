import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getPrivacyContent } from '@/content/legal/privacyContent';

const doc = getPrivacyContent('en');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function PrivacyPolicyEnPage() {
  return <LegalDocumentView doc={doc} />;
}
