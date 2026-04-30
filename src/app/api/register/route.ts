import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { encryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';

const normalizePhoneDigits = (value: unknown) => String(value || '').replace(/\D/g, '');
const normalizeEmail = (value: unknown) => String(value || '').toLowerCase().trim();

function normalizePhoneForDb(rawPhone: unknown) {
  const digits = normalizePhoneDigits(rawPhone);
  if (!digits) return null;
  const local = digits.startsWith('48') ? digits.slice(2) : digits;
  if (local.length !== 9) return null;
  return `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

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
    // Odbieramy NOWE, potężne pola z aplikacji mobilnej
    const { email, password, name, phone, role } = body;
    const cleanEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhoneForDb(phone);

    if (!cleanEmail || !password) {
      return NextResponse.json({ success: false, message: 'Brak danych' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Ten adres e-mail jest już zarejestrowany.' }, { status: 400 });
    }

    if (normalizedPhone) {
      const phoneVariants = buildPhoneVariants(normalizedPhone);
      const existingPhone = await prisma.user.findFirst({
        where: {
          OR: phoneVariants.map((variant) => ({ phone: variant })),
        }
      });
      if (existingPhone) {
        return NextResponse.json({ success: false, message: 'Ten numer telefonu jest już w użyciu.' }, { status: 400 });
      }
    }

    const hashed = await bcrypt.hash(password, 10);

    // Inteligentne mapowanie ról z wizytówki mobilnej
    let dbRole: Role = Role.USER;
    if (role === "PARTNER" || role === "AGENT") dbRole = Role.AGENT;
    if (role === "ADMIN") dbRole = Role.ADMIN;

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        password: hashed,
        name: name || "Użytkownik",
        phone: normalizedPhone,  // Zapisujemy numer w spójnym formacie
        role: dbRole
      }
    });

    const session = encryptSession({ id: user.id, email: user.email, role: user.role || 'USER' });
    
    // Bezpieczne ustawianie ciasteczek
    (await cookies()).set('estateos_session', session, { httpOnly: true, path: '/' });

    return NextResponse.json({ 
      success: true, 
      token: session, 
      role: user.role || 'USER', 
      name: user.name, 
      id: user.id 
    });

  } catch (e: any) {
    console.error("🔥 BŁĄD REJESTRACJI:", e);
    return NextResponse.json({ success: false, message: e.message || String(e) }, { status: 500 });
  }
}
