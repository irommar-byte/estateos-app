import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { buildPhoneLookupVariants, normalizePhoneE164 } from '@/lib/phoneE164';

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

function phonesMatch(stored: string | null | undefined, queryE164: string | null): boolean {
  if (!stored || !queryE164) return false;
  const storedNorm = normalizePhoneE164(stored);
  if (storedNorm && storedNorm === queryE164) return true;
  const variants = new Set(buildPhoneLookupVariants(queryE164));
  return variants.has(stored) || Boolean(storedNorm && variants.has(storedNorm));
}

export async function GET(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const url = new URL(req.url);
  const emailRaw = String(url.searchParams.get('email') || '')
    .trim()
    .toLowerCase();
  const phoneRaw = normalizePhoneE164(url.searchParams.get('phone'));
  const phoneVariants = phoneRaw ? buildPhoneLookupVariants(phoneRaw) : [];

  if (!emailRaw && !phoneRaw) {
    return NextResponse.json({ success: true, matches: [] });
  }

  if (emailRaw && !isValidEmail(emailRaw)) {
    return NextResponse.json({
      success: true,
      emailValid: false,
      phoneValid: phoneRaw ? true : null,
      matches: [],
    });
  }

  const or: Array<{ email?: string; phone?: { in: string[] } }> = [];
  if (emailRaw) or.push({ email: emailRaw });
  if (phoneVariants.length) or.push({ phone: { in: phoneVariants } });

  const rows = await prisma.agencyClient.findMany({
    where: {
      agencyUserId,
      OR: or,
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    include: {
      buyerPreference: { select: { city: true, maxPrice: true, propertyType: true } },
      matches: {
        orderBy: { score: 'desc' },
        take: 3,
        include: {
          offer: { select: { id: true, title: true, city: true, price: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          createdAt: true,
          offerId: true,
        },
      },
      _count: { select: { matches: true, activities: true } },
    },
  });

  return NextResponse.json({
    success: true,
    emailValid: emailRaw ? true : null,
    phoneValid: phoneRaw ? true : null,
    matches: rows.map((c) => ({
      id: c.id,
      status: c.status,
      type: c.type,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      matchCount: c._count.matches,
      activityCount: c._count.activities,
      buyerCity: c.buyerPreference?.city ?? null,
      topMatches: c.matches.map((m) => ({
        score: m.score,
        offerId: m.offer.id,
        offerTitle: m.offer.title,
        city: m.offer.city,
        price: m.offer.price,
      })),
      activities: c.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        body: a.body,
        offerId: a.offerId,
        createdAt: a.createdAt.toISOString(),
      })),
      matchedBy: {
        email: Boolean(emailRaw && c.email?.toLowerCase() === emailRaw),
        phone: phonesMatch(c.phone, phoneRaw),
      },
    })),
  });
}
