import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { redirect } from 'next/navigation';
import { DeskShell } from '@/components/desk/DeskShell';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import './desk.css';

const nunito = Nunito({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800', '900'],
  variable: '--font-eos-crm',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EstateOS™ CRM',
  description: 'EstateOS™ Desk — operating system for real estate agents.',
  robots: { index: false, follow: false },
};

export default async function CrmDeskLayout({ children }: { children: React.ReactNode }) {
  const userId = await resolveWebUserId();
  if (!userId) redirect('/login?next=/crm');

  const agencyUserId = await requireAgencyUserId();
  if (!agencyUserId) redirect('/moje-konto/ogloszenia');

  return <div className={nunito.variable}><DeskShell>{children}</DeskShell></div>;
}
