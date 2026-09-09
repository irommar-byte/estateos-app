import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import SingleOfferPage from '@/app/oferta/[id]/page';
import { loadOfferShareCard, resolvePublicAppOrigin } from '@/lib/offerShareLanding';
import { isSocialShareCrawler } from '@/lib/socialCrawler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ portal?: string; agent?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  const offerId = Number(id);
  const card = await loadOfferShareCard(offerId, { agentUserId: query.agent });
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
    robots: { index: true, follow: true },
    ...(card.updatedAtIso
      ? { other: { 'og:updated_time': card.updatedAtIso } }
      : {}),
    appleWebApp: {
      capable: true,
      title: 'EstateOS™',
      statusBarStyle: 'black-translucent',
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#101014' },
  ],
  colorScheme: 'light dark',
};

/** Ten sam URL co karta Facebook — od razu pełna oferta, bez drugiej strony i skoków IAB. */
export default SingleOfferPage;
