import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { loadOfferShareCard, resolvePublicAppOrigin } from '@/lib/offerShareLanding';
import { isSocialShareCrawler } from '@/lib/socialCrawler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
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
    alternates: {
      canonical: isSocialShareCrawler((await headers()).get('user-agent'))
        ? card.facebookObjectUrl
        : card.canonicalUrl,
    },
    openGraph: {
      type: 'website',
      siteName: 'EstateOS™',
      title: card.ogTitle,
      description: card.ogDescription,
      url: card.facebookObjectUrl,
      locale: 'pl_PL',
      ...(card.updatedAtIso ? { modifiedTime: card.updatedAtIso } : {}),
      images: [
        {
          url: card.socialImageUrl,
          width: 1200,
          height: 630,
          type: 'image/jpeg',
          alt: card.ogTitle,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: card.ogTitle,
      description: card.ogDescription,
      images: [card.socialImageUrl],
    },
    ...(card.updatedAtIso
      ? { other: { 'og:updated_time': card.updatedAtIso } }
      : {}),
  };
}

export default function OfertaLayout({ children }: LayoutProps) {
  return children;
}
