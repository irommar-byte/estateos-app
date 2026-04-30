import { redirect } from 'next/navigation';

export default async function DealRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const dealId = encodeURIComponent(String(resolvedParams.id || ''));
  redirect(`/moje-konto/crm?tab=transakcje&dealId=${dealId}`);
}
