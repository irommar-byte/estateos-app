import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, context: any) {
  try {
    const count = await prisma.user.count({
      where: {
        OR: [
          { isPro: true },
          { planType: 'INVESTOR' },
          { planType: 'AGENCY' },
          { role: 'ADMIN' }
        ]
      }
    });

    // ZWRACAMY PRAWDZIWĄ LICZBĘ (Nawet jeśli to 0)
    return NextResponse.json({ count });
  } catch (error) {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req: Request, context: any) {
  return NextResponse.json({ success: true, message: "Radar włączony w tle." });
}
