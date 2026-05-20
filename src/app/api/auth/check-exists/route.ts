import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPhoneLookupVariants } from '@/lib/phoneE164';

const normalizeEmail = (value: unknown) => String(value || '').toLowerCase().trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const field = String(body?.field || '').toLowerCase();
    const rawEmail = body?.email ?? (field === 'email' ? body?.value : undefined);
    const rawPhone = body?.phone ?? body?.contactPhone ?? (field === 'phone' ? body?.value : undefined);

    if (rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return NextResponse.json({ exists: false, field: 'email' });
      const user = await prisma.user.findUnique({
        where: { email },
      });
      return NextResponse.json({ exists: !!user, field: 'email' });
    }

    if (rawPhone) {
      const variants = buildPhoneLookupVariants(rawPhone);
      if (variants.length === 0) return NextResponse.json({ exists: false, field: 'phone' });

      const user = await prisma.user.findFirst({
        where: {
          OR: variants.map((phone) => ({ phone })),
        },
      });
      return NextResponse.json({ exists: !!user, field: 'phone' });
    }

    return NextResponse.json({ exists: false });
  } catch {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
