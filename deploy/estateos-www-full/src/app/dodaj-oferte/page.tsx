import ClientForm from './ClientForm';
import { decryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { computeListingLimits, isPlusCreditActive } from '@/lib/offerListingLimits';
import { shapeMobileUser } from '@/lib/mobileUserShape';
import { isAgentOrAgencySeller } from '@/lib/sellerDisplay';
import { sellerClientToListingPrefill } from '@/lib/offerAgencyManagement';
import type { Metadata } from 'next';
import { ESTATEOS_SITE_URL } from '@/lib/estateOsPublicFacts';
import { FREE_LISTING_KEYWORDS } from '@/lib/seo/freeListingContent';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Dodaj ofertę — wystaw nieruchomość za darmo',
  description:
    'Wystaw mieszkanie, dom lub działkę za darmo na EstateOS™. Formularz publikacji ogłoszenia nieruchomości bez prowizji portalowej.',
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: {
    title: 'Wystaw nieruchomość za darmo | EstateOS™',
    description: 'Dodaj ofertę mieszkania lub domu — publikacja podstawowa za darmo.',
    url: `${ESTATEOS_SITE_URL}/dodaj-oferte`,
    locale: 'pl_PL',
    type: 'website',
  },
  alternates: { canonical: `${ESTATEOS_SITE_URL}/dodaj-oferte` },
  robots: { index: true, follow: true },
};

const guestUser = { isLoggedIn: false as const };

export default async function AddOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyClientId?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

  let userData: Record<string, unknown> = { ...guestUser };

  if (sessionCookie?.value) {
    let dbUserId: number | null = null;
    try {
      const parsed = decryptSession(sessionCookie.value);
      dbUserId = Number(parsed.id) || null;
    } catch {
      const u = await prisma.user.findUnique({ where: { email: sessionCookie.value } });
      if (u) dbUserId = u.id;
    }

    if (dbUserId) {
      const realUser = await prisma.user.findUnique({ where: { id: dbUserId } });

      if (realUser) {
        const activeOffersCount = await prisma.offer.count({
          where: {
            userId: dbUserId,
            status: { notIn: ['REJECTED', 'ARCHIVED'] },
          },
        });

        const limits = computeListingLimits(realUser);
        const limit = Math.max(limits.totalSlots, 0);

        const shaped = shapeMobileUser(realUser);
        userData = {
          isLoggedIn: true,
          id: realUser.id,
          name: realUser.name,
          phone: realUser.phone,
          email: realUser.email,
          role: realUser.role,
          isPro: realUser.isPro,
          extraListings: limits.plusCredits,
          plusExpiresAt: isPlusCreditActive(realUser) ? realUser.plusExpiresAt : null,
          limitReached: limit <= 0 ? true : activeOffersCount >= limit,
          isEmailVerified: shaped.isEmailVerified,
          isVerifiedPhone: shaped.isVerifiedPhone,
        };
      }
    }
  }

  const sp = await searchParams;
  let crmSellerPrefill: ReturnType<typeof sellerClientToListingPrefill> | null = null;
  let agencyClientId: number | null = null;

  const clientIdParam = Number(sp?.agencyClientId);
  if (Number.isFinite(clientIdParam) && clientIdParam > 0 && userData.isLoggedIn && userData.id) {
    const agencyUser = await prisma.user.findUnique({ where: { id: Number(userData.id) } });
    if (agencyUser && isAgentOrAgencySeller(agencyUser)) {
      const client = await prisma.agencyClient.findFirst({
        where: {
          id: clientIdParam,
          agencyUserId: Number(userData.id),
          type: 'SELLER',
          status: 'ACTIVE',
        },
        include: { acquisition: { select: { formData: true } } },
      });
      if (client) {
        agencyClientId = client.id;
        crmSellerPrefill = sellerClientToListingPrefill(client);
      }
    }
  }

  if (agencyClientId && !userData.isLoggedIn) {
    redirect('/login?next=/dodaj-oferte');
  }

  return (
    <ClientForm
      initialUser={userData}
      agencyClientId={agencyClientId}
      crmSellerPrefill={crmSellerPrefill}
    />
  );
}
