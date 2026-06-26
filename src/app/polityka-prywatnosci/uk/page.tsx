import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getPrivacyContent } from '@/content/legal/privacyContent';

const doc = getPrivacyContent('uk');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function PrivacyPolicyUkPage() {
  return <LegalDocumentView doc={doc} />;
}
