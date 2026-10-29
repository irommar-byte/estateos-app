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

/**
 * Te same tagi Open Graph co pełna oferta (/o/{id}): tytuł z aktualną ceną, karta 1200×630 z ceną
 * i og:url wersjonowany ceną — Facebook i Messenger pokazują podgląd także przy udostępnianiu wizytówki.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { generateMetadata: offerMetadata } = await import('../page');
  const sp = await props.searchParams;
  return offerMetadata({ params: props.params, searchParams: Promise.resolve({ portal: sp.portal, agent: sp.agent }) });
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
