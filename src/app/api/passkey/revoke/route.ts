import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, credentialId, rawId, id } = body || {};

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : String(authHeader || '').trim();
    const verified = token ? (verifyMobileToken(token) as any) : null;
    const decoded = token ? (jwt.decode(token) as any) : null;

    const jwtUserId = Number(verified?.id ?? verified?.userId ?? verified?.sub ?? decoded?.id ?? decoded?.userId ?? decoded?.sub);
    const jwtCredentialId = String(verified?.credentialId || decoded?.credentialId || '').trim();

    const finalUserId = Number(userId || jwtUserId);
    const finalCredentialId = String(credentialId || rawId || id || jwtCredentialId || '').trim();

    if (!Number.isFinite(finalUserId) || finalUserId <= 0) {
      return NextResponse.json({ success: false, error: 'Brak poprawnego ID użytkownika' }, { status: 400 });
    }
    if (!finalCredentialId) {
      // Kompatybilność z klientem (TestFlight): wysyła tylko { userId }.
      // Dla bezpieczeństwa NIE usuwamy wszystkich kluczy usera, ale zwracamy 2xx,
      // żeby UI mogło się przełączyć bez unieważniania drugiego telefonu.
      return NextResponse.json({
        success: true,
        message: 'Brak credentialId — usunięcie pominięte (tryb bezpieczny).',
      });
    }

    const deleted = await prisma.authenticator.deleteMany({
      where: {
        userId: finalUserId,
        credentialID: finalCredentialId,
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ success: false, error: 'Nie znaleziono klucza dla tego urządzenia' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Klucz tego urządzenia został usunięty.' });
  } catch (error: any) {
    console.error('BŁĄD USUWANIA KLUCZA PASSKEY:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd wewnętrzny serwera' }, { status: 500 });
  }
}
