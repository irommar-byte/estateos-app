import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getParagonOsPrivacyContent } from '@/content/legal/paragonosPrivacyContent';

const doc = getParagonOsPrivacyContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function ParagonOsPrivacyPlPage() {
  return <LegalDocumentView doc={doc} />;
}
