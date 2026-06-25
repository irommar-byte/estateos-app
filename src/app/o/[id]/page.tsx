import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import OfferShareLanding from '@/components/offer/OfferShareLanding';
import { loadOfferShareCard, resolvePublicAppOrigin } from '@/lib/offerShareLanding';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ portal?: string; agent?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const offerId = Number(id);
  const card = await loadOfferShareCard(offerId);
  if (!card) {
    return {
      title: 'Oferta niedostępna — EstateOS™',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: {
      absolute: `${card.ogTitle} | EstateOS™`,
    },
    description: card.ogDescription,
    metadataBase: new URL(resolvePublicAppOrigin()),
    alternates: { canonical: card.canonicalUrl },
    openGraph: {
      type: 'website',
      siteName: 'EstateOS™',
      title: card.ogTitle,
      description: card.ogDescription,
      url: card.canonicalUrl,
      locale: 'pl_PL',
      images: card.imageUrl
        ? [{ url: card.imageUrl, width: 1200, height: 630, alt: card.ogTitle }]
        : [
            {
              url: `${resolvePublicAppOrigin()}/o/${offerId}/opengraph-image`,
              width: 1200,
              height: 630,
              alt: card.ogTitle,
            },
          ],
    },
    twitter: {
      card: 'summary_large_image',
      title: card.ogTitle,
      description: card.ogDescription,
      images: card.imageUrl
        ? [card.imageUrl]
        : [`${resolvePublicAppOrigin()}/o/${offerId}/opengraph-image`],
    },
    robots: { index: true, follow: true },
  };
}

export default async function OfferSharePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const offerId = Number(id);
  if (!Number.isFinite(offerId) || offerId <= 0) notFound();

  const card = await loadOfferShareCard(offerId);
  if (!card) notFound();

  return (
    <OfferShareLanding
      card={card}
      portalToken={sp.portal ?? null}
      agentUserId={sp.agent ?? null}
    />
  );
}
