export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createOffer, updateOffer } from '@/lib/services/offer.service';

// =======================
// GET 🔥 FIX
// =======================
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const includeAll = searchParams.get('includeAll') === 'true';
  const userId = searchParams.get('userId');

  let where: any = {};

  if (userId) {
    // 🔥 user widzi swoje aktywne
    where = {
      userId: Number(userId),
      status: 'ACTIVE'
    };
  } else if (!includeAll) {
    // 🔥 publiczny widok
    where = {
      status: 'ACTIVE',
      lat: { not: null },
      lng: { not: null }
    };
  }

  try {
    const offers = await prisma.offer.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, offers });

  } catch (error: any) {
    console.error("🔥 MOBILE API ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// =======================
// POST
// =======================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const offer = await createOffer(body);


    return NextResponse.json({ success: true, offer });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message });
  }
}

// =======================
// PUT
// =======================
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const offer = await updateOffer(body);
    return NextResponse.json({ success: true, offer });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message });
  }
}
