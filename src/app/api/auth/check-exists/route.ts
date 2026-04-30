import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const normalizeEmail = (value: unknown) => String(value || '').toLowerCase().trim();
const normalizePhoneDigits = (value: unknown) => String(value || '').replace(/\D/g, '');

function buildPhoneVariants(rawPhone: unknown) {
  const digits = normalizePhoneDigits(rawPhone);
  if (!digits) return [];
  const local = digits.startsWith('48') ? digits.slice(2) : digits;
  if (local.length !== 9) return [String(rawPhone || '').trim(), digits];
  const withCountryDigits = `48${local}`;
  const formatted = `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  return Array.from(new Set([
    String(rawPhone || '').trim(),
    digits,
    withCountryDigits,
    `+${withCountryDigits}`,
    `+48${local}`,
    formatted,
  ])).filter(Boolean);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const field = String(body?.field || '').toLowerCase();
    const rawEmail = body?.email ?? (field === 'email' ? body?.value : undefined);
    const rawPhone = body?.phone ?? (field === 'phone' ? body?.value : undefined);

    // 1. Sprawdzanie zajętości E-maila
    if (rawEmail) {
      const email = normalizeEmail(rawEmail);
      if (!email) return NextResponse.json({ exists: false, field: 'email' });
      const user = await prisma.user.findUnique({ 
        where: { email } 
      });
      return NextResponse.json({ exists: !!user, field: 'email' });
    }
    
    // 2. Sprawdzanie zajętości Telefonu (z uwzględnieniem formatu +48)
    if (rawPhone) {
      const variants = buildPhoneVariants(rawPhone);
      if (variants.length === 0) return NextResponse.json({ exists: false, field: 'phone' });

      const user = await prisma.user.findFirst({
        where: {
          OR: variants.map((phone) => ({ phone })),
        }
      });
      return NextResponse.json({ exists: !!user, field: 'phone' });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
