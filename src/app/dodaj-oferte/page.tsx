import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ClientForm from './ClientForm';
import { computeListingLimits, isPlusCreditActive } from '@/lib/offerListingLimits';
import { shapeMobileUser } from '@/lib/mobileUserShape';
import { isAgentOrAgencySeller } from '@/lib/sellerDisplay';
import { sellerClientToListingPrefill } from '@/lib/offerAgencyManagement';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export default async function AddOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyClientId?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('estateos_session') || cookieStore.get('luxestate_user');

  let userData = null;

  if (!sessionCookie?.value) {
    redirect('/login?next=/dodaj-oferte');
  }

  if (sessionCookie) {
    let dbUserId = null;
    try {
      const parsed = decryptSession(sessionCookie.value);
      dbUserId = parsed.id;
    } catch (e) {
      const u = await prisma.user.findUnique({ where: { email: sessionCookie.value } });
      if (u) dbUserId = u.id;
    }

    if (dbUserId) {
      const realUser = await prisma.user.findUnique({
        where: { id: dbUserId }
      });

      if (realUser) {
        // 🔥 BEZWZGLĘDNE LICZENIE OFERT (NA ŻYWO, BEZ CACHE) 🔥
        const activeOffersCount = await prisma.offer.count({
          where: { 
            userId: dbUserId,
            status: { notIn: ['REJECTED', 'ARCHIVED'] } 
          }
        });

        const limits = computeListingLimits(realUser);
        const activePlusCredits = limits.plusCredits;
        const limit = limits.isAgency ? 999999 : limits.totalSlots;

        // Twarda blokada - przekazujemy do formularza
        const limitReached = activeOffersCount >= limit;

        const shaped = shapeMobileUser(realUser);
        userData = {
          isLoggedIn: true,
          id: realUser.id,
          name: realUser.name,
          phone: realUser.phone,
          email: realUser.email,
          role: realUser.role,
          isPro: realUser.isPro,
          extraListings: activePlusCredits,
          plusExpiresAt: isPlusCreditActive(realUser) ? realUser.plusExpiresAt : null,
          limitReached: limitReached,
          isEmailVerified: shaped.isEmailVerified,
          isVerifiedPhone: shaped.isVerifiedPhone,
        };
      }
    }
  }

  if (!userData?.isLoggedIn) {
    redirect('/login?next=/dodaj-oferte');
  }

  const sp = await searchParams;
  let crmSellerPrefill: ReturnType<typeof sellerClientToListingPrefill> | null = null;
  let agencyClientId: number | null = null;

  const clientIdParam = Number(sp?.agencyClientId);
  if (Number.isFinite(clientIdParam) && clientIdParam > 0 && userData.id) {
    const agencyUser = await prisma.user.findUnique({ where: { id: userData.id } });
    if (agencyUser && isAgentOrAgencySeller(agencyUser)) {
      const client = await prisma.agencyClient.findFirst({
        where: {
          id: clientIdParam,
          agencyUserId: userData.id,
          type: 'SELLER',
          status: 'ACTIVE',
        },
      });
      if (client) {
        agencyClientId = client.id;
        crmSellerPrefill = sellerClientToListingPrefill(client);
      }
    }
  }

  return (
    <ClientForm
      initialUser={userData}
      agencyClientId={agencyClientId}
      crmSellerPrefill={crmSellerPrefill}
    />
  );
}
