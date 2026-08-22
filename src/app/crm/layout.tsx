import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { DeskShell } from '@/components/desk/DeskShell';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import './desk.css';

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

  return <DeskShell>{children}</DeskShell>;
}
