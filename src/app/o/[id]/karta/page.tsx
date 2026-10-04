import { notFound } from 'next/navigation';
import OfferShareArkusz from '@/components/offer/OfferShareArkusz';
import OfferShareLanding from '@/components/offer/OfferShareLanding';
import { loadOfferShareCard } from '@/lib/offerShareLanding';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ portal?: string; agent?: string; arkusz?: string }>;
};

/** Druk / QR — osobno od kliknięcia Facebook, które ma otworzyć pełną ofertę. */
export default async function OfferShareCardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) notFound();

  const card = await loadOfferShareCard(offerId, {
    portalToken: sp.portal ?? null,
    agentUserId: sp.agent ?? null,
  });
  if (!card) notFound();

  if (sp.arkusz === '1') return <OfferShareArkusz card={card} />;

  return <OfferShareLanding card={card} />;
}
