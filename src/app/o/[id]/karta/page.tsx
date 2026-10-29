import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import OfferShareArkusz from '@/components/offer/OfferShareArkusz';
import OfferShareLanding from '@/components/offer/OfferShareLanding';
import { loadOfferShareCard } from '@/lib/offerShareLanding';

type SearchParams = { portal?: string; agent?: string; arkusz?: string; styl?: string };
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};

const getCard = cache((offerId: number, portal: string | null, agent: string | null) =>
  Number.isFinite(offerId) && offerId > 0 ? loadOfferShareCard(offerId, { portalToken: portal, agentUserId: agent }) : null,
);

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const card = await getCard(Number(id), sp.portal ?? null, sp.agent ?? null);
  if (!card) return { title: 'Oferta | EstateOS™' };
  return {
    title: `${card.title} — ${card.priceLabel} | EstateOS™`,
    description: [card.locationLabel, card.area != null ? `${card.area} m²` : null, card.rooms != null ? `${card.rooms} pok.` : null]
      .filter(Boolean)
      .join(' · '),
  };
}

/** Druk / QR — osobno od kliknięcia Facebook, które ma otworzyć pełną ofertę. */
export default async function OfferShareCardPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const card = await getCard(Number(id), sp.portal ?? null, sp.agent ?? null);
  if (!card) notFound();

  if (sp.arkusz === '1') return <OfferShareArkusz card={card} initialStyle={sp.styl} />;

  return <OfferShareLanding card={card} />;
}
