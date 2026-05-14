import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

function parseUserIdFromVerifiedPayload(payload: unknown): number | null {
  const p = payload as Record<string, unknown> | null;
  if (!p) return null;
  const id = Number(p.id ?? p.userId ?? p.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function extractBearer(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  if (raw.toLowerCase().startsWith('bearer ')) return raw.slice(7).trim() || null;
  return raw;
}

/**
 * Wyłączenie Passkey z aplikacji mobilnej (Bearer JWT).
 * Usuwa rekord(y) w `Authenticator` — bez tego UI pokazywałoby „wyłączone”, a stary klucz nadal działałby przy logowaniu.
 *
 * Body (opcjonalnie): `credentialId` | `rawId` | `id` — usunięcie **jednego** klucza (tylko gdy podane w body).
 * Gdy brak tych pól w body: usuwa **wszystkie** passkey dla użytkownika z tokena (przełącznik w profilu).
 * **Nie** używamy `credentialId` z samego JWT — token po logowaniu Passkey zawiera jeden klucz, a w DB mogą być duplikaty / drugi klucz z WWW; wtedy pojedyncze kasowanie zostawiało `hasPasskey: true`.
 * Id użytkownika **wyłącznie** z zweryfikowanego JWT — ignorujemy `userId` z body (uniknięcie nadużyć).
 */
export async function POST(req: Request) {
  try {
    const token = extractBearer(req);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    const verified = verifyMobileToken(token);
    if (!verified) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy lub wygasły token' }, { status: 401 });
    }

    const finalUserId = parseUserIdFromVerifiedPayload(verified);
    if (!finalUserId) {
      return NextResponse.json({ success: false, error: 'Brak poprawnego ID użytkownika w tokenie' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { credentialId, rawId, id } = body || {};
    /** Tylko jawne pole z body — bez domyślnego credentialId z JWT (patrz komentarz nad handlerem). */
    const credentialIdFromBody = String(credentialId || rawId || id || '').trim();

    if (credentialIdFromBody) {
      let deleted = await prisma.authenticator.deleteMany({
        where: {
          userId: finalUserId,
          credentialID: credentialIdFromBody,
        },
      });

      if (deleted.count === 0) {
        try {
          const normalized = normalizeCredentialIdToBase64URL(credentialIdFromBody);
          if (normalized !== credentialIdFromBody) {
            deleted = await prisma.authenticator.deleteMany({
              where: { userId: finalUserId, credentialID: normalized },
            });
          }
        } catch {
          // ignore: nie udało się znormalizować — spróbuj dopasowania po wszystkich rekordach użytkownika
        }
      }

      if (deleted.count === 0) {
        const rows = await prisma.authenticator.findMany({
          where: { userId: finalUserId },
          select: { credentialID: true },
        });
        let targetIds: string[] = [];
        try {
          const want = normalizeCredentialIdToBase64URL(credentialIdFromBody);
          targetIds = rows
            .map((r) => r.credentialID)
            .filter((cid) => {
              try {
                return normalizeCredentialIdToBase64URL(cid) === want;
              } catch {
                return false;
              }
            });
        } catch {
          targetIds = [];
        }

        if (targetIds.length > 0) {
          deleted = await prisma.authenticator.deleteMany({
            where: { userId: finalUserId, credentialID: { in: targetIds } },
          });
        }
      }

      if (deleted.count === 0) {
        return NextResponse.json(
          { success: false, error: 'Nie znaleziono klucza dla tego urządzenia' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Klucz tego urządzenia został usunięty.',
        deletedCount: deleted.count,
      });
    }

    const deleted = await prisma.authenticator.deleteMany({
      where: { userId: finalUserId },
    });

    return NextResponse.json({
      success: true,
      message: 'Wszystkie passkey dla konta zostały usunięte.',
      deletedCount: deleted.count,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('BŁĄD USUWANIA KLUCZA PASSKEY:', message);
    return NextResponse.json({ success: false, error: 'Błąd wewnętrzny serwera' }, { status: 500 });
  }
}
