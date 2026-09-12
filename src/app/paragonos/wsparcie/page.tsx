import type { Metadata } from 'next';
import LegalDocumentView from '@/components/legal/LegalDocumentView';
import { getParagonOsSupportContent } from '@/content/legal/paragonosSupportContent';

const doc = getParagonOsSupportContent('pl');

export const metadata: Metadata = {
  title: doc.metaTitle,
  description: doc.metaDescription,
  alternates: { canonical: doc.canonical },
};

export default function ParagonOsSupportPlPage() {
  return <LegalDocumentView doc={doc} />;
}
