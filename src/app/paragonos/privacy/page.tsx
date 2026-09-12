import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getParagonOsPrivacyContent } from '@/content/legal/paragonosPrivacyContent';

const doc = getParagonOsPrivacyContent('en');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function ParagonOsPrivacyEnPage() {
  return <LegalDocumentView doc={doc} />;
}
