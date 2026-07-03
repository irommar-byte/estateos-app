import type { Metadata } from 'next';
import KampaniaOwnerPage from './KampaniaOwnerPage';

export const metadata: Metadata = {
  title: 'Twój plan kampanii — krok po kroku',
  description:
    'Minimalna lista zadań właściciela EstateOS: Search Console, LinkedIn, maile do agencji. Reszta jest już wdrożona na estateos.pl.',
  robots: { index: false, follow: false },
};

export default function KampaniaPage() {
  return <KampaniaOwnerPage />;
}
